#!/usr/bin/env bash
# ──────────────────────────────────────────────
# check_web.sh — 운영 웹 점검 (페이지 + API + 리소스 + 응답시간)
# 사용법: bash scripts/check_web.sh
# ──────────────────────────────────────────────
set -uo pipefail

DOMAIN="https://attendance.haehan-ai.kr"
LOG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/logs"
mkdir -p "$LOG_DIR"

# PID 기반 임시파일 (동시 실행 충돌 방지)
TMP_BODY="/tmp/check_web_body_$$.txt"
trap "rm -f '$TMP_BODY'" EXIT INT TERM
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULT_FILE="$LOG_DIR/check_web_${TIMESTAMP}.log"

PASS=0
FAIL=0
WARN=0
NOT_TESTED=0
RESULTS=""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SLOW_THRESHOLD=3  # 응답 3초 초과 시 WARN

log() { echo "$1" | tee -a "$RESULT_FILE"; }

check() {
  local label="$1"
  local url="$2"
  local expect="$3"  # 쉼표 구분 허용 상태코드

  local http_code time_total
  local output
  output=$(curl -s -o "$TMP_BODY" -w "%{http_code}|%{time_total}" -L --max-time 15 "$url" 2>/dev/null) || true
  http_code=$(echo "$output" | cut -d'|' -f1)
  time_total=$(echo "$output" | cut -d'|' -f2)

  # 타임아웃 또는 연결 실패
  if [ -z "$http_code" ] || [ "$http_code" = "000" ]; then
    echo -e "  ${YELLOW}[NOT TESTED]${NC} $label → 타임아웃/연결실패" | tee -a "$RESULT_FILE"
    NOT_TESTED=$((NOT_TESTED + 1))
    RESULTS="${RESULTS}NOT_TESTED|${label}|timeout\n"
    return
  fi

  local matched=false
  IFS=',' read -ra CODES <<< "$expect"
  for code in "${CODES[@]}"; do
    if [ "$http_code" = "$code" ]; then
      matched=true
      break
    fi
  done

  # 응답시간 확인
  local time_warn=""
  if [ -n "$time_total" ]; then
    local time_int=${time_total%%.*}
    if [ "${time_int:-0}" -ge "$SLOW_THRESHOLD" ]; then
      time_warn=" (${time_total}s SLOW)"
    fi
  fi

  if $matched; then
    if [ -n "$time_warn" ]; then
      echo -e "  ${YELLOW}[WARN]${NC} $label → $http_code${time_warn}" | tee -a "$RESULT_FILE"
      WARN=$((WARN + 1))
      RESULTS="${RESULTS}WARN|${label}|${http_code}|slow:${time_total}s\n"
    else
      echo -e "  ${GREEN}[PASS]${NC} $label → $http_code (${time_total:-?}s)" | tee -a "$RESULT_FILE"
      PASS=$((PASS + 1))
      RESULTS="${RESULTS}PASS|${label}|${http_code}\n"
    fi
  else
    echo -e "  ${RED}[FAIL]${NC} $label → $http_code (expected: $expect)" | tee -a "$RESULT_FILE"
    FAIL=$((FAIL + 1))
    RESULTS="${RESULTS}FAIL|${label}|${http_code}|expected:${expect}\n"
  fi
}

check_no_error() {
  local label="$1"
  local url="$2"

  local body
  body=$(curl -s -L --max-time 15 "$url" 2>/dev/null) || true

  if [ -z "$body" ]; then
    echo -e "  ${YELLOW}[NOT TESTED]${NC} $label → 응답 없음" | tee -a "$RESULT_FILE"
    NOT_TESTED=$((NOT_TESTED + 1))
    RESULTS="${RESULTS}NOT_TESTED|${label}|empty_response\n"
    return
  fi

  if echo "$body" | grep -qiP '<(title|h1)[^>]*>(.*?)(Internal Server Error|Application error)'; then
    echo -e "  ${RED}[FAIL]${NC} $label → 에러 문구 감지" | tee -a "$RESULT_FILE"
    FAIL=$((FAIL + 1))
    RESULTS="${RESULTS}FAIL|${label}|에러문구감지\n"
    # 실패 시 응답 저장
    echo "$body" | head -50 > "$LOG_DIR/fail_response_${label// /_}_${TIMESTAMP}.html"
  else
    echo -e "  ${GREEN}[PASS]${NC} $label → 에러 문구 없음" | tee -a "$RESULT_FILE"
    PASS=$((PASS + 1))
    RESULTS="${RESULTS}PASS|${label}|clean\n"
  fi
}

