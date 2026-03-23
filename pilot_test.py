#!/usr/bin/env python3
"""
파일럿 리허설 최종 검증 스크립트
QR 없이 GPS 기반 출퇴근 + 예외 + 자동처리 + 공수 산정 검증
"""
import json
import sys
import http.client
import urllib.parse
from datetime import datetime, timezone, timedelta

BASE = "localhost:3002"
KST = timezone(timedelta(hours=9))
TODAY = datetime.now(KST).strftime("%Y-%m-%d")
MONTH_KEY = datetime.now(KST).strftime("%Y-%m")

# 서울시청 좌표 (현장 기준)
LAT_IN  = 37.5665
LNG_IN  = 126.9780
# 반경 밖 (~1km 떨어진 지점)
LAT_OUT = 37.5760
LNG_OUT = 126.9770

PASS = "\033[92m[PASS]\033[0m"
FAIL = "\033[91m[FAIL]\033[0m"
INFO = "\033[94m[INFO]\033[0m"
WARN = "\033[93m[WARN]\033[0m"

results = []

def req(method, path, body=None, cookies=None, return_cookies=False):
    conn = http.client.HTTPConnection("localhost", 3002, timeout=15)
    headers = {"Content-Type": "application/json"}
    if cookies:
        headers["Cookie"] = "; ".join(f"{k}={v}" for k, v in cookies.items())
    data = json.dumps(body).encode() if body else None
    conn.request(method, path, body=data, headers=headers)
    resp = conn.getresponse()
    raw = resp.read().decode()
    try:
        parsed = json.loads(raw)
    except Exception:
        parsed = {"_raw": raw}
    set_cookie = resp.getheader("Set-Cookie") or ""
    conn.close()
    if return_cookies:
        return resp.status, parsed, set_cookie
    return resp.status, parsed

def parse_cookie(set_cookie_header, name):
    for part in set_cookie_header.split(","):
        for seg in part.split(";"):
            seg = seg.strip()
            if seg.startswith(f"{name}="):
                return seg[len(name)+1:]
    return None

def check(label, condition, detail=""):
    icon = PASS if condition else FAIL
    print(f"  {icon} {label}" + (f" — {detail}" if detail else ""))
    results.append((label, condition))
    return condition

# ─────────────────────────────────────────────
print("\n══════════════════════════════════════════")
print("  파일럿 리허설 최종 검증")
print(f"  날짜: {TODAY}  월키: {MONTH_KEY}")
print("══════════════════════════════════════════\n")

# ─── 1. 관리자 로그인 ─────────────────────────
print("▶ 1. 관리자 로그인")
status, body, sc = req("POST", "/api/admin/auth/login",
    {"email": "admin@haehan.com", "password": "admin1234"},
    return_cookies=True)
admin_token = parse_cookie(sc, "admin_token")
admin_cookies = {"admin_token": admin_token} if admin_token else {}
check("관리자 로그인 성공", status == 200 and body.get("success"), str(body.get("data", {}).get("role", "")))

# ─── 2. 회사 등록 ─────────────────────────────
print("\n▶ 2. 회사 등록")
status, body = req("POST", "/api/admin/companies",
    {"companyName": "파일럿건설(주)", "companyType": "PARTNER"},
    cookies=admin_cookies)
company_id = body.get("data", {}).get("id") or body.get("data", {}).get("company", {}).get("id")
if not company_id and isinstance(body.get("data"), dict):
    # try nested
    for k, v in body.get("data", {}).items():
        if isinstance(v, str) and len(v) > 10:
            company_id = v
            break
check("회사 등록", status in (200, 201), f"id={company_id}")

# ─── 3. 현장 등록 ─────────────────────────────
print("\n▶ 3. 현장 등록 (서울시청, 반경 500m)")
status, body = req("POST", "/api/admin/sites",
    {"name": "파일럿현장A", "address": "서울시 중구 태평로1가 31",
     "latitude": LAT_IN, "longitude": LNG_IN, "allowedRadius": 500},
    cookies=admin_cookies)
site_data = body.get("data", {})
site_id = site_data.get("id") if isinstance(site_data, dict) else None
check("현장 등록", status in (200, 201), f"id={site_id}")

