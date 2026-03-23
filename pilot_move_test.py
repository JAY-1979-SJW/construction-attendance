#!/usr/bin/env python3
"""
현장 이동 기능 검증 스크립트
8단계 테스트 시나리오 전체 실행
"""
import json, http.client, hashlib, time
from datetime import datetime, timezone, timedelta

KST  = timezone(timedelta(hours=9))
TODAY = datetime.now(KST).strftime("%Y-%m-%d")
CRON_SECRET = '664cdb4bcf58fafc4141a59e7f9b2c13027d3c5ab71cd8a09abfd3a5dc19227d'

PASS = "\033[92m[PASS]\033[0m"
FAIL = "\033[91m[FAIL]\033[0m"
INFO = "\033[94m[INFO]\033[0m"

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

def parse_cookie(sc, name):
    for part in sc.split(","):
        for seg in part.split(";"):
            seg = seg.strip()
            if seg.startswith(f"{name}="):
                return seg[len(name)+1:]
    return None

def check(label, ok, detail=""):
    icon = PASS if ok else FAIL
    print(f"  {icon} {label}" + (f" — {detail}" if detail else ""))
    results.append((label, ok))
    return ok

print("\n══════════════════════════════════════════")
print("  현장 이동 기능 검증")
print(f"  날짜: {TODAY}")
print("══════════════════════════════════════════\n")

# ─── 관리자 로그인 ────────────────────────────
status, body, sc = req("POST", "/api/admin/auth/login",
    {"email": "admin@haehan.com", "password": "admin1234"},
    return_cookies=True)
admin_token = parse_cookie(sc, "admin_token")
adm = {"admin_token": admin_token} if admin_token else {}
check("관리자 로그인", status == 200 and body.get("success"))

# ─── 현장 준비 ───────────────────────────────
# 파일럿현장A (서울시청): 최초 등록된 것 사용 (가장 오래된 항목)
status, body = req("GET", "/api/admin/sites?limit=100", cookies=adm)
sites = body.get("data", {}).get("items", [])
sites_a = [s for s in sites if s.get("name","") == "파일럿현장A"]
site_a = sites_a[-1] if sites_a else None  # 가장 오래된 항목 (list는 최신순이므로 마지막)
site_b = next((s for s in sites if "강남" in s.get("name","") or "B현장" in s.get("name","")), None)

print(f"  {INFO} 현장A: {site_a and site_a['name']} ({site_a and site_a['id'][:15]})")
print(f"  {INFO} 현장B: {site_b and site_b['name']} ({site_b and site_b['id'][:15]})")

if not site_a or not site_b:
    print(f"  {FAIL} 테스트 현장 부족 — 현장A·B 모두 필요")
    exit(1)

SITE_A_ID = site_a["id"]
SITE_A_LAT = site_a["latitude"]
SITE_A_LNG = site_a["longitude"]
SITE_B_ID = site_b["id"]
SITE_B_LAT = site_b["latitude"]
SITE_B_LNG = site_b["longitude"]
# 반경 밖 좌표 (서울시청 기준 ~1km 북쪽)
OUT_LAT = 37.5760
OUT_LNG = 126.9770

# ─── 이동 전용 근로자 등록/조회 ────────────────
MOVE_PHONE = "01099990099"
COMPANY_ID = "cmn1taiet000f10qfvy1ddnjm"  # 파일럿건설

# 전용 근로자 등록 (중복 시 phone 매칭으로 ID 취득)
status, body = req("POST", "/api/admin/workers",
    {"name": "이동테스터", "phone": MOVE_PHONE, "jobTitle": "형틀목수",
     "employmentType": "DAILY_CONSTRUCTION", "organizationType": "DIRECT"},
    cookies=adm)
W1_ID = body.get("data", {}).get("id") if isinstance(body.get("data"), dict) else None
if not W1_ID:
    _, lb = req("GET", "/api/admin/workers?limit=200", cookies=adm)
    for item in lb.get("data", {}).get("items", []):
        if item.get("phone") == MOVE_PHONE:
            W1_ID = item.get("id")
            break
print(f"  {INFO} 이동테스터 id: {W1_ID}")

# ─── 당일 기존 출퇴근 기록 클린업 (반복 실행 가능하도록) ──
if W1_ID:
    _, al = req("GET", f"/api/admin/attendance?workerId={W1_ID}&date={TODAY}", cookies=adm)
    al_items = al.get("data", {}).get("items", [])
    for rec in al_items:
        if rec.get("status") not in ("ADJUSTED",):
            req("PATCH", f"/api/admin/attendance/{rec['id']}",
                {"status": "ADJUSTED", "adminNote": "[테스트 초기화]"}, cookies=adm)
    if al_items:
        print(f"  {INFO} 기존 당일 기록 {len(al_items)}건 → ADJUSTED 처리")