check_resource() {
  local label="$1"
  local url="$2"

  local body
  body=$(curl -s -L --max-time 15 "$url" 2>/dev/null) || true

  if [ -z "$body" ]; then
    echo -e "  ${YELLOW}[NOT TESTED]${NC} $label → 페이지 응답 없음" | tee -a "$RESULT_FILE"
    NOT_TESTED=$((NOT_TESTED + 1))
    return
  fi

  local resources
  resources=$(echo "$body" | grep -oP '/_next/static/[^"]+' | head -5)

  if [ -z "$resources" ]; then
    echo -e "  ${YELLOW}[NOT TESTED]${NC} $label → 정적 리소스 링크 미발견" | tee -a "$RESULT_FILE"
    NOT_TESTED=$((NOT_TESTED + 1))
    RESULTS="${RESULTS}NOT_TESTED|${label}|no_resources\n"
    return
  fi

  local fail_count=0
  local total=0
  local failed_list=""
  for res in $resources; do
    total=$((total + 1))
    local rc
    rc=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "${DOMAIN}${res}" 2>/dev/null) || true
    if [ "$rc" != "200" ]; then
      fail_count=$((fail_count + 1))
      failed_list="${failed_list} ${res}→${rc}"
    fi
  done

  if [ "$fail_count" -eq 0 ]; then
    echo -e "  ${GREEN}[PASS]${NC} $label → 정적 리소스 ${total}개 정상" | tee -a "$RESULT_FILE"
    PASS=$((PASS + 1))
    RESULTS="${RESULTS}PASS|${label}|resources_ok:${total}\n"
  else
    echo -e "  ${RED}[FAIL]${NC} $label → 정적 리소스 ${fail_count}/${total}개 실패:${failed_list}" | tee -a "$RESULT_FILE"
    FAIL=$((FAIL + 1))
    RESULTS="${RESULTS}FAIL|${label}|resources_fail:${fail_count}/${total}\n"
  fi
}

log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log " 웹 점검 시작: $(date '+%Y-%m-%d %H:%M:%S')"
log " 대상: $DOMAIN"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "" | tee -a "$RESULT_FILE"
echo "[페이지 상태]" | tee -a "$RESULT_FILE"
check "로그인 (데스크톱)"      "$DOMAIN/login"         "200"
check "로그인 (모바일)"        "$DOMAIN/m/login"       "200"
check "회원가입 (데스크톱)"    "$DOMAIN/register"      "200"
check "회원가입 (모바일)"      "$DOMAIN/m/register"    "200"
check "관리자 로그인"          "$DOMAIN/admin/login"   "200"
check "메인"                   "$DOMAIN/"              "200"

echo "" | tee -a "$RESULT_FILE"
echo "[API 헬스체크]" | tee -a "$RESULT_FILE"
check "API health"             "$DOMAIN/api/health"    "200"
check "API auth/me (비인증)"   "$DOMAIN/api/auth/me"   "200,401"

echo "" | tee -a "$RESULT_FILE"
echo "[API smoke test]" | tee -a "$RESULT_FILE"

# 핸드폰 로그인 API
SMOKE=$(curl -s -w "\n%{http_code}" -X POST "$DOMAIN/api/auth/worker-login" \
  -H "Content-Type: application/json" \
  -d '{"phone":"01000000000","password":"x"}' --max-time 10 2>/dev/null) || true
SMOKE_CODE=$(echo "$SMOKE" | tail -1)
if [ -z "$SMOKE_CODE" ] || [ "$SMOKE_CODE" = "000" ]; then
  echo -e "  ${YELLOW}[NOT TESTED]${NC} worker-login API → 타임아웃" | tee -a "$RESULT_FILE"
  NOT_TESTED=$((NOT_TESTED + 1))
elif [ "$SMOKE_CODE" = "401" ] || [ "$SMOKE_CODE" = "400" ]; then
  echo -e "  ${GREEN}[PASS]${NC} worker-login API → $SMOKE_CODE" | tee -a "$RESULT_FILE"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}[FAIL]${NC} worker-login API → $SMOKE_CODE (expected: 400,401)" | tee -a "$RESULT_FILE"
  FAIL=$((FAIL + 1))
