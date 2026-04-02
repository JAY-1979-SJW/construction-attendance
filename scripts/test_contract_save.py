"""
계약 저장 로직 E2E 검증 스크립트
3건 실제 저장 → DB 조회 → 검증 → 삭제(cleanup)
"""
import time, json, sys
import requests
import jwt as pyjwt

S = "https://attendance.haehan-ai.kr"
JWT_SECRET = "haehan-jwt-secret-2026-construction"
ADMIN_ID = "test_admin_001"


def make_session():
    token = pyjwt.encode(
        {"sub": ADMIN_ID, "type": "admin", "role": "ADMIN",
         "iat": int(time.time()), "exp": int(time.time()) + 86400},
        JWT_SECRET, algorithm="HS256",
    )
    sess = requests.Session()
    sess.cookies.set("admin_token", token, domain="attendance.haehan-ai.kr")
    return sess


def api(sess, method, path, **kwargs):
    r = getattr(sess, method)(f"{S}{path}", **kwargs)
    return r.status_code, r.json()


def main():
    sess = make_session()

    # ── 준비: 근로자/현장 목록 ──
    _, wj = api(sess, "get", "/api/admin/workers?pageSize=200")
    workers = wj.get("data", {}).get("items", wj.get("data", []))
    worker = workers[0]  # 첫 번째 근로자
    worker_id = worker["id"]
    worker_name = worker["name"]
    print(f"테스트 근로자: {worker_name} ({worker_id[:16]}...)")

    _, sj = api(sess, "get", "/api/admin/sites")
    sites = sj.get("data", {}).get("items", [])

    # 기존 현장 선택용
    existing_site = next((s for s in sites if "E2E" in s["name"] or "검증" in s["name"]), sites[0])
    print(f"기존 현장: {existing_site['name']} ({existing_site['id'][:16]}...)")

    created_contracts = []
    created_site_id = None

    try:
        # ════════════════════════════════════════════════════════════════
        # 테스트 1: 기존 현장 선택 → 저장
        # ════════════════════════════════════════════════════════════════
        print(f"\n{'='*60}")
        print("테스트 1: 기존 현장 선택 후 저장")
        print(f"{'='*60}")

        payload1 = {
            "workerId": worker_id,
            "siteId": existing_site["id"],
            "contractKind": "EMPLOYMENT",
            "contractTemplateType": "DAILY_EMPLOYMENT",
            "startDate": "2026-04-01",
            "endDate": "2026-06-30",
            "dailyWage": 250000,
            "checkInTime": "08:00",
            "checkOutTime": "17:00",
            "laborRelationType": "DIRECT_EMPLOYEE",
            "siteAddress": existing_site.get("address", ""),
        }
        print(f"  payload.siteId = {payload1['siteId']}")
        print(f"  payload.startDate = {payload1['startDate']}")
        print(f"  payload.endDate = {payload1['endDate']}")

        status, rj = api(sess, "post", "/api/admin/contracts", json=payload1)
        print(f"  응답: status={status}")

        if status == 201 and rj.get("success"):
            c = rj["data"]
            cid = c["id"]
            created_contracts.append(cid)
            print(f"  저장 성공: contractId={cid[:16]}...")
            print(f"  DB siteId  = {c.get('siteId')}")
            print(f"  DB site.name = {c.get('site', {}).get('name', 'null')}")
            print(f"  DB startDate = {c.get('startDate')}")
            print(f"  DB endDate   = {c.get('endDate')}")

            # 검증
            site_ok = c.get("siteId") == existing_site["id"]
            start_ok = c.get("startDate", "").startswith("2026-04-01")
            end_ok = (c.get("endDate") or "").startswith("2026-06-30")
            site_name_ok = c.get("site", {}).get("name") == existing_site["name"]

            print(f"  [{'O' if site_ok else 'X'}] siteId 일치")
            print(f"  [{'O' if site_name_ok else 'X'}] site.name 일치")
            print(f"  [{'O' if start_ok else 'X'}] startDate 일치")
            print(f"  [{'O' if end_ok else 'X'}] endDate 일치")

            # GET 상세 조회 검증
            status2, detail = api(sess, "get", f"/api/admin/contracts?workerId={worker_id}&limit=1")
            if status2 == 200 and detail.get("data"):
                latest = detail["data"][0] if isinstance(detail["data"], list) else detail["data"]
                print(f"  GET 조회: siteId={latest.get('siteId')}, site={latest.get('site',{}).get('name','null')}")
        else:
            print(f"  저장 실패: {json.dumps(rj, ensure_ascii=False)[:200]}")

        # ════════════════════════════════════════════════════════════════
        # 테스트 2: 인라인 신규 현장 생성 → 저장
        # ════════════════════════════════════════════════════════════════
        print(f"\n{'='*60}")
        print("테스트 2: 인라인 신규 현장 생성 후 저장")
        print(f"{'='*60}")

        # 2-1) 현장 생성
        new_site_name = f"계약저장검증현장_{int(time.time()) % 100000}"
        new_site_addr = "서울특별시 종로구 세종대로 209"

        # geocode
        status_g, gj = api(sess, "get", f"/api/admin/geocode?address={new_site_addr}")
        lat = gj.get("data", {}).get("lat")
        lng = gj.get("data", {}).get("lng")
        print(f"  geocode: lat={lat}, lng={lng}")

        # 현장 생성
        status_s, sj2 = api(sess, "post", "/api/admin/sites", json={
            "name": new_site_name,
            "address": new_site_addr,
            "latitude": lat,
            "longitude": lng,
            "allowedRadius": 100,
            "notes": "계약 등록 중 직접 생성",
        })
        created_site_id = sj2.get("data", {}).get("id")
        print(f"  현장 생성: status={status_s}, id={created_site_id and created_site_id[:16]}...")

        # 2-2) 계약 저장 (새 현장 id 사용)
        payload2 = {
            "workerId": worker_id,
            "siteId": created_site_id,
            "contractKind": "EMPLOYMENT",
            "contractTemplateType": "DAILY_EMPLOYMENT",
            "startDate": "2026-07-01",
            "endDate": "2026-09-30",
            "dailyWage": 280000,
            "checkInTime": "07:30",
            "checkOutTime": "16:30",
            "laborRelationType": "DIRECT_EMPLOYEE",
            "siteAddress": new_site_addr,
        }
        print(f"  payload.siteId = {payload2['siteId']}")

        status, rj = api(sess, "post", "/api/admin/contracts", json=payload2)
        print(f"  응답: status={status}")

        if status == 201 and rj.get("success"):
            c = rj["data"]
            cid = c["id"]
            created_contracts.append(cid)
            print(f"  저장 성공: contractId={cid[:16]}...")
            print(f"  DB siteId    = {c.get('siteId')}")
            print(f"  DB site.name = {c.get('site', {}).get('name', 'null')}")
            print(f"  DB startDate = {c.get('startDate')}")
            print(f"  DB endDate   = {c.get('endDate')}")

            site_ok = c.get("siteId") == created_site_id
            site_name_ok = c.get("site", {}).get("name") == new_site_name
            start_ok = c.get("startDate", "").startswith("2026-07-01")
            end_ok = (c.get("endDate") or "").startswith("2026-09-30")

            print(f"  [{'O' if site_ok else 'X'}] siteId 일치 (새 현장)")
            print(f"  [{'O' if site_name_ok else 'X'}] site.name 일치")
            print(f"  [{'O' if start_ok else 'X'}] startDate 일치")
            print(f"  [{'O' if end_ok else 'X'}] endDate 일치")
        else:
            print(f"  저장 실패: {json.dumps(rj, ensure_ascii=False)[:200]}")

        # ════════════════════════════════════════════════════════════════
        # 테스트 3: PDF 파싱 후 자동 매칭 실패 → 수동 보정 → 저장
        # ════════════════════════════════════════════════════════════════
        print(f"\n{'='*60}")
        print("테스트 3: PDF 파싱 + 수동 보정 후 저장")
        print(f"{'='*60}")

        # 3-1) PDF 업로드 & 파싱
        from fpdf import FPDF
        import tempfile, os

        pdf = FPDF()
        pdf.add_page()
        pdf.add_font("K", "", r"C:\Windows\Fonts\malgun.ttf")
        pdf.set_font("K", size=11)
        for line in [
            "근로계약서",
            "사업주: (주)테스트건설  대표자: 홍길동",
            "근로자: 서주현  생년월일: 1990-01-01",
            "현장명: 가상현장 테스트공사",
            "현장주소: 가상시 가상구 가상동 999",
            "계약기간: 2026-10-01 ~ 2026-12-31",
            "일당: 300,000원",
            "계약형태: 일용",
        ]:
            pdf.cell(0, 8, line, new_x="LMARGIN", new_y="NEXT")

        tmp = tempfile.mktemp(suffix=".pdf")
        pdf.output(tmp)
        print(f"  PDF 생성: {os.path.getsize(tmp)} bytes")

        with open(tmp, "rb") as f:
            r = sess.post(f"{S}/api/admin/documents/parse-pdf",
                          files={"file": ("contract.pdf", f, "application/pdf")})
        parse_result = r.json()
        fields = parse_result.get("fields", {})
        print(f"  파싱 결과: siteName='{fields.get('siteName')}', startDate='{fields.get('startDate')}', endDate='{fields.get('endDate')}'")

        # 3-2) geocode 실패 확인 (가상 주소)
        status_g, gj = api(sess, "get", f"/api/admin/geocode?address={fields.get('siteAddress','')}")
        geo_failed = status_g != 200 or not gj.get("success")
        print(f"  geocode 결과: status={status_g}, 실패={geo_failed}")

        # 3-3) 수동 보정: 기존 현장 선택 + 날짜 수정
        manual_site = existing_site
        manual_start = fields.get("startDate") or "2026-10-01"
        manual_end = fields.get("endDate") or "2026-12-31"

        payload3 = {
            "workerId": worker_id,
            "siteId": manual_site["id"],  # 수동으로 기존 현장 선택
            "contractKind": "EMPLOYMENT",
            "contractTemplateType": "DAILY_EMPLOYMENT",
            "startDate": manual_start,
            "endDate": manual_end,
            "dailyWage": 300000,
            "checkInTime": "08:00",
            "checkOutTime": "17:00",
            "laborRelationType": "DIRECT_EMPLOYEE",
            "siteAddress": manual_site.get("address", ""),
            "notes": f"PDF 파싱 원본 현장: {fields.get('siteName','')} / geocode 실패 → 수동 현장 선택",
        }
        print(f"  수동 보정 payload: siteId={payload3['siteId'][:16]}..., startDate={payload3['startDate']}, endDate={payload3['endDate']}")

        status, rj = api(sess, "post", "/api/admin/contracts", json=payload3)
        print(f"  응답: status={status}")

        if status == 201 and rj.get("success"):
            c = rj["data"]
            cid = c["id"]
            created_contracts.append(cid)
            print(f"  저장 성공: contractId={cid[:16]}...")
            print(f"  DB siteId    = {c.get('siteId')}")
            print(f"  DB site.name = {c.get('site', {}).get('name', 'null')}")
            print(f"  DB startDate = {c.get('startDate')}")
            print(f"  DB endDate   = {c.get('endDate')}")
            print(f"  DB notes     = {(c.get('notes') or '')[:80]}")

            site_ok = c.get("siteId") == manual_site["id"]
            start_ok = c.get("startDate", "").startswith(manual_start)
            end_ok = (c.get("endDate") or "").startswith(manual_end)

            print(f"  [{'O' if site_ok else 'X'}] siteId 일치 (수동 선택)")
            print(f"  [{'O' if start_ok else 'X'}] startDate 일치")
            print(f"  [{'O' if end_ok else 'X'}] endDate 일치")
        else:
            print(f"  저장 실패: {json.dumps(rj, ensure_ascii=False)[:200]}")

        # ════════════════════════════════════════════════════════════════
        # 목록 조회 검증
        # ════════════════════════════════════════════════════════════════
        print(f"\n{'='*60}")
        print("목록 조회 검증")
        print(f"{'='*60}")

        status, lj = api(sess, "get", f"/api/admin/contracts?workerId={worker_id}&limit=10")
        if status == 200:
            contracts_list = lj.get("data", [])
            print(f"  {worker_name}의 계약 수: {len(contracts_list)}건")
            for cc in contracts_list[:5]:
                sid = cc.get("siteId") or "null"
                sname = cc.get("site", {}).get("name", "null") if cc.get("site") else "null"
                print(f"  - {cc['id'][:12]}... | site={sname} | start={cc.get('startDate','?')[:10]} | end={(cc.get('endDate') or '?')[:10]}")

    finally:
        # ════════════════════════════════════════════════════════════════
        # Cleanup: 테스트 계약 삭제
        # ════════════════════════════════════════════════════════════════
        print(f"\n{'='*60}")
        print("Cleanup")
        print(f"{'='*60}")
        for cid in created_contracts:
            status, _ = api(sess, "delete", f"/api/admin/contracts/{cid}")
            print(f"  계약 {cid[:16]}... 삭제: {status}")
        if created_site_id:
            status, _ = api(sess, "delete", f"/api/admin/sites/{created_site_id}")
            print(f"  현장 {created_site_id[:16]}... 삭제: {status}")

    # ════════════════════════════════════════════════════════════════
    # 최종 집계
    # ════════════════════════════════════════════════════════════════
    print(f"\n{'='*60}")
    print("최종 집계")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