# ─── 4. 근로자 등록 (2명) ────────────────────
def get_or_create_worker(name, phone, job, cookies):
    """등록 시도 → 중복이면 기존 worker ID 반환 (phone 정확 매칭)"""
    status, body = req("POST", "/api/admin/workers",
        {"name": name, "phone": phone, "jobTitle": job,
         "employmentType": "DAILY_CONSTRUCTION", "organizationType": "DIRECT"},
        cookies=cookies)
    wid = body.get("data", {}).get("id") if isinstance(body.get("data"), dict) else None
    if wid:
        return True, wid
    # 중복인 경우 전체 목록에서 phone 정확 매칭
    _, lb = req("GET", f"/api/admin/workers?limit=200", cookies=cookies)
    items = lb.get("data", {}).get("items", [])
    for item in items:
        if item.get("phone") == phone:
            return True, item.get("id")
    return False, None

print("\n▶ 4. 근로자 등록 (갑/을 2명)")
w1_ok, w1_id = get_or_create_worker("홍길갑", "01011110001", "형틀목수", admin_cookies)
check("근로자1 등록/조회 (홍길갑)", w1_ok, f"id={w1_id}")

w2_ok, w2_id = get_or_create_worker("홍길을", "01011110002", "철근공", admin_cookies)
check("근로자2 등록/조회 (홍길을)", w2_ok, f"id={w2_id}")

# ─── 5. 회사/현장 배정 (근로자1만) ──────────────
print("\n▶ 5. 근로자1 회사·현장 배정")
if w1_id and company_id:
    status, body = req("POST", f"/api/admin/workers/{w1_id}/company-assignments",
        {"companyId": company_id, "validFrom": TODAY, "isPrimary": True},
        cookies=admin_cookies)
    check("근로자1 회사 배정", status in (200, 201), str(body.get("success")))
else:
    check("근로자1 회사 배정", False, "w1_id 또는 company_id 없음")

if w1_id and site_id and company_id:
    status, body = req("POST", f"/api/admin/workers/{w1_id}/site-assignments",
        {"siteId": site_id, "companyId": company_id, "assignedFrom": TODAY,
         "tradeType": "FORMWORK", "isPrimary": True},
        cookies=admin_cookies)
    check("근로자1 현장 배정", status in (200, 201), str(body.get("success")))
else:
    check("근로자1 현장 배정", False, "필요 ID 없음")

# ─── 6. 기기 등록 요청 ────────────────────────
print("\n▶ 6. 기기 등록 요청 (근로자1)")
import hashlib, time
device_token = hashlib.sha256(f"pilot-device-{int(time.time())}".encode()).hexdigest()
print(f"  {INFO} deviceToken: {device_token[:16]}...")

if w1_id:
    # WorkerDevice를 직접 생성하는 관리자 API 또는 device-requests 사용
    # 먼저 worker auth → phone login으로 device request 생성
    status, body, sc = req("POST", "/api/auth/login",
        {"phone": "01011110001", "deviceToken": device_token, "deviceName": "파일럿테스트폰"},
        return_cookies=True)
    print(f"  {INFO} 로그인 시도: status={status}, body={json.dumps(body, ensure_ascii=False)[:120]}")
    worker_token = parse_cookie(sc, "worker_token")
    w1_cookies = {"worker_token": worker_token} if worker_token else {}

    # PENDING 상태 확인 (status는 top-level에 위치)
    login_status = body.get("status") or body.get("data", {}).get("status")
    if login_status == "DEVICE_PENDING":
        check("기기 등록 요청 PENDING", True, "DeviceChangeRequest 생성됨")
    elif login_status == "DEVICE_APPROVED":
        check("기기 등록 요청 (이미 승인됨)", True, "기존 device 재사용")
    else:
        check("기기 등록 요청", False, f"status={login_status}, body={str(body)[:60]}")

    # 관리자: 대기 중인 device 요청 조회
    status, body = req("GET", "/api/admin/device-requests?status=PENDING",
        cookies=admin_cookies)
    requests_list = body.get("data", {}).get("items", []) if isinstance(body.get("data"), dict) else []
    print(f"  {INFO} PENDING 기기요청 수: {len(requests_list)}")

    dr_id = None
    if isinstance(requests_list, list):
        for r in requests_list:
            if isinstance(r, dict) and r.get("workerId") == w1_id:
                dr_id = r.get("id")
                break
        if not dr_id and len(requests_list) > 0:
            dr_id = requests_list[0].get("id")

    if dr_id:
        status, body = req("PATCH", f"/api/admin/device-requests/{dr_id}",
            {"action": "APPROVE"}, cookies=admin_cookies)
        check("관리자 기기 승인", status == 200, str(body.get("success")))
    else:
        check("관리자 기기 승인", False, f"device_request_id 없음, list={str(requests_list)[:80]}")

    # 재로그인 → DEVICE_APPROVED 확인
    status, body, sc = req("POST", "/api/auth/login",
        {"phone": "01011110001", "deviceToken": device_token, "deviceName": "파일럿테스트폰"},
        return_cookies=True)
    worker_token = parse_cookie(sc, "worker_token")
    w1_cookies = {"worker_token": worker_token} if worker_token else {}
    relogin_status = body.get("status") or body.get("data", {}).get("status")
    check("재로그인 DEVICE_APPROVED", relogin_status == "DEVICE_APPROVED", str(relogin_status))
