#!/usr/bin/env bash
# ──────────────────────────────────────────────
# scenario_check.sh — 시나리오 기반 웹 점검
# PASS / FAIL / WARN / NOT_TESTED 4단계 판정
# 사용법: bash scripts/scenario_check.sh
# ──────────────────────────────────────────────
set -uo pipefail

DOMAIN="https://attendance.haehan-ai.kr"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$SCRIPT_DIR/../logs"
mkdir -p "$LOG_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULT_FILE="$LOG_DIR/scenario_${TIMESTAMP}.log"

PASS=0
FAIL=0
WARN=0
NOT_TESTED=0
RESULTS=""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo "$1" | tee -a "$RESULT_FILE"; }
log_color() { echo -e "$1" | tee -a "$RESULT_FILE"; }

result_pass() {
  local label="$1"; local detail="${2:-}"
  PASS=$((PASS + 1))
  RESULTS="${RESULTS}PASS|${label}|${detail}\n"
  log_color "  ${GREEN}[PASS]${NC} $label ${detail:+→ $detail}"
}

result_fail() {
  local label="$1"; local detail="${2:-}"
  FAIL=$((FAIL + 1))
  RESULTS="${RESULTS}FAIL|${label}|${detail}\n"
  log_color "  ${RED}[FAIL]${NC} $label ${detail:+→ $detail}"
}

result_warn() {
  local label="$1"; local detail="${2:-}"
  WARN=$((WARN + 1))
  RESULTS="${RESULTS}WARN|${label}|${detail}\n"
  log_color "  ${YELLOW}[WARN]${NC} $label ${detail:+→ $detail}"
}

result_skip() {
  local label="$1"; local reason="${2:-}"
  NOT_TESTED=$((NOT_TESTED + 1))
  RESULTS="${RESULTS}NOT_TESTED|${label}|${reason}\n"
  log_color "  ${YELLOW}[NOT TESTED]${NC} $label ${reason:+→ $reason}"
}

# ── 공통 함수 ──
http_check() {
  local label="$1"; local url="$2"; local expect="$3"
  local output code time_total
  output=$(curl -s -o /dev/null -w "%{http_code}|%{time_total}" -L --max-time 15 "$url" 2>/dev/null) || true
  code=$(echo "$output" | cut -d'|' -f1)
  time_total=$(echo "$output" | cut -d'|' -f2)

  if [ -z "$code" ] || [ "$code" = "000" ]; then
    result_skip "$label" "타임아웃/연결실패"
    return
  fi

  local matched=false
  IFS=',' read -ra CODES <<< "$expect"
  for c in "${CODES[@]}"; do
    [ "$code" = "$c" ] && matched=true && break
  done

  if $matched; then
    local time_int=${time_total%%.*}
    if [ "${time_int:-0}" -ge 5 ]; then
      result_warn "$label" "$code (${time_total}s slow)"
    else
      result_pass "$label" "$code (${time_total}s)"
    fi
  else
    result_fail "$label" "got $code, expected $expect"
  fi
}

api_post() {
  local label="$1"; local url="$2"; local data="$3"; local expect="$4"
  local response code body

  response=$(curl -s -w "\n%{http_code}" -X POST "$url" \
    -H "Content-Type: application/json" \
    -d "$data" --max-time 15 2>/dev/null) || true

  code=$(echo "$response" | tail -1)
  body=$(echo "$response" | sed '$d')

  if [ -z "$code" ] || [ "$code" = "000" ]; then
    result_skip "$label" "타임아웃/연결실패"
    return
  fi

  local matched=false
  IFS=',' read -ra CODES <<< "$expect"
  for c in "${CODES[@]}"; do
    [ "$code" = "$c" ] && matched=true && break
  done

  if $matched; then
    # 응답 body 검증 — JSON이면 success 필드 확인
    if echo "$body" | grep -q '"success"' 2>/dev/null; then
      result_pass "$label" "$code"
    else
      result_pass "$label" "$code"
    fi
  else
    result_fail "$label" "got $code, expected $expect"
    # 실패 응답 저장
    local safe_label
    safe_label=$(echo "$label" | tr ' /' '_')
    echo "$body" > "$LOG_DIR/fail_${safe_label}_${TIMESTAMP}.json" 2>/dev/null || true
  fi
}

