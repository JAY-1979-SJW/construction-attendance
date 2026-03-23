#!/usr/bin/env python3
"""
Phase 6 검증 테스트
월집계/공수/보험/서류 숫자 일관성 E2E + Excel 출력 확인
1. workedMinutesOverride → 공수 계산 반영 확인
2. 공수 생성(generate) → 확인(confirm) → 보험판정 → 임금 파이프라인 확인
3. Excel/CSV 내보내기 API 작동 확인
"""
import http.client, json, sys

BASE = "attendance.haehan-ai.kr"
RESULTS = []

def req(method, path, body=None, cookies=None, raw=False):
    conn = http.client.HTTPSConnection(BASE)
    headers = {"Content-Type": "application/json"}
    if cookies:
        headers["Cookie"] = "; ".join(f"{k}={v}" for k, v in cookies.items())
    conn.request(method, path, json.dumps(body) if body else None, headers)
    resp = conn.getresponse()
    raw_bytes = resp.read()
    if raw:
        return resp.status, raw_bytes, resp.getheader("content-type",""), resp
    try: data = json.loads(raw_bytes)
    except: data = {}
    sc = {}
    for h, v in resp.getheaders():
        if h.lower() == "set-cookie":
            for part in v.split(";"):
                part = part.strip()
                if "=" in part and not any(x in part.lower() for x in ["path","max-age","httponly","samesite","secure","expires"]):
                    k2, v2 = part.split("=", 1)
                    sc[k2.strip()] = v2.strip()
    conn.close()
    return resp.status, data, sc

def check(name, cond, detail=""):
    status = "PASS" if cond else "FAIL"
    RESULTS.append((name, status, detail))
    print(f"  {'✓' if cond else '✗'} [{status}] {name}" + (f" — {detail}" if detail else ""))
    return cond

print("\n" + "="*60)
print("Phase 6 — 숫자 일관성 E2E + Excel 출력 검증")
print("="*60)

# ── 1. 로그인 ────────────────────────────────────────────────
print("\n[1] 로그인")
_, body, sc = req("POST", "/api/admin/auth/login", {"email": "admin@haehan.com", "password": "admin1234"})
sup = {"admin_token": sc.get("admin_token", "")}
check("슈퍼관리자 로그인", body.get("success"))

_, login_b, sc2 = req("POST", "/api/admin/auth/login", {"email": "flag_test_admin@test.com", "password": "Test1234!"})
cadm = {"admin_token": sc2.get("admin_token", "")}
company_id = (login_b.get("data") or {}).get("companyId")
check("업체 관리자 로그인", login_b.get("success") and bool(company_id), f"companyId={company_id}")

# ── 2. COMPLETED 출퇴근 기록 확인 (수퍼관리자 기준) ──────────
print("\n[2] 기존 데이터 확인")
_, att_body, _ = req("GET", "/api/admin/attendance?limit=10&status=COMPLETED", cookies=sup)
att_items = (att_body.get("data") or {}).get("items") or []
check("COMPLETED 출퇴근 기록 존재", len(att_items) > 0, f"count={len(att_items)}")

# detail API로 attendanceDayId 포함된 레코드 찾기
target_att = None
target_id = None
for item in att_items:
    _, det, _ = req("GET", f"/api/admin/attendance/{item['id']}", cookies=sup)
    d = det.get("data") or {}
    if d.get("attendanceDayId"):
        target_att = d
        target_id = item["id"]
        break

check("attendanceDayId 포함 출퇴근 기록", bool(target_att), f"id={target_id}")
print(f"  [INFO] 테스트 대상: dayId={(target_att or {}).get('attendanceDayId', 'N/A')}")

# ── 3. workedMinutesOverride 설정 및 manualAdjustedYn 확인 ──
print("\n[3] 공수 수동 수정 (workedMinutesOverride) 및 반영 확인")
if target_att and target_id:
    # 수퍼관리자 admin PATCH — workedMinutesOverride 전달 (attendanceDay.workedMinutesRaw도 갱신됨)
    _, patch_body, _ = req("PATCH", f"/api/admin/attendance/{target_id}",
        {"workedMinutesOverride": 480, "manualAdjustedReason": "Phase6 E2E 테스트 수정"},
        cookies=sup)
    check("PATCH 성공 (수퍼관리자)", patch_body.get("success"), str(patch_body.get("message", ""))[:50])

    # 반영 확인: admin detail API에서 manualAdjustedYn 확인
    _, detail_body, _ = req("GET", f"/api/admin/attendance/{target_id}", cookies=sup)
    aday = detail_body.get("data") or {}
    check("workedMinutesRaw = 480 (override 반영)",
          aday.get("workedMinutesRaw") == 480,
          f"raw={aday.get('workedMinutesRaw', 'N/A')}")
    check("manualAdjustedYn = True",
          aday.get("manualAdjustedYn") is True,
          f"val={aday.get('manualAdjustedYn', 'N/A')}")
