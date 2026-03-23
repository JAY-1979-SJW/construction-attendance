#!/usr/bin/env python3
"""
Phase 1 권한체계 검증 테스트
슈퍼관리자 vs 업체관리자 역할분리 + 데이터 스코프 격리 확인
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
    try:
        data = json.loads(raw)
    except Exception:
        data = {}
    # 쿠키 파싱
    sc = {}
    for h, v in resp.getheaders():
        if h.lower() == "set-cookie":
            for part in v.split(";"):
                part = part.strip()
                if "=" in part and "path" not in part.lower() and "max-age" not in part.lower() and "httponly" not in part.lower() and "samesite" not in part.lower() and "secure" not in part.lower():
                    k2, v2 = part.split("=", 1)
                    sc[k2.strip()] = v2.strip()
    conn.close()
    return resp.status, data, sc

def check(name, cond, detail=""):
    status = "PASS" if cond else "FAIL"
    RESULTS.append((name, status, detail))
    mark = "✓" if cond else "✗"
    print(f"  {mark} [{status}] {name}" + (f" — {detail}" if detail else ""))
    return cond

print("\n" + "="*60)
print("Phase 1 권한체계 검증 테스트")
print("="*60)

# ── 1. 슈퍼관리자 로그인 ──────────────────────────────────────
print("\n[1] 슈퍼관리자 로그인")
st, body, sc = req("POST", "/api/admin/auth/login", {"email": "admin@haehan.com", "password": "admin1234"})
super_cookies = {"admin_token": sc.get("admin_token", "")}
check("슈퍼관리자 로그인 성공", body.get("success") and body.get("data", {}).get("role") == "SUPER_ADMIN")
check("portal 필드 = /admin", body.get("portal") == "/admin")

# ── 2. 업체 생성 (슈퍼관리자) ────────────────────────────────
print("\n[2] 업체 생성 (슈퍼관리자)")
st, body, _ = req("POST", "/api/admin/companies",
    {"companyName": "테스트업체A_검증", "companyType": "PARTNER"},
    cookies=super_cookies)
company_a_id = body.get("data", {}).get("id") or (body.get("data") or {}).get("id")
if not company_a_id and isinstance(body.get("data"), dict):
    company_a_id = body["data"].get("id")
check("업체A 생성", st in (200, 201) and bool(company_a_id), f"id={company_a_id}")

st2, body2, _ = req("POST", "/api/admin/companies",
    {"companyName": "테스트업체B_검증", "companyType": "PARTNER"},
    cookies=super_cookies)
company_b_id = body2.get("data", {}).get("id")
check("업체B 생성", st2 in (200, 201) and bool(company_b_id), f"id={company_b_id}")

# ── 3. 업체 상태 변경 (PATCH) ─────────────────────────────────
print("\n[3] 업체 상태 관리")
if company_a_id:
    st, body, _ = req("PATCH", f"/api/admin/companies/{company_a_id}",
        {"status": "SUSPENDED"}, cookies=super_cookies)
    check("업체 상태 SUSPENDED 변경", body.get("success") and body.get("data", {}).get("status") == "SUSPENDED")

    st, body, _ = req("PATCH", f"/api/admin/companies/{company_a_id}",
        {"status": "ACTIVE"}, cookies=super_cookies)
    check("업체 상태 ACTIVE 복구", body.get("success") and body.get("data", {}).get("status") == "ACTIVE")

# ── 4. 업체 관리자 계정 생성 (멱등: 이미 존재하면 재사용) ────
print("\n[4] 업체 관리자 계정 생성")
def get_or_create_company_admin(name, email, password, company_id, cookies):
    st, body, _ = req("POST", "/api/admin/company-admins",
        {"name": name, "email": email, "password": password, "companyId": company_id},
        cookies=cookies)
    if body.get("success"):
        return True, body.get("message","생성됨")
    if "이미 사용 중인 이메일" in body.get("message",""):
        return True, "기존 계정 재사용"
    return False, body.get("message","")

if company_a_id:
    ok2, msg2 = get_or_create_company_admin("업체A관리자", "cadmin_a_verify@test.com", "Company123!", company_a_id, super_cookies)
    check("업체A 관리자 계정 생성/확인", ok2, msg2)

if company_b_id:
    ok2, msg2 = get_or_create_company_admin("업체B관리자", "cadmin_b_verify@test.com", "Company123!", company_b_id, super_cookies)
    check("업체B 관리자 계정 생성/확인", ok2, msg2)

# ── 5. companyId 없는 COMPANY_ADMIN 생성 실패 ─────────────────
print("\n[5] 잘못된 계정 생성 차단")
st, body, _ = req("POST", "/api/admin/company-admins",
    {"name": "잘못된관리자", "email": "bad_verify@test.com", "password": "Company123!"},
    cookies=super_cookies)
check("companyId 없는 COMPANY_ADMIN 생성 차단", not body.get("success"), body.get("message",""))

# ── 6. 업체A 관리자 로그인 ────────────────────────────────────
print("\n[6] 업체A 관리자 로그인")
st, body, sc = req("POST", "/api/admin/auth/login",
    {"email": "cadmin_a_verify@test.com", "password": "Company123!"})
cadmin_a_cookies = {"admin_token": sc.get("admin_token", "")}
check("업체A 관리자 로그인 성공", body.get("success") and body.get("data", {}).get("role") == "COMPANY_ADMIN")
check("portal 필드 = /company", body.get("portal") == "/company")
check("companyId 포함", bool(body.get("data", {}).get("companyId")))

# ── 7. 업체A 관리자 데이터 스코프 ─────────────────────────────
print("\n[7] 업체A 관리자 — 자기 데이터 접근")
st, body, _ = req("GET", "/api/company/workers", cookies=cadmin_a_cookies)
check("업체A 근로자 목록 조회 성공", body.get("success"), f"workers={len(body.get('data', []))}")

st, body, _ = req("GET", "/api/company/attendance", cookies=cadmin_a_cookies)
check("업체A 출퇴근 조회 성공", body.get("success"))

st, body, _ = req("GET", "/api/company/devices", cookies=cadmin_a_cookies)
check("업체A 기기 목록 조회 성공", body.get("success"))

# ── 8. 업체A 관리자 — /admin API 접근 차단 ───────────────────
print("\n[8] 업체A 관리자 — 플랫폼 API 접근 차단")
st, body, _ = req("GET", "/api/admin/workers", cookies=cadmin_a_cookies)
check("/admin/workers 차단 (403)", st == 403, f"status={st}")

st, body, _ = req("GET", "/api/admin/companies", cookies=cadmin_a_cookies)
check("/admin/companies 차단 (403)", st == 403, f"status={st}")

st, body, _ = req("GET", "/api/admin/attendance", cookies=cadmin_a_cookies)
check("/admin/attendance 차단 (403)", st == 403, f"status={st}")

# ── 9. 슈퍼관리자 전체 조회 ──────────────────────────────────
print("\n[9] 슈퍼관리자 — 전체 데이터 조회")
st, body, _ = req("GET", "/api/admin/workers?limit=5", cookies=super_cookies)
check("슈퍼관리자 전체 근로자 조회", body.get("success"), f"total={body.get('data',{}).get('total',0)}")

st, body, _ = req("GET", "/api/admin/companies", cookies=super_cookies)
check("슈퍼관리자 전체 업체 조회", body.get("success"))

st, body, _ = req("GET", "/api/admin/company-admins", cookies=super_cookies)
check("슈퍼관리자 업체관리자 목록 조회", body.get("success"), f"count={len(body.get('data',[]))}")

# ── 10. 비인증 접근 차단 ─────────────────────────────────────
print("\n[10] 비인증 접근 차단")
st, body, _ = req("GET", "/api/admin/workers")
check("/admin/workers 비인증 → 401", st == 401)
st, body, _ = req("GET", "/api/company/workers")
check("/company/workers 비인증 → 401", st == 401)

# ── 결과 요약 ─────────────────────────────────────────────────
print("\n" + "="*60)
passed = sum(1 for _, s, _ in RESULTS if s == "PASS")
failed = sum(1 for _, s, _ in RESULTS if s == "FAIL")
print(f"결과: {passed} PASS / {failed} FAIL / 총 {len(RESULTS)}개")
print("="*60)

if failed > 0:
    print("\n실패 항목:")
    for name, status, detail in RESULTS:
        if status == "FAIL":
            print(f"  ✗ {name}" + (f" ({detail})" if detail else ""))

sys.exit(0 if failed == 0 else 1)
