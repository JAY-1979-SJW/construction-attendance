#!/usr/bin/env bash
# ──────────────────────────────────────────────
# check_web.sh — 운영 웹 점검 (페이지 + API + 리소스)
# 사용법: bash scripts/check_web.sh
# ──────────────────────────────────────────────
set -uo pipefail

DOMAIN="https://attendance.haehan-ai.kr"
PASS=0
FAIL=0
RESULTS=""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

check() {
  local label="$1"
  local url="$2"
  local expect="$3"  # 쉼표 구분 허용 상태코드 (예: "200,302")

  local http_code
  local body
  body=$(curl -s -o /tmp/check_web_body.txt -w "%{http_code}" -L --max-time 10 "$url" 2>/dev/null)
  http_code="$body"

  local matched=false
  IFS=',' read -ra CODES <<< "$expect"
  for code in "${CODES[@]}"; do
    if [ "$http_code" = "$code" ]; then
      matched=true
      break
    fi
  done

  if $matched; then
    echo -e "  ${GREEN}[PASS]${NC} $label → $http_code"
    PASS=$((PASS + 1))
    RESULTS="${RESULTS}PASS|${label}|${http_code}\n"
  else
    echo -e "  ${RED}[FAIL]${NC} $label → $http_code (expected: $expect)"
    FAIL=$((FAIL + 1))
    RESULTS="${RESULTS}FAIL|${label}|${http_code}|expected:${expect}\n"
  fi
}

check_no_error() {
  local label="$1"
  local url="$2"

  local body
  body=$(curl -s -L --max-time 10 "$url" 2>/dev/null)

  # HTTP 200인데 서버 에러 페이지가 렌더링된 경우만 탐지
  # Next.js 번들에 포함된 기본 문자열은 제외하기 위해 <title> 또는 <h1> 내 에러만 확인
  if echo "$body" | grep -qiP '<(title|h1)[^>]*>(.*?)(Internal Server Error|Application error)'; then
    echo -e "  ${RED}[FAIL]${NC} $label → 에러 문구 감지"
    FAIL=$((FAIL + 1))
    RESULTS="${RESULTS}FAIL|${label}|에러문구감지\n"
  else
    echo -e "  ${GREEN}[PASS]${NC} $label → 에러 문구 없음"
    PASS=$((PASS + 1))
    RESULTS="${RESULTS}PASS|${label}|clean\n"
  fi
}

check_resource() {
  local label="$1"
  local url="$2"

  # 페이지 로드 후 JS/CSS 링크 추출하여 404 확인
  local body
  body=$(curl -s -L --max-time 10 "$url" 2>/dev/null)
  local fail_count=0

  # _next/static 리소스 중 처음 3개만 샘플 점검
  local resources
  resources=$(echo "$body" | grep -oP '/_next/static/[^"]+' | head -3)

  if [ -z "$resources" ]; then
    echo -e "  ${YELLOW}[SKIP]${NC} $label → 정적 리소스 링크 미발견"
    return
  fi

  for res in $resources; do
    local rc
    rc=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "${DOMAIN}${res}" 2>/dev/null)
    if [ "$rc" != "200" ]; then
      fail_count=$((fail_count + 1))
    fi
  done

  if [ "$fail_count" -eq 0 ]; then
    echo -e "  ${GREEN}[PASS]${NC} $label → 정적 리소스 정상"
    PASS=$((PASS + 1))
    RESULTS="${RESULTS}PASS|${label}|resources_ok\n"
  else
    echo -e "  ${RED}[FAIL]${NC} $label → 정적 리소스 ${fail_count}개 실패"
    FAIL=$((FAIL + 1))
    RESULTS="${RESULTS}FAIL|${label}|resources_fail:${fail_count}\n"
  fi
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " 웹 점검 시작: $DOMAIN"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "[페이지 상태]"
check "로그인 (데스크톱)"      "$DOMAIN/login"         "200"
check "로그인 (모바일)"        "$DOMAIN/m/login"       "200"
check "회원가입 (데스크톱)"    "$DOMAIN/register"      "200"
check "회원가입 (모바일)"      "$DOMAIN/m/register"    "200"
check "관리자 로그인"          "$DOMAIN/admin/login"   "200"
check "메인"                   "$DOMAIN/"              "200"

echo ""
echo "[API 헬스체크]"
check "API health"             "$DOMAIN/api/health"    "200"
check "API auth/me (비인증)"   "$DOMAIN/api/auth/me"   "200,401"

echo ""
echo "[API smoke test]"
# 핸드폰 로그인 API — 잘못된 입력에 400/401 반환하면 정상
SMOKE=$(curl -s -w "\n%{http_code}" -X POST "$DOMAIN/api/auth/worker-login" \
  -H "Content-Type: application/json" \
  -d '{"phone":"01000000000","password":"x"}' 2>/dev/null)
SMOKE_CODE=$(echo "$SMOKE" | tail -1)
if [ "$SMOKE_CODE" = "401" ] || [ "$SMOKE_CODE" = "400" ]; then
  echo -e "  ${GREEN}[PASS]${NC} worker-login API → $SMOKE_CODE"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}[FAIL]${NC} worker-login API → $SMOKE_CODE (expected: 400,401)"
  FAIL=$((FAIL + 1))
fi

# 이메일 로그인 API
SMOKE2=$(curl -s -w "\n%{http_code}" -X POST "$DOMAIN/api/admin/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"smoke@test.com","password":"x"}' 2>/dev/null)
SMOKE2_CODE=$(echo "$SMOKE2" | tail -1)
if [ "$SMOKE2_CODE" = "401" ] || [ "$SMOKE2_CODE" = "400" ]; then
  echo -e "  ${GREEN}[PASS]${NC} admin-login API → $SMOKE2_CODE"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}[FAIL]${NC} admin-login API → $SMOKE2_CODE (expected: 400,401)"
  FAIL=$((FAIL + 1))
fi

echo ""
echo "[에러 문구 점검]"
check_no_error "로그인 페이지 에러"   "$DOMAIN/login"
check_no_error "모바일 로그인 에러"   "$DOMAIN/m/login"

echo ""
echo "[정적 리소스 점검]"
check_resource "로그인 페이지 리소스"  "$DOMAIN/login"

# ── 결과 요약 ──
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$FAIL" -eq 0 ]; then
  echo -e " 결과: ${GREEN}ALL PASS${NC} (${PASS}건 통과)"
else
  echo -e " 결과: ${RED}${FAIL}건 실패${NC} / ${PASS}건 통과"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 종료코드: 실패 있으면 1
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