# 회사·현장A·현장B 배정 확인/추가
def ensure_assigned(worker_id, site_id, company_id, primary=False):
    _, body = req("GET", f"/api/admin/workers/{worker_id}/site-assignments", cookies=adm)
    assign_data = body.get("data", [])
    sites_list = assign_data if isinstance(assign_data, list) else assign_data.get("items", [])
    if any(a.get("siteId") == site_id and a.get("isActive") for a in sites_list if isinstance(a, dict)):
        return True
    s, b = req("POST", f"/api/admin/workers/{worker_id}/site-assignments",
        {"siteId": site_id, "companyId": company_id, "assignedFrom": TODAY,
         "tradeType": "FORMWORK", "isPrimary": primary}, cookies=adm)
    return s in (200, 201)

# 회사 배정
req("POST", f"/api/admin/workers/{W1_ID}/company-assignments",
    {"companyId": COMPANY_ID, "validFrom": TODAY, "isPrimary": True}, cookies=adm)
# 현장A·B 배정
ensure_assigned(W1_ID, SITE_A_ID, COMPANY_ID, primary=True)
check("현장B 배정", ensure_assigned(W1_ID, SITE_B_ID, COMPANY_ID), "A·B 배정 완료")

# ─── 이동 전용 근로자 기기 로그인 ───────────────
DEVICE_TOKEN = f"move_test_device_{int(time.time())}"
status, body, sc = req("POST", "/api/auth/login",
    {"phone": MOVE_PHONE, "deviceToken": DEVICE_TOKEN, "deviceName": "이동테스트폰"},
    return_cookies=True)
w1_status = body.get("status", "")
print(f"\n  {INFO} 이동테스터 로그인: {w1_status}")

if w1_status == "DEVICE_PENDING":
    _, dr_body = req("GET", "/api/admin/device-requests?status=PENDING", cookies=adm)
    items = dr_body.get("data", {}).get("items", [])
    dr_id = next((i["id"] for i in items if i.get("workerId") == W1_ID), items[0]["id"] if items else None)
    if dr_id:
        req("PATCH", f"/api/admin/device-requests/{dr_id}", {"action": "APPROVE"}, cookies=adm)
    status, body, sc = req("POST", "/api/auth/login",
        {"phone": MOVE_PHONE, "deviceToken": DEVICE_TOKEN, "deviceName": "이동테스트폰"},
        return_cookies=True)
    w1_status = body.get("status", "")

worker_token = parse_cookie(sc, "worker_token")
w1 = {"worker_token": worker_token} if worker_token else {}
check("이동테스터 기기 승인 후 로그인", w1_status == "DEVICE_APPROVED", w1_status)

# ═══════════════════════════════════════
print("\n▶ 정상 케이스: A출근 → B이동 → B퇴근")
# ═══════════════════════════════════════

print("\n── [1] A현장 출근 ──")
status, body = req("POST", "/api/attendance/check-in-direct",
    {"siteId": SITE_A_ID, "latitude": SITE_A_LAT, "longitude": SITE_A_LNG, "deviceToken": DEVICE_TOKEN},
    cookies=w1)
log_id = body.get("data", {}).get("attendanceId")
check("A현장 정상 출근", status == 200 and body.get("success"),
      f"logId={log_id and log_id[:15]}, dist={body.get('data',{}).get('distance')}m")

# today 조회 — currentSiteId 확인
status, body = req("GET", "/api/attendance/today", cookies=w1)
today_data = body.get("data", {})
check("today.currentSiteId = A현장", today_data.get("currentSiteId") == SITE_A_ID,
      f"currentSite={today_data.get('currentSiteName')}")
check("today.moveEvents 비어있음", today_data.get("moveEvents", []) == [],
      f"count={len(today_data.get('moveEvents', []))}")

# ─── 차단 케이스들 ──────────────────────────────
print("\n── 차단 케이스 ──")

# 출근 없이 이동 시도 (근로자2로 테스트)
status, body = req("POST", "/api/attendance/move",
    {"targetSiteId": SITE_B_ID, "latitude": SITE_B_LAT, "longitude": SITE_B_LNG,
     "deviceToken": "nonexistent_token"},
    cookies={"worker_token": "invalid"})
check("미인증 이동 차단", status in (400, 401, 403), f"status={status}")

# 같은 현장 이동 시도
status, body = req("POST", "/api/attendance/move",
    {"targetSiteId": SITE_A_ID, "latitude": SITE_A_LAT, "longitude": SITE_A_LNG,
     "deviceToken": DEVICE_TOKEN},
    cookies=w1)
check("동일 현장 이동 차단", status == 400 and not body.get("success"),
      body.get("message", "")[:40])

# 반경 밖 이동 시도
status, body = req("POST", "/api/attendance/move",
    {"targetSiteId": SITE_B_ID, "latitude": OUT_LAT, "longitude": OUT_LNG,
     "deviceToken": DEVICE_TOKEN},
    cookies=w1)
check("반경 밖 이동 차단", status == 400 and not body.get("success"),
      body.get("message", "")[:50])

# ─── 정상 이동 ──────────────────────────────────
print("\n── [2] B현장으로 이동 ──")
status, body = req("POST", "/api/attendance/move",
    {"targetSiteId": SITE_B_ID, "latitude": SITE_B_LAT, "longitude": SITE_B_LNG,
     "deviceToken": DEVICE_TOKEN},
    cookies=w1)