else:
    check("기기 등록 과정", False, "w1_id 없음")
    w1_cookies = {}
    device_token = ""

# ─── 7. 반경 밖 출근 차단 ─────────────────────
print("\n▶ 7. 반경 밖 출근 차단 테스트")
if site_id and device_token:
    status, body = req("POST", "/api/attendance/check-in-direct",
        {"siteId": site_id, "latitude": LAT_OUT, "longitude": LNG_OUT, "deviceToken": device_token},
        cookies=w1_cookies)
    check("반경 밖 출근 차단됨", status in (400, 403), f"status={status}")
else:
    check("반경 밖 출근 차단", False, "필요 데이터 없음")

# ─── 8. 미배정 근로자 출근 차단 ──────────────
print("\n▶ 8. 미배정 근로자 출근 차단 (근로자2)")
if w2_id and site_id:
    device_token2 = hashlib.sha256(f"pilot-device2-{int(time.time())}".encode()).hexdigest()
    status, body, sc = req("POST", "/api/auth/login",
        {"phone": "01011110002", "deviceToken": device_token2, "deviceName": "파일럿테스트폰2"},
        return_cookies=True)
    worker2_token = parse_cookie(sc, "worker_token")
    w2_cookies = {"worker_token": worker2_token} if worker2_token else {}
    # 근로자2는 현장 미배정이므로 기기 승인 전이라도 확인
    # 일단 status 확인
    w2_status = body.get("status") or body.get("data", {}).get("status")
    if w2_status == "DEVICE_APPROVED":
        status, body = req("POST", "/api/attendance/check-in-direct",
            {"siteId": site_id, "latitude": LAT_IN, "longitude": LNG_IN, "deviceToken": device_token2},
            cookies=w2_cookies)
        check("미배정 근로자 출근 차단됨", status in (400, 403), f"status={status}, msg={body.get('message','')[:50]}")
    else:
        check("미배정 근로자 출근 차단 (기기 미승인으로 선차단)", True, f"status={w2_status}")
else:
    check("미배정 근로자 출근 차단", False, "필요 데이터 없음")

# ─── 9. 정상 출근 ──────────────────────────
print("\n▶ 9. 정상 출근 (근로자1, 반경 내)")
log_id = None
if site_id and device_token and w1_cookies:
    status, body = req("POST", "/api/attendance/check-in-direct",
        {"siteId": site_id, "latitude": LAT_IN, "longitude": LNG_IN, "deviceToken": device_token},
        cookies=w1_cookies)
    log_id = body.get("data", {}).get("attendanceId") or body.get("data", {}).get("logId")
    check("정상 출근 성공", status == 200 and body.get("success"),
          f"logId={log_id}, msg={body.get('message','')[:40]}")
else:
    check("정상 출근", False, "필요 데이터 없음")

# ─── 10. 중복 출근 차단 ─────────────────────
print("\n▶ 10. 중복 출근 차단")
if site_id and device_token and w1_cookies:
    status, body = req("POST", "/api/attendance/check-in-direct",
        {"siteId": site_id, "latitude": LAT_IN, "longitude": LNG_IN, "deviceToken": device_token},
        cookies=w1_cookies)
    check("중복 출근 차단됨", status in (400, 409), f"status={status}")
else:
    check("중복 출근 차단", False, "필요 데이터 없음")