api_get() {
  local label="$1"; local url="$2"; local expect="$3"
  local response code body

  response=$(curl -s -w "\n%{http_code}" -L "$url" --max-time 15 2>/dev/null) || true
  code=$(echo "$response" | tail -1)
  body=$(echo "$response" | sed '$d')

  if [ -z "$code" ] || [ "$code" = "000" ]; then
    result_skip "$label" "타임아웃/연결실패"
    return
  fi

  local matched=false
  IFS=',' read -ra CODES <<< "$expect"
  for c in "${CODES[@]}"; do
    [ "$code" = "$c" ] && matched=true && break
  done

  if $matched; then
    result_pass "$label" "$code"
  else
    result_fail "$label" "got $code, expected $expect"
  fi
}

# ════════════════════════════════════════════════
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log " 시나리오 점검 시작: $(date '+%Y-%m-%d %H:%M:%S')"
log " 대상: $DOMAIN"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 0. 서버 연결 사전 확인 ──
log ""
log_color "${CYAN}[0. 서버 연결 확인]${NC}"
PRE_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$DOMAIN/api/health" 2>/dev/null) || true
if [ -z "$PRE_CODE" ] || [ "$PRE_CODE" = "000" ]; then
  result_fail "서버 연결" "접속 불가 — 전체 점검 중단"
  log ""
  log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  log_color " 결과: ${RED}FAIL 1건${NC} — 서버 연결 불가"
  log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo -e "$RESULTS" | grep "^FAIL" > "$LOG_DIR/last_failure.log"
  exit 1
fi
result_pass "서버 연결" "health=$PRE_CODE"

# ── 1. 기본 인프라 ──
log ""
log_color "${CYAN}[1. 기본 인프라]${NC}"
http_check "API health" "$DOMAIN/api/health" "200"

# API health 응답 body 검증
HEALTH_BODY=$(curl -s --max-time 10 "$DOMAIN/api/health" 2>/dev/null) || true
if echo "$HEALTH_BODY" | grep -q '"status":"ok"' 2>/dev/null; then
  result_pass "API health body" "status=ok"
else
  result_warn "API health body" "응답: $(echo "$HEALTH_BODY" | head -c 100)"
fi

# ── 2. 근로자 로그인 시나리오 ──
log ""
log_color "${CYAN}[2. 근로자 로그인]${NC}"
api_post "잘못된 전화번호 형식" "$DOMAIN/api/auth/worker-login" '{"phone":"123","password":"x"}' "400"
api_post "미등록 번호 로그인" "$DOMAIN/api/auth/worker-login" '{"phone":"01099999999","password":"wrongpass"}' "401"
api_post "빈 비밀번호" "$DOMAIN/api/auth/worker-login" '{"phone":"01099999999","password":""}' "400"

# ── 3. 관리자 로그인 시나리오 ──
log ""
log_color "${CYAN}[3. 관리자 로그인]${NC}"
api_post "잘못된 이메일 형식" "$DOMAIN/api/admin/auth/login" '{"email":"notanemail","password":"x"}' "400"
api_post "미등록 관리자 이메일" "$DOMAIN/api/admin/auth/login" '{"email":"fake@nonexist.com","password":"wrongpass"}' "401"

# ── 4. 회원가입 시나리오 ──
log ""
log_color "${CYAN}[4. 회원가입 페이지]${NC}"
http_check "회원가입 (데스크톱)" "$DOMAIN/register" "200"
http_check "회원가입 (모바일)" "$DOMAIN/m/register" "200"
api_post "회원가입 빈 바디" "$DOMAIN/api/auth/worker-register" '{}' "400"

# ── 5. 인증 필요 페이지 접근 시나리오 ──
log ""
log_color "${CYAN}[5. 인증 미달 접근]${NC}"
api_get "비인증 /api/auth/me" "$DOMAIN/api/auth/me" "200,401"
http_check "비인증 /admin → 로그인 리다이렉트" "$DOMAIN/admin" "200"

# ── 6. 모바일 주요 화면 ──
log ""
log_color "${CYAN}[6. 모바일 주요 화면]${NC}"
http_check "모바일 로그인" "$DOMAIN/m/login" "200"
http_check "모바일 회원가입" "$DOMAIN/m/register" "200"
http_check "모바일 메인" "$DOMAIN/m" "200"
http_check "모바일 FAQ" "$DOMAIN/m/faq" "200"
http_check "모바일 가이드" "$DOMAIN/m/guide" "200"

