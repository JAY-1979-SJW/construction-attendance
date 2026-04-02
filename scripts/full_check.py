"""
전체 기능 전수 점검 스크립트
A~F 항목을 API 레벨에서 실제 실행
"""
import time, json, requests
import jwt as pyjwt

S = "https://attendance.haehan-ai.kr"
JWT_SECRET = "haehan-jwt-secret-2026-construction"

results = []

def tok(sub, role):
    return pyjwt.encode(
        {"sub": sub, "type": "admin", "role": role,
         "iat": int(time.time()), "exp": int(time.time()) + 86400},
        JWT_SECRET, algorithm="HS256")

def mk(sub="test_admin_001", role="ADMIN"):
    s = requests.Session()
    s.cookies.set("admin_token", tok(sub, role), domain="attendance.haehan-ai.kr")
    return s

def api(s, method, path, **kw):
    r = getattr(s, method)(f"{S}{path}", **kw)
    try:
        return r.status_code, r.json()
    except Exception:
        return r.status_code, {}

def chk(group, name, ok, detail=""):
    tag = "O" if ok else "X"
    results.append({"group": group, "name": name, "ok": ok, "detail": detail})
    print(f"  [{tag}] {name}" + (f" — {detail}" if detail else ""))

def main():
    sa = mk("clz00000000000000000000000", "SUPER_ADMIN")  # SUPER_ADMIN
    ad = mk("test_admin_001", "ADMIN")  # ADMIN
    vi = mk("test_viewer_001", "VIEWER")  # VIEWER
    si = mk("test_siteadmin_001", "SITE_ADMIN")  # SITE_ADMIN

    # ═══════════════════════════════════════════════════════
    # A. 관리자/권한
    # ═══════════════════════════════════════════════════════
    print("\n=== A. 관리자/권한 ===")

    # 로그인 (세션 쿠키 방식이므로 JWT 직접 생성으로 대체 — 실제 로그인 API는 비밀번호 필요)
    st, rj = api(sa, "get", "/api/admin/sites")
    chk("A", "SUPER_ADMIN 페이지 접근", st == 200)

    st, rj = api(ad, "get", "/api/admin/sites")
    chk("A", "ADMIN 페이지 접근", st == 200)

    st, rj = api(vi, "get", "/api/admin/sites")
    chk("A", "VIEWER 읽기 접근", st == 200)

    # SUPER_ADMIN 전용: audit-logs
    st, _ = api(sa, "get", "/api/admin/audit-logs?pageSize=1")
    chk("A", "SUPER_ADMIN audit-logs 접근", st == 200)

    st, _ = api(ad, "get", "/api/admin/audit-logs?pageSize=1")
    chk("A", "ADMIN audit-logs 차단", st == 403, f"status={st}")

    st, _ = api(vi, "get", "/api/admin/audit-logs?pageSize=1")
    chk("A", "VIEWER audit-logs 차단", st == 403, f"status={st}")

    # VIEWER는 쓰기 불가
    st, rj = api(vi, "post", "/api/admin/sites", json={"name": "test", "address": "test", "latitude": 37.5, "longitude": 127.0})
    chk("A", "VIEWER 쓰기 차단", st in [403, 401], f"status={st}")

    # 로그아웃
    st, _ = api(sa, "post", "/api/admin/auth/logout")
    chk("A", "로그아웃 API", st == 200)

    # 로그아웃 후 재요청 시 401
    st, _ = api(sa, "get", "/api/admin/sites")
    chk("A", "로그아웃 후 401", st == 401, f"status={st}")

    # 세션 재생성
    sa = mk("clz00000000000000000000000", "SUPER_ADMIN")

    # ═══════════════════════════════════════════════════════
    # B. 현장 관리
    # ═══════════════════════════════════════════════════════
    print("\n=== B. 현장 관리 ===")

    st, rj = api(ad, "get", "/api/admin/sites")
    sites = rj.get("data", {}).get("items", [])
    chk("B", "현장 목록 조회", st == 200, f"{len(sites)}건")

    # 현장 검색 (사이트 API는 쿼리 파라미터 확인)
    st, rj = api(ad, "get", "/api/admin/sites?search=E2E")
    chk("B", "현장 검색", st == 200)

    # 신규 등록 (geocode 성공 주소)
    test_site_name = f"점검현장_{int(time.time())%10000}"
    st_g, gj = api(ad, "get", "/api/admin/geocode?address=서울특별시 종로구 세종대로 209")
    geo_ok = st_g == 200 and gj.get("success")
    chk("B", "geocode 성공", geo_ok)

    new_site_id = None
    if geo_ok:
        lat, lng = gj["data"]["lat"], gj["data"]["lng"]
        st, rj = api(ad, "post", "/api/admin/sites", json={
            "name": test_site_name, "address": "서울특별시 종로구 세종대로 209",
            "latitude": lat, "longitude": lng, "allowedRadius": 100})
        new_site_id = rj.get("data", {}).get("id")
        chk("B", "현장 신규 등록", st == 201 and new_site_id is not None)

        # 등록 후 목록 반영
        st, rj = api(ad, "get", "/api/admin/sites")
        found = any(s["id"] == new_site_id for s in rj.get("data", {}).get("items", []))
        chk("B", "등록 후 목록 반영", found)

        # 현장 수정
        st, rj = api(ad, "patch", f"/api/admin/sites/{new_site_id}", json={"notes": "점검 테스트"})
        chk("B", "현장 수정", st == 200)

        # 상세 조회
        st, rj = api(ad, "get", f"/api/admin/sites/{new_site_id}")
        chk("B", "현장 상세 조회", st == 200 and rj.get("data", {}).get("name") == test_site_name)

    # geocode 실패
    st_g, gj = api(ad, "get", "/api/admin/geocode?address=존재하지않는주소999")
    chk("B", "geocode 실패 시 422", st_g == 422)

    # ═══════════════════════════════════════════════════════
    # C. 근로자 관리
    # ═══════════════════════════════════════════════════════
    print("\n=== C. 근로자 관리 ===")

    st, rj = api(ad, "get", "/api/admin/workers?pageSize=200")
    workers = rj.get("data", {}).get("items", rj.get("data", []))
    chk("C", "근로자 목록 조회", st == 200, f"{len(workers)}명")

    # 검색
    st, rj = api(ad, "get", "/api/admin/workers?search=서주현")
    chk("C", "근로자 검색", st == 200)

    # 신규 등록
    test_worker_phone = f"010{int(time.time())%100000000:08d}"
    st, rj = api(ad, "post", "/api/admin/workers", json={
        "name": "점검테스트근로자",
        "phone": test_worker_phone,
        "jobTitle": "배관공",
        "employmentType": "DAILY_CONSTRUCTION",
    })
    new_worker_id = rj.get("data", {}).get("id")
    chk("C", "근로자 신규 등록", st == 201 and new_worker_id is not None, f"phone={test_worker_phone}")

    if new_worker_id:
        # 목록 반영
        st, rj = api(ad, "get", f"/api/admin/workers?search={test_worker_phone}")
        items = rj.get("data", {}).get("items", rj.get("data", []))
        found = any(w.get("id") == new_worker_id for w in items) if isinstance(items, list) else False
        chk("C", "등록 후 목록 반영", found)

        # 수정
        st, rj = api(ad, "put", f"/api/admin/workers/{new_worker_id}", json={"jobTitle": "전기공"})
        chk("C", "근로자 수정", st == 200)

        # 상세 조회
        st, rj = api(ad, "get", f"/api/admin/workers/{new_worker_id}")
        detail = rj.get("data", {})
        chk("C", "근로자 상세 조회", st == 200 and detail.get("jobTitle") == "전기공")

        # 비활성화
        st, rj = api(ad, "put", f"/api/admin/workers/{new_worker_id}", json={"isActive": False})
        chk("C", "근로자 비활성화", st == 200)

    # ═══════════════════════════════════════════════════════
    # D. 계약 관리
    # ═══════════════════════════════════════════════════════
    print("\n=== D. 계약 관리 ===")

    # 기존 근로자로 계약 등록
    worker_id = workers[0]["id"] if workers else None
    site_id = sites[0]["id"] if sites else new_site_id

    new_contract_id = None
    if worker_id and site_id:
        payload = {
            "workerId": worker_id, "siteId": site_id,
            "contractKind": "EMPLOYMENT", "contractTemplateType": "DAILY_EMPLOYMENT",
            "startDate": "2026-04-10", "endDate": "2026-06-30",
            "dailyWage": 260000, "laborRelationType": "DIRECT_EMPLOYEE",
        }
        st, rj = api(ad, "post", "/api/admin/contracts", json=payload)
        new_contract_id = rj.get("data", {}).get("id")
        chk("D", "계약 신규 등록", st == 201 and new_contract_id is not None)

        # 목록 조회
        st, rj = api(ad, "get", f"/api/admin/contracts?workerId={worker_id}&limit=5")
        chk("D", "계약 목록 조회", st == 200)

        # 상세 확인 — siteId 일치
        contracts = rj.get("data", [])
        latest = contracts[0] if contracts else {}
        chk("D", "저장된 siteId 일치", latest.get("siteId") == site_id)
        chk("D", "저장된 startDate 일치", str(latest.get("startDate", "")).startswith("2026-04-10"))

    # PDF 업로드 테스트
    import tempfile
    from fpdf import FPDF
    pdf = FPDF()
    pdf.add_page()
    pdf.add_font("K", "", r"C:\Windows\Fonts\malgun.ttf")
    pdf.set_font("K", size=11)
    for l in ["근로계약서", "현장명: 점검테스트현장", "기간: 2026-04-01 ~ 2026-09-30", "일당: 280000원"]:
        pdf.cell(0, 8, l, new_x="LMARGIN", new_y="NEXT")
    tmp = tempfile.mktemp(suffix=".pdf")
    pdf.output(tmp)

    with open(tmp, "rb") as f:
        r = requests.Session()
        r.cookies.set("admin_token", tok("test_admin_001", "ADMIN"), domain="attendance.haehan-ai.kr")
        resp = r.post(f"{S}/api/admin/documents/parse-pdf", files={"file": ("test.pdf", f, "application/pdf")})
    chk("D", "PDF 업로드 + 파싱", resp.status_code == 200)

    parse_fields = resp.json().get("fields", {})
    chk("D", "파싱 결과 siteName 추출", bool(parse_fields.get("siteName")), str(parse_fields.get("siteName", "")))

    # 로그 저장 확인
    time.sleep(2)
    st, rj = api(sa, "get", "/api/admin/audit-logs?actionType=PDF_CONTRACT_PARSE&pageSize=1")
    chk("D", "파싱 감사 로그 저장", st == 200 and len(rj.get("data", {}).get("items", [])) > 0)

    if new_contract_id:
        st, rj = api(sa, "get", "/api/admin/audit-logs?actionType=CONTRACT_CREATE&pageSize=1")
        chk("D", "계약 생성 감사 로그", st == 200 and len(rj.get("data", {}).get("items", [])) > 0)

    # ═══════════════════════════════════════════════════════
    # E. 출퇴근
    # ═══════════════════════════════════════════════════════
    print("\n=== E. 출퇴근 ===")

    st, rj = api(ad, "get", "/api/admin/attendance?date=2026-04-02")
    chk("E", "출퇴근 목록 조회", st == 200)

    # 출퇴근 기록이 있는지 확인
    att_items = rj.get("data", {}).get("items", rj.get("data", []))
    chk("E", "출퇴근 데이터 조회", isinstance(att_items, list), f"{len(att_items)}건")

    # 출근 등록 — 관리자가 수동 등록하는 API가 있는지 확인
    # attendance 라우트에 POST가 있는지 체크
    st, rj = api(ad, "post", "/api/admin/attendance", json={
        "workerId": worker_id, "siteId": site_id,
        "checkInAt": "2026-04-02T07:00:00+09:00",
    })
    att_id = rj.get("data", {}).get("id") if st == 201 else None
    if st == 201:
        chk("E", "관리자 출근 수동 등록", True)

        # 퇴근 등록
        st2, rj2 = api(ad, "patch", f"/api/admin/attendance/{att_id}", json={
            "checkOutAt": "2026-04-02T16:00:00+09:00",
        })
        chk("E", "관리자 퇴근 수동 등록", st2 == 200)

        # 근무시간 확인
        detail = rj2.get("data", {})
        worked_min = detail.get("workedMinutes")
        chk("E", "근무시간 계산", worked_min is not None, f"{worked_min}분")

        # 공수 확인
        man_day = detail.get("manDay") or detail.get("workUnits")
        chk("E", "공수 계산", man_day is not None, f"공수={man_day}")
    else:
        chk("E", "관리자 출근 수동 등록", False, f"status={st}, {json.dumps(rj, ensure_ascii=False)[:100]}")

    # 예외 조회
    st, rj = api(ad, "get", "/api/admin/attendance/exceptions?date=2026-04-02")
    chk("E", "예외 조회 API", st == 200)

    # ═══════════════════════════════════════════════════════
    # F. 관리자 로그
    # ═══════════════════════════════════════════════════════
    print("\n=== F. 관리자 로그 ===")

    for at in ["PDF_CONTRACT_PARSE", "PDF_CONTRACT_PARSE_FAILED", "CONTRACT_CREATE"]:
        st, rj = api(sa, "get", f"/api/admin/audit-logs?actionType={at}&pageSize=1")
        items = rj.get("data", {}).get("items", [])
        chk("F", f"로그 조회: {at}", st == 200, f"{len(items)}건")

    # 필터: actorUserId
    st, rj = api(sa, "get", "/api/admin/audit-logs?actorUserId=test_admin_001&pageSize=1")
    chk("F", "필터: actorUserId", st == 200)

    # 필터: dateFrom
    st, rj = api(sa, "get", "/api/admin/audit-logs?dateFrom=2026-04-01&pageSize=1")
    chk("F", "필터: dateFrom", st == 200)

    # 권한 없는 계정 차단
    st, _ = api(ad, "get", "/api/admin/audit-logs?pageSize=1")
    chk("F", "ADMIN 로그 차단", st == 403)

    st, _ = api(si, "get", "/api/admin/audit-logs?pageSize=1")
    chk("F", "SITE_ADMIN 로그 차단", st == 403)

    # ═══════════════════════════════════════════════════════
    # Cleanup
    # ═══════════════════════════════════════════════════════
    print("\n=== Cleanup ===")
    if new_contract_id:
        api(ad, "delete", f"/api/admin/contracts/{new_contract_id}")
        print(f"  계약 {new_contract_id[:16]}... 삭제 시도")
    if att_id:
        api(ad, "delete", f"/api/admin/attendance/{att_id}")
        print(f"  출퇴근 {att_id[:16] if att_id else ''}... 삭제 시도")
    if new_worker_id:
        api(ad, "put", f"/api/admin/workers/{new_worker_id}", json={"isActive": False})
        print(f"  근로자 {new_worker_id[:16]}... 비활성화")
    if new_site_id:
        api(ad, "patch", f"/api/admin/sites/{new_site_id}", json={"isActive": False})
        print(f"  현장 {new_site_id[:16]}... 비활성화")

    # ═══════════════════════════════════════════════════════
    # 결과 집계
    # ═══════════════════════════════════════════════════════
    print(f"\n{'='*60}")
    print("전체 기능 점검 결과")
    print(f"{'='*60}")

    groups = {}
    for r in results:
        g = r["group"]
        if g not in groups:
            groups[g] = {"ok": 0, "fail": 0, "items": []}
        if r["ok"]:
            groups[g]["ok"] += 1
        else:
            groups[g]["fail"] += 1
        groups[g]["items"].append(r)

    total_ok = sum(g["ok"] for g in groups.values())
    total_fail = sum(g["fail"] for g in groups.values())

    for g, data in groups.items():
        print(f"\n  [{g}] 성공 {data['ok']}건 / 실패 {data['fail']}건")
        for item in data["items"]:
            if not item["ok"]:
                print(f"    [X] {item['name']}: {item['detail']}")

    print(f"\n  전체: {total_ok} 성공 / {total_fail} 실패")


if __name__ == "__main__":
    main()