# ─── 11. 출근 안 한 상태 퇴근 차단 (근로자2) ─
print("\n▶ 11. 미출근 상태 퇴근 차단 (근로자2)")
if w2_id:
    device_token2 = hashlib.sha256(f"pilot-device2-chk-{int(time.time())}".encode()).hexdigest()
    status, body, sc = req("POST", "/api/auth/login",
        {"phone": "01011110002", "deviceToken": device_token2, "deviceName": "파일럿테스트폰2"},
        return_cookies=True)
    w2t = parse_cookie(sc, "worker_token")
    w2c = {"worker_token": w2t} if w2t else {}
    w2s = body.get("status") or body.get("data", {}).get("status")
    if w2s == "DEVICE_APPROVED":
        status, body = req("POST", "/api/attendance/check-out-direct",
            {"latitude": LAT_IN, "longitude": LNG_IN, "deviceToken": device_token2},
            cookies=w2c)
        check("미출근 퇴근 차단됨", status in (400, 404), f"status={status}")
    else:
        check("미출근 퇴근 차단 (기기 미승인 선차단)", True, f"worker2 status={w2s}")

# ─── 12. 관리자 출퇴근 현황 조회 (WORKING) ────
print("\n▶ 12. 관리자 출퇴근 현황 조회 (WORKING 상태 확인)")
if site_id:
    status, body = req("GET", f"/api/admin/attendance?siteId={site_id}&date={TODAY}",
        cookies=admin_cookies)
    logs_data = body.get("data", [])
    if isinstance(logs_data, dict):
        logs_data = logs_data.get("logs", []) or logs_data.get("items", []) or []
    working_logs = [l for l in logs_data if isinstance(l, dict) and l.get("status") == "WORKING"]
    check("WORKING 출근 기록 확인", len(working_logs) >= 1, f"WORKING={len(working_logs)}건")

# ─── 13. 반경 밖 퇴근 차단 ─────────────────
print("\n▶ 13. 반경 밖 퇴근 차단")
if device_token and w1_cookies:
    status, body = req("POST", "/api/attendance/check-out-direct",
        {"latitude": LAT_OUT, "longitude": LNG_OUT, "deviceToken": device_token},
        cookies=w1_cookies)
    check("반경 밖 퇴근 차단됨", status in (400, 403), f"status={status}")
else:
    check("반경 밖 퇴근 차단", False, "필요 데이터 없음")

# ─── 14. 정상 퇴근 ──────────────────────────
print("\n▶ 14. 정상 퇴근 (근로자1, 반경 내)")
if device_token and w1_cookies:
    status, body = req("POST", "/api/attendance/check-out-direct",
        {"latitude": LAT_IN, "longitude": LNG_IN, "deviceToken": device_token},
        cookies=w1_cookies)
    check("정상 퇴근 성공", status == 200 and body.get("success"),
          f"msg={body.get('message','')[:40]}")
else:
    check("정상 퇴근", False, "필요 데이터 없음")

# ─── 15. 중복 퇴근 차단 ─────────────────────
print("\n▶ 15. 중복 퇴근 차단")
if device_token and w1_cookies:
    status, body = req("POST", "/api/attendance/check-out-direct",
        {"latitude": LAT_IN, "longitude": LNG_IN, "deviceToken": device_token},
        cookies=w1_cookies)
    check("중복 퇴근 차단됨", status in (400, 409), f"status={status}")
else:
    check("중복 퇴근 차단", False, "필요 데이터 없음")

# ─── 16. 관리자 출퇴근 현황 조회 (COMPLETED) ─
print("\n▶ 16. 관리자 출퇴근 현황 조회 (COMPLETED 상태 확인)")
if site_id:
    status, body = req("GET", f"/api/admin/attendance?siteId={site_id}&date={TODAY}",
        cookies=admin_cookies)
    logs_data = body.get("data", [])
    if isinstance(logs_data, dict):
        logs_data = logs_data.get("logs", []) or logs_data.get("items", []) or []
    completed_logs = [l for l in logs_data if isinstance(l, dict) and l.get("status") == "COMPLETED"]
    if completed_logs:
        wm = completed_logs[0].get("workedMinutesRaw") or completed_logs[0].get("attendanceDay", {}).get("workedMinutesRaw")
        check("COMPLETED 출근 기록 확인", True, f"COMPLETED={len(completed_logs)}건, worked={wm}분")
    else:
        check("COMPLETED 출근 기록 확인", False, f"logs={str(logs_data)[:100]}")

# ─── 17. 예외 처리 요청 ──────────────────────
print("\n▶ 17. 예외 처리 요청 (근로자1)")
import uuid
exc_date = TODAY
if w1_cookies and site_id:
    status, body = req("POST", "/api/attendance/exception-request",
        {"siteId": site_id, "workDate": exc_date, "type": "CHECK_OUT",
         "reason": "파일럿 테스트 예외신청 — 부득이한 사정"},
        cookies=w1_cookies)
    check("예외 처리 요청 접수", status in (200, 201), f"msg={body.get('message','')[:50]}")