check("B현장 정상 이동", status == 200 and body.get("success"),
      body.get("message", "")[:50])

# today 재조회
status, body = req("GET", "/api/attendance/today", cookies=w1)
today_data = body.get("data", {})
check("today.currentSiteId = B현장", today_data.get("currentSiteId") == SITE_B_ID,
      f"currentSite={today_data.get('currentSiteName')}")
check("moveEvents 1건 기록", len(today_data.get("moveEvents", [])) == 1,
      f"count={len(today_data.get('moveEvents', []))}")

# 이동 후 또 같은 현장 이동 차단
status, body = req("POST", "/api/attendance/move",
    {"targetSiteId": SITE_B_ID, "latitude": SITE_B_LAT, "longitude": SITE_B_LNG,
     "deviceToken": DEVICE_TOKEN},
    cookies=w1)
check("이동 후 동일 현장 재이동 차단", not body.get("success"),
      body.get("message", "")[:40])

# ─── B현장에서 퇴근 ────────────────────────────
print("\n── [3] B현장 퇴근 ──")
status, body = req("POST", "/api/attendance/check-out-direct",
    {"latitude": SITE_B_LAT, "longitude": SITE_B_LNG, "deviceToken": DEVICE_TOKEN},
    cookies=w1)
check("B현장 정상 퇴근", status == 200 and body.get("success"),
      f"dist={body.get('data',{}).get('distance')}m")

# ─── 퇴근 후 이동 차단 ─────────────────────────
status, body = req("POST", "/api/attendance/move",
    {"targetSiteId": SITE_A_ID, "latitude": SITE_A_LAT, "longitude": SITE_A_LNG,
     "deviceToken": DEVICE_TOKEN},
    cookies=w1)
check("퇴근 후 이동 차단", not body.get("success"),
      body.get("message", "")[:40])

# ─── 관리자 출퇴근 조회 → 이동 정보 확인 ────────
print("\n── [4] 관리자 화면 이동 이력 확인 ──")
status, body = req("GET", f"/api/admin/attendance?siteId={SITE_A_ID}&date={TODAY}", cookies=adm)
items = body.get("data", {}).get("items", [])
if items:
    item = items[0]
    check("hasSiteMove = true", item.get("hasSiteMove") == True,
          f"hasSiteMove={item.get('hasSiteMove')}")
    check("moveCount = 1", item.get("moveCount") == 1,
          f"moveCount={item.get('moveCount')}")
    check("movePath 존재", bool(item.get("movePath")),
          f"movePath={item.get('movePath')}")
    check("checkOutSiteName 존재", bool(item.get("checkOutSiteName")),
          f"checkOutSite={item.get('checkOutSiteName')}")
    check("moveEvents 1건", len(item.get("moveEvents", [])) == 1,
          f"count={len(item.get('moveEvents', []))}")
else:
    check("관리자 이동 이력 조회", False, "items 없음")

# ─── aggregate → 공수 계산 확인 ────────────────
print("\n── [5] 공수 계산 — 이동 있어도 하루 합산 기준 ──")
import http.client as hc
conn2 = hc.HTTPConnection("localhost", 3002, timeout=15)
conn2.request("GET", f"/api/cron/aggregate-attendance-days?date={TODAY}",
    headers={"x-cron-secret": CRON_SECRET})
resp2 = conn2.getresponse()
agg_raw = resp2.read().decode()
agg = json.loads(agg_raw) if agg_raw else {}
conn2.close()
check("aggregate 크론 실행", resp2.status == 200, str(agg)[:80])

# generate confirmations
status, body = req("POST", "/api/admin/work-confirmations/generate",
    {"monthKey": TODAY[:7]}, cookies=adm)
check("근무확정 DRAFT 생성", status in (200, 201), str(body.get("data", ""))[:60])

# ─── 감사로그 ────────────────────────────────────
print("\n── [6] 감사로그 ATTENDANCE_SITE_MOVE 확인 ──")
status, body = req("GET", "/api/admin/audit-logs?limit=30", cookies=adm)
items = body.get("data", {}).get("items", [])
actions = [i.get("actionType") for i in items]
check("ATTENDANCE_SITE_MOVE 로그", "ATTENDANCE_SITE_MOVE" in actions,
      f"actions={[a for a in actions if 'MOVE' in str(a) or 'SITE' in str(a)]}")

# ─── 최종 결과 ──────────────────────────────────
print("\n══════════════════════════════════════════")
print("  최종 결과")
print("══════════════════════════════════════════")
passed = sum(1 for _, ok in results if ok)
failed = sum(1 for _, ok in results if not ok)
for label, ok in results:
    print(f"  {PASS if ok else FAIL} {label}")
print(f"\n  합계: {passed}통과 / {failed}실패 / {len(results)}전체")
if failed == 0:
    print("\n  ✅ 현장 이동 기능 전 항목 통과")
else:
    print(f"\n  ⚠️  {failed}개 항목 점검 필요")
print("══════════════════════════════════════════\n")