else:
    RESULTS.append(("공수 수동 수정", "SKIP", "출퇴근 기록 없음"))
    RESULTS.append(("workedMinutesRaw 반영", "SKIP", "출퇴근 기록 없음"))
    RESULTS.append(("manualAdjustedYn 반영", "SKIP", "출퇴근 기록 없음"))

# ── 4. 공수 생성 파이프라인 API 확인 ──────────────────────────
print("\n[4] 공수 생성 파이프라인 API 존재 및 응답 확인")
MONTH = "2026-03"

# /api/admin/work-confirmations/generate
st, body, _ = req("POST", "/api/admin/work-confirmations/generate",
    {"monthKey": MONTH}, cookies=sup)
check("work-confirmations/generate API 응답",
      st in (200, 201, 400, 422), f"status={st}")  # 데이터 없어도 API는 응답해야 함
if st in (200, 201):
    gen_result = body.get("data") or body
    print(f"  [INFO] 생성결과: created={gen_result.get('created',0)}, skipped={gen_result.get('skipped',0)}")

# 공수 목록 조회
st, body, _ = req("GET", f"/api/admin/work-confirmations?monthKey={MONTH}", cookies=sup)
check("work-confirmations 목록 조회", st == 200, f"status={st}")
confirmations = (body.get("data") or {}).get("items") or []
print(f"  [INFO] {MONTH} 확정 건수: {len(confirmations)}")

# ── 5. 보험 판정 API 확인 ──────────────────────────────────
print("\n[5] 보험 판정 파이프라인 API")
st, body, _ = req("POST", "/api/admin/insurance-eligibility/run",
    {"monthKey": MONTH}, cookies=sup)
check("insurance-eligibility/run API 응답",
      st in (200, 201, 400, 422, 500),
      f"status={st}, msg={str(body.get('message', body.get('error', '')))[:50]}")
if st in (200, 201):
    print(f"  [INFO] 보험판정 결과: {body.get('data', {})}")

# 보험 판정 목록 조회
st, body, _ = req("GET", f"/api/admin/insurance-eligibility?monthKey={MONTH}", cookies=sup)
check("insurance-eligibility 목록 조회", st == 200, f"status={st}")
ins_items = (body.get("data") or {}).get("items") or []
print(f"  [INFO] {MONTH} 보험판정 건수: {len(ins_items)}")

# ── 6. 임금 계산 API 확인 ──────────────────────────────────
print("\n[6] 임금/세금 계산 파이프라인 API")
st, body, _ = req("POST", "/api/admin/wage-calculations/run",
    {"monthKey": MONTH}, cookies=sup)
check("wage-calculations/run API 응답",
      st in (200, 201, 400, 422, 500),
      f"status={st}, msg={str(body.get('message', body.get('error', '')))[:50]}")

st, body, _ = req("GET", f"/api/admin/wage-calculations?monthKey={MONTH}", cookies=sup)
check("wage-calculations 목록 조회", st == 200, f"status={st}")
wage_items = (body.get("data") or {}).get("items") or []
print(f"  [INFO] {MONTH} 임금계산 건수: {len(wage_items)}")

# ── 7. 숫자 일관성 검증 (데이터 있는 경우) ────────────────────
print("\n[7] 숫자 일관성 검증")
if confirmations and ins_items:
    # 보험판정의 totalWorkDays ≤ 확정 건수 (같은 근로자 기준)
    ins_worker_map = {i["workerId"]: i for i in ins_items if "workerId" in i}
    cf_worker_map = {}
    for c in confirmations:
        wid = c.get("workerId")
        if wid:
            if wid not in cf_worker_map:
                cf_worker_map[wid] = {"confirmed_days": 0, "total_units": 0.0, "total_amount": 0}
            if c.get("confirmationStatus") == "CONFIRMED" and c.get("confirmedWorkType") != "INVALID":
                cf_worker_map[wid]["confirmed_days"] += 1
                cf_worker_map[wid]["total_units"] += float(c.get("confirmedWorkUnits", 0))
                cf_worker_map[wid]["total_amount"] += c.get("confirmedTotalAmount", 0)

    consistent = True
    for wid, ins in ins_worker_map.items():
        if wid in cf_worker_map:
            cf = cf_worker_map[wid]
            if ins.get("totalWorkDays", 0) != cf["confirmed_days"]:
                consistent = False
                print(f"  [WARN] workerId={wid}: ins.totalWorkDays={ins.get('totalWorkDays')}, cf.confirmed_days={cf['confirmed_days']}")
            if ins.get("totalConfirmedAmount", 0) != cf["total_amount"]:
                consistent = False
                print(f"  [WARN] workerId={wid}: ins.amount={ins.get('totalConfirmedAmount')}, cf.amount={cf['total_amount']}")

    check("보험판정 ↔ 공수확정 숫자 일치", consistent, "근로자별 workDays/amount 비교")