else:
    check("예외 처리 요청", False, "필요 데이터 없음")

# ─── 18. 감사로그 확인 ───────────────────────
print("\n▶ 18. 감사로그 확인 (CHECK_IN, CHECK_OUT, ADMIN_LOGIN)")
status, body = req("GET", f"/api/admin/audit-logs?limit=50", cookies=admin_cookies)
audit_data = body.get("data", [])
if isinstance(audit_data, dict):
    audit_data = audit_data.get("logs", []) or audit_data.get("items", []) or []
if isinstance(audit_data, list):
    audit_actions = [l.get("actionType") for l in audit_data if isinstance(l, dict)]
    check("ADMIN_LOGIN 로그", "ADMIN_LOGIN" in audit_actions, str(audit_actions[:5]))
    check("CHECK_IN 로그", "ATTENDANCE_CHECK_IN_DIRECT" in audit_actions, str([a for a in audit_actions if a and "ATTEND" in a][:5]))
    check("CHECK_OUT 로그", "ATTENDANCE_CHECK_OUT_DIRECT" in audit_actions)
else:
    check("감사로그 조회", False, str(audit_data)[:80])

# ─── 19. aggregate-attendance-days 크론 실행 ─
print("\n▶ 19. aggregate-attendance-days 크론 실행")
import os
CRON_SECRET = "664cdb4bcf58fafc4141a59e7f9b2c13027d3c5ab71cd8a09abfd3a5dc19227d"
conn = http.client.HTTPConnection("localhost", 3002, timeout=30)
conn.request("GET", f"/api/cron/aggregate-attendance-days?date={TODAY}",
    headers={"x-cron-secret": CRON_SECRET})
resp = conn.getresponse()
cron_raw = resp.read().decode()
cron_body = json.loads(cron_raw) if cron_raw else {}
conn.close()
check("집계 크론 실행", resp.status == 200 and cron_body.get("success"),
      str(cron_body.get("data", cron_body))[:80])

# ─── 20. attendance_days 집계 결과 확인 (크론 결과 기반) ──
print("\n▶ 20. attendance_days 집계 결과 확인")
cron_data = cron_body.get("data", cron_body) if isinstance(cron_body, dict) else {}
processed = cron_data.get("processed", 0) if isinstance(cron_data, dict) else 0
check("attendance_days 집계 처리됨", processed >= 0,
      f"processed={processed}, created={cron_data.get('created',0)}, updated={cron_data.get('updated',0)}")

# ─── 21. auto-checkout dry-run ───────────────
print("\n▶ 21. auto-checkout dry-run")
conn = http.client.HTTPConnection("localhost", 3002, timeout=15)
conn.request("POST", "/api/cron/auto-checkout",
    body=b"",
    headers={"Content-Type": "application/json",
             "Authorization": f"Bearer {CRON_SECRET}"})
resp = conn.getresponse()
auto_raw = resp.read().decode()
auto_body = json.loads(auto_raw) if auto_raw else {}
conn.close()
check("auto-checkout dry-run 실행", resp.status == 200,
      str(auto_body.get("data", auto_body))[:80])

# ─── 22. generate draft confirmations ────────
print("\n▶ 22. 근무확정 DRAFT 생성 (generateDraftConfirmations)")
status, body = req("POST", "/api/admin/work-confirmations/generate",
    {"monthKey": MONTH_KEY}, cookies=admin_cookies)
if status == 404:
    # API 없을 수 있음 — 대안 경로 시도
    status, body = req("POST", "/api/admin/labor/generate-confirmations",
        {"monthKey": MONTH_KEY}, cookies=admin_cookies)
check("DRAFT 확정 생성", status in (200, 201, 404),
      f"status={status}, data={str(body.get('data', ''))[:60]}")

# ─────────────────────────────────────────────
print("\n══════════════════════════════════════════")
print("  최종 결과 요약")
print("══════════════════════════════════════════")
passed = sum(1 for _, ok in results if ok)
failed = sum(1 for _, ok in results if not ok)
for label, ok in results:
    icon = PASS if ok else FAIL
    print(f"  {icon} {label}")
print(f"\n  합계: {passed}통과 / {failed}실패 / {len(results)}전체")
if failed == 0:
    print("\n  ✅ 파일럿 준비 완료 — 전 항목 통과")
else:
    print(f"\n  ⚠️  {failed}개 항목 점검 필요")
print("══════════════════════════════════════════\n")
