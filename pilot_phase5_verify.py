#!/usr/bin/env python3
"""
Phase 5 검증 테스트
4대보험/노임서류 업체관리자 연결 - /company/payroll, /company/insurance, /company/documents
"""
import http.client, json, sys

BASE = "attendance.haehan-ai.kr"
RESULTS = []

def req(method, path, body=None, cookies=None):
    conn = http.client.HTTPSConnection(BASE)
    headers = {"Content-Type": "application/json"}
    if cookies:
        headers["Cookie"] = "; ".join(f"{k}={v}" for k, v in cookies.items())
    conn.request(method, path, json.dumps(body) if body else None, headers)
    resp = conn.getresponse()
    raw = resp.read()
    try: data = json.loads(raw)
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
print("Phase 5 — 4대보험/노임서류 업체 연결 검증")
print("="*60)

# ── 1. 로그인 ────────────────────────────────────────────────
print("\n[1] 로그인")
_, body, sc = req("POST", "/api/admin/auth/login", {"email": "admin@haehan.com", "password": "admin1234"})
sup = {"admin_token": sc.get("admin_token", "")}
check("슈퍼관리자 로그인", body.get("success"))

_, login_body, sc2 = req("POST", "/api/admin/auth/login", {"email": "flag_test_admin@test.com", "password": "Test1234!"})
cadm = {"admin_token": sc2.get("admin_token", "")}
company_id = (login_body.get("data") or {}).get("companyId")
check("업체 관리자 로그인", login_body.get("success") and bool(company_id), f"companyId={company_id}")

# ── 2. 비로그인 차단 확인 ─────────────────────────────────────
print("\n[2] 비인증 접근 차단")
for path in ["/api/company/payroll?monthKey=2026-03",
             "/api/company/insurance?monthKey=2026-03",
             "/api/company/documents"]:
    st, _, _ = req("GET", path)
    check(f"비인증 {path.split('?')[0]} → 401", st == 401, f"status={st}")

# ── 3. feature flag OFF → 403 ────────────────────────────────
print("\n[3] feature flag OFF 시 접근 차단")
# 먼저 모든 플래그 OFF
req("PATCH", f"/api/admin/companies/{company_id}",
    {"featureFlagsJson": {"payrollViewEnabled": False, "insuranceDocsEnabled": False, "laborDocsEnabled": False}},
    cookies=sup)

st, body, _ = req("GET", "/api/company/payroll?monthKey=2026-03", cookies=cadm)
check("payrollViewEnabled=OFF → 403", st == 403, f"status={st}, msg={body.get('message','')[:40]}")

st, body, _ = req("GET", "/api/company/insurance?monthKey=2026-03", cookies=cadm)
check("insuranceDocsEnabled=OFF → 403", st == 403, f"status={st}, msg={body.get('message','')[:40]}")

st, body, _ = req("GET", "/api/company/documents", cookies=cadm)
check("laborDocsEnabled=OFF → 403", st == 403, f"status={st}, msg={body.get('message','')[:40]}")

# ── 4. feature flag ON → 정상 조회 ───────────────────────────
print("\n[4] feature flag ON 후 정상 조회")
req("PATCH", f"/api/admin/companies/{company_id}",
    {"featureFlagsJson": {"payrollViewEnabled": True, "insuranceDocsEnabled": True, "laborDocsEnabled": True}},
    cookies=sup)

# monthKey 필수 검증
st, body, _ = req("GET", "/api/company/payroll", cookies=cadm)
check("monthKey 누락 → 400", st == 400, f"status={st}")

st, body, _ = req("GET", "/api/company/insurance", cookies=cadm)
check("insuranceDocsEnabled monthKey 누락 → 400", st == 400, f"status={st}")

# 정상 조회
MONTH = "2026-03"
st, body, _ = req("GET", f"/api/company/payroll?monthKey={MONTH}", cookies=cadm)
check("payroll 조회 성공", body.get("success"), f"items={len((body.get('data') or {}).get('items') or [])}")

st, body, _ = req("GET", f"/api/company/insurance?monthKey={MONTH}", cookies=cadm)
check("insurance 조회 성공", body.get("success"), f"items={len((body.get('data') or {}).get('items') or [])}")

st, body, _ = req("GET", "/api/company/documents", cookies=cadm)
check("documents 조회 성공", body.get("success"),
      f"months={len((body.get('data') or {}).get('availableMonths') or [])}")

# ── 5. 응답 구조 확인 ─────────────────────────────────────────
print("\n[5] 응답 구조 검증")

# payroll 구조
_, payroll_body, _ = req("GET", f"/api/company/payroll?monthKey={MONTH}", cookies=cadm)
pdata = payroll_body.get("data") or {}
check("payroll items 키 존재", "items" in pdata, str(list(pdata.keys())))
check("payroll totals 키 존재", "totals" in pdata, str(list(pdata.keys())))
check("payroll totalWorkers 키 존재", "totalWorkers" in pdata, str(list(pdata.keys())))
check("payroll monthKey 반환", pdata.get("monthKey") == MONTH, f"monthKey={pdata.get('monthKey')}")

# insurance 구조
_, ins_body, _ = req("GET", f"/api/company/insurance?monthKey={MONTH}", cookies=cadm)
idata = ins_body.get("data") or {}
check("insurance items 키 존재", "items" in idata, str(list(idata.keys())))
check("insurance summary 키 존재", "summary" in idata, str(list(idata.keys())))

summary = idata.get("summary") or {}
for key in ["total", "npEligible", "hiEligible", "eiEligible", "iaEligible", "noSnapshot"]:
    check(f"insurance summary.{key} 존재", key in summary, str(list(summary.keys())))

# documents 구조
_, doc_body, _ = req("GET", "/api/company/documents", cookies=cadm)
ddata = doc_body.get("data") or {}
check("documents availableMonths 키 존재", "availableMonths" in ddata, str(list(ddata.keys())))
check("documents laborSummaries 키 존재", "laborSummaries" in ddata, str(list(ddata.keys())))
check("documents confirmationSummary 키 존재", "confirmationSummary" in ddata, str(list(ddata.keys())))
check("documents totalWorkers 키 존재", "totalWorkers" in ddata, str(list(ddata.keys())))

# ── 6. 플랫폼 관리자(SUPER_ADMIN)는 /company API 접근 불가 ────
print("\n[6] SUPER_ADMIN은 /company/* 접근 차단")
st, body, _ = req("GET", f"/api/company/payroll?monthKey={MONTH}", cookies=sup)
check("SUPER_ADMIN → /company/payroll 차단 (403)", st == 403, f"status={st}, msg={body.get('message','')[:40]}")

st, body, _ = req("GET", f"/api/company/insurance?monthKey={MONTH}", cookies=sup)
check("SUPER_ADMIN → /company/insurance 차단 (403)", st == 403, f"status={st}")

# ── 7. monthKey 형식 검증 ──────────────────────────────────
print("\n[7] monthKey 입력 검증")
st, body, _ = req("GET", "/api/company/payroll?monthKey=2026-3", cookies=cadm)
check("monthKey 형식 오류 → 400", st == 400, f"status={st}")

st, body, _ = req("GET", "/api/company/payroll?monthKey=abcd-ef", cookies=cadm)
check("monthKey 문자 오류 → 400", st == 400, f"status={st}")

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