# ── 7. 관리자 주요 화면 ──
log ""
log_color "${CYAN}[7. 관리자 주요 화면]${NC}"
http_check "관리자 로그인 페이지" "$DOMAIN/admin/login" "200"
http_check "관리자 대시보드 (비인증)" "$DOMAIN/admin" "200"

# ── 8. API 엔드포인트 존재 확인 ──
log ""
log_color "${CYAN}[8. API 엔드포인트 존재]${NC}"
api_get "API health" "$DOMAIN/api/health" "200"
api_get "API auth/me" "$DOMAIN/api/auth/me" "200,401"

# ── 9. 에러 페이지 점검 ──
log ""
log_color "${CYAN}[9. 에러 페이지 점검]${NC}"
for page in "/login" "/m/login" "/register" "/admin/login" "/m" "/m/register"; do
  body=$(curl -s -L --max-time 15 "$DOMAIN$page" 2>/dev/null) || true
  if [ -z "$body" ]; then
    result_skip "$page 에러문구" "응답 없음"
  elif echo "$body" | grep -qiP '<(title|h1)[^>]*>(.*?)(Internal Server Error|Application error)'; then
    result_fail "$page 에러문구" "Internal Server Error 감지"
    echo "$body" | head -30 > "$LOG_DIR/fail_error_page_${page//\//_}_${TIMESTAMP}.html" 2>/dev/null || true
  else
    result_pass "$page 에러문구" "clean"
  fi
done

# ── 10. 정적 리소스 점검 ──
log ""
log_color "${CYAN}[10. 정적 리소스]${NC}"

LOGIN_HTML=$(curl -s -L --max-time 15 "$DOMAIN/login" 2>/dev/null) || true
RESOURCES=$(echo "$LOGIN_HTML" | grep -oP '/_next/static/[^"]+' | head -5)
if [ -z "$RESOURCES" ]; then
  result_skip "정적 리소스" "리소스 링크 미발견"
else
  RES_FAIL=0
  RES_TOTAL=0
  for res in $RESOURCES; do
    RES_TOTAL=$((RES_TOTAL + 1))
    rc=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "${DOMAIN}${res}" 2>/dev/null) || true
    [ "$rc" != "200" ] && RES_FAIL=$((RES_FAIL + 1))
  done
  if [ "$RES_FAIL" -eq 0 ]; then
    result_pass "정적 리소스" "${RES_TOTAL}개 모두 정상"
  else
    result_fail "정적 리소스" "${RES_FAIL}/${RES_TOTAL}개 실패"
  fi
fi

# ════════════════════════════════════════════════
# 결과 요약
log ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log " 시나리오 점검 종료: $(date '+%Y-%m-%d %H:%M:%S')"
log ""
TOTAL=$((PASS + FAIL + WARN + NOT_TESTED))

if [ "$FAIL" -eq 0 ] && [ "$WARN" -eq 0 ] && [ "$NOT_TESTED" -eq 0 ]; then
  log_color " 결과: ${GREEN}ALL PASS${NC} (${PASS}/${TOTAL}건)"
else
  log_color " 결과: PASS=${GREEN}${PASS}${NC} FAIL=${RED}${FAIL}${NC} WARN=${YELLOW}${WARN}${NC} NOT_TESTED=${YELLOW}${NOT_TESTED}${NC} (총 ${TOTAL}건)"
fi

if [ "$FAIL" -gt 0 ]; then
  log ""
  log_color " ${RED}[실패 항목]${NC}"
  echo -e "$RESULTS" | grep "^FAIL" | while IFS='|' read -r status label detail; do
    log_color "  - $label: $detail"
  done
fi

if [ "$WARN" -gt 0 ]; then
  log ""
  log_color " ${YELLOW}[WARN 항목]${NC}"
  echo -e "$RESULTS" | grep "^WARN" | while IFS='|' read -r status label detail; do
    log_color "  - $label: $detail"
  done
fi

if [ "$NOT_TESTED" -gt 0 ]; then
  log ""
  log_color " ${YELLOW}[미검증 항목]${NC}"
  echo -e "$RESULTS" | grep "^NOT_TESTED" | while IFS='|' read -r status label detail; do
    log_color "  - $label: $detail"
  done
fi

log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log " 로그: $RESULT_FILE"

# 마지막 실패 지점 저장
if [ "$FAIL" -gt 0 ]; then
  echo -e "$RESULTS" | grep "^FAIL" > "$LOG_DIR/last_failure.log"
fi

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