fi

# 관리자 로그인 API
SMOKE2=$(curl -s -w "\n%{http_code}" -X POST "$DOMAIN/api/admin/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"smoke@test.com","password":"x"}' --max-time 10 2>/dev/null) || true
SMOKE2_CODE=$(echo "$SMOKE2" | tail -1)
if [ -z "$SMOKE2_CODE" ] || [ "$SMOKE2_CODE" = "000" ]; then
  echo -e "  ${YELLOW}[NOT TESTED]${NC} admin-login API → 타임아웃" | tee -a "$RESULT_FILE"
  NOT_TESTED=$((NOT_TESTED + 1))
elif [ "$SMOKE2_CODE" = "401" ] || [ "$SMOKE2_CODE" = "400" ]; then
  echo -e "  ${GREEN}[PASS]${NC} admin-login API → $SMOKE2_CODE" | tee -a "$RESULT_FILE"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}[FAIL]${NC} admin-login API → $SMOKE2_CODE (expected: 400,401)" | tee -a "$RESULT_FILE"
  FAIL=$((FAIL + 1))
fi

echo "" | tee -a "$RESULT_FILE"
echo "[에러 문구 점검]" | tee -a "$RESULT_FILE"
check_no_error "로그인 페이지 에러"   "$DOMAIN/login"
check_no_error "모바일 로그인 에러"   "$DOMAIN/m/login"

echo "" | tee -a "$RESULT_FILE"
echo "[정적 리소스 점검]" | tee -a "$RESULT_FILE"
check_resource "로그인 페이지 리소스"  "$DOMAIN/login"

# ── 결과 요약 ──
echo "" | tee -a "$RESULT_FILE"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log " 웹 점검 종료: $(date '+%Y-%m-%d %H:%M:%S')"

TOTAL=$((PASS + FAIL + WARN + NOT_TESTED))

if [ "$FAIL" -eq 0 ] && [ "$WARN" -eq 0 ] && [ "$NOT_TESTED" -eq 0 ]; then
  echo -e " 결과: ${GREEN}ALL PASS${NC} (${PASS}/${TOTAL}건)" | tee -a "$RESULT_FILE"
else
  echo -e " 결과: PASS=${GREEN}${PASS}${NC} FAIL=${RED}${FAIL}${NC} WARN=${YELLOW}${WARN}${NC} NOT_TESTED=${YELLOW}${NOT_TESTED}${NC}" | tee -a "$RESULT_FILE"
fi

# 실패/WARN 항목 별도 출력
if [ "$FAIL" -gt 0 ]; then
  echo "" | tee -a "$RESULT_FILE"
  echo -e " ${RED}[실패 항목]${NC}" | tee -a "$RESULT_FILE"
  echo -e "$RESULTS" | grep "^FAIL" | while IFS='|' read -r s label rest; do
    echo "  - $label: $rest" | tee -a "$RESULT_FILE"
  done
fi

if [ "$WARN" -gt 0 ]; then
  echo "" | tee -a "$RESULT_FILE"
  echo -e " ${YELLOW}[WARN 항목]${NC}" | tee -a "$RESULT_FILE"
  echo -e "$RESULTS" | grep "^WARN" | while IFS='|' read -r s label rest; do
    echo "  - $label: $rest" | tee -a "$RESULT_FILE"
  done
fi

if [ "$NOT_TESTED" -gt 0 ]; then
  echo "" | tee -a "$RESULT_FILE"
  echo -e " ${YELLOW}[미검증 항목]${NC}" | tee -a "$RESULT_FILE"
  echo -e "$RESULTS" | grep "^NOT_TESTED" | while IFS='|' read -r s label rest; do
    echo "  - $label: $rest" | tee -a "$RESULT_FILE"
  done
fi

log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log " 로그: $RESULT_FILE"

# 실패 시 마지막 실패 저장
if [ "$FAIL" -gt 0 ]; then
  echo -e "$RESULTS" | grep "^FAIL" > "$LOG_DIR/last_web_failure.log"
fi

# 종료: FAIL 있으면 1, WARN만 있으면 0 (경고지 실패 아님)
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