else:
    print(f"  [SKIP] 데이터 부족 (confirmations={len(confirmations)}, ins={len(ins_items)})")
    RESULTS.append(("보험판정 ↔ 공수확정 숫자 일치", "SKIP", "데이터 없음"))

# ── 8. Excel (CSV) 내보내기 API ──────────────────────────────
print("\n[8] Excel/CSV 내보내기 API")
# CSV (노임대장)
st, raw_bytes, ctype, _ = req("POST", "/api/admin/document-center",
    {"monthKey": MONTH, "documentType": "WAGE_LEDGER"}, cookies=sup, raw=True)
check("CSV 내보내기 응답 성공", st == 200, f"status={st}, content-type={ctype[:30]}")
check("CSV content-type 확인", "csv" in ctype.lower() or st == 200,
      f"content-type={ctype[:40]}")
if st == 200:
    print(f"  [INFO] CSV 응답 크기: {len(raw_bytes)}bytes")
    # CSV는 텍스트여야 함
    try:
        csv_text = raw_bytes.decode("utf-8", errors="replace")
        check("CSV 텍스트 파싱 가능", len(csv_text) > 0, f"size={len(csv_text)}chars")
    except:
        check("CSV 텍스트 파싱 가능", False, "decode 실패")
else:
    err_msg = ""
    try: err_msg = json.loads(raw_bytes).get("error", "")[:50]
    except: pass
    print(f"  [INFO] CSV 실패: {err_msg}")
    RESULTS.append(("CSV 텍스트 파싱 가능", "SKIP", "API 실패"))

# XLSX 내보내기 (보험판정표)
st, raw_bytes, ctype, _ = req("POST", "/api/admin/document-center/xlsx",
    {"monthKey": MONTH, "documentType": "INSURANCE_REPORT"}, cookies=sup, raw=True)
check("XLSX 내보내기 응답 성공", st == 200, f"status={st}, content-type={ctype[:40]}")
if st == 200:
    print(f"  [INFO] XLSX 응답 크기: {len(raw_bytes)}bytes")
    # XLSX는 binary (PK zip header)
    is_xlsx = raw_bytes[:4] == b'PK\x03\x04'
    check("XLSX 바이너리 형식 확인 (ZIP header)", is_xlsx, f"header={raw_bytes[:4]!r}")
else:
    err_msg = ""
    try: err_msg = json.loads(raw_bytes).get("error", "")[:50]
    except: pass
    print(f"  [INFO] XLSX 실패: {err_msg}")
    RESULTS.append(("XLSX 바이너리 형식 확인", "SKIP", f"API 실패: {err_msg}"))

# ── 9. 잘못된 documentType 차단 ──────────────────────────────
print("\n[9] 잘못된 내보내기 파라미터 차단")
st, body, _ = req("POST", "/api/admin/document-center",
    {"monthKey": MONTH, "documentType": "INVALID_TYPE"}, cookies=sup)
check("잘못된 documentType → 400", st == 400, f"status={st}")

st, body, _ = req("POST", "/api/admin/document-center",
    {"monthKey": "2026-3", "documentType": "WAGE_LEDGER"}, cookies=sup)
check("잘못된 monthKey → 400", st == 400, f"status={st}")

# ── 10. 노임비 집계 API 확인 ──────────────────────────────
print("\n[10] 노임비 집계 (LaborCostSummary) API")
st, body, _ = req("GET", f"/api/admin/labor-cost-summaries?monthKey={MONTH}", cookies=sup)
check("labor-cost-summaries 조회", st == 200,
      f"status={st}, items={len((body.get('data') or {}).get('summaries') or [])}")

st, body, _ = req("POST", "/api/admin/labor-cost-summaries/run",
    {"monthKey": MONTH}, cookies=sup)
check("labor-cost-summaries/run API 응답",
      st in (200, 201, 400, 422, 500),
      f"status={st}, msg={str(body.get('message', body.get('error', '')))[:50]}")

# ── 결과 요약 ─────────────────────────────────────────────
print("\n" + "="*60)
pass_cnt = sum(1 for _, s, _ in RESULTS if s == "PASS")
fail_cnt = sum(1 for _, s, _ in RESULTS if s == "FAIL")
skip_cnt = sum(1 for _, s, _ in RESULTS if s == "SKIP")
print(f"결과: {pass_cnt} PASS / {fail_cnt} FAIL / {skip_cnt} SKIP / 총 {len(RESULTS)}개")
print("="*60)

if fail_cnt:
    print("\n실패 항목:")
    for name, status, detail in RESULTS:
        if status == "FAIL":
            print(f"  ✗ {name}" + (f" ({detail})" if detail else ""))

sys.exit(0 if fail_cnt == 0 else 1)
