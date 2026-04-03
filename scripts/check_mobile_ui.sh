#!/usr/bin/env bash
# ──────────────────────────────────────────────
# check_mobile_ui.sh — 모바일 카드형 UI Playwright 점검
# 사용법:
#   bash scripts/check_mobile_ui.sh                  # iPhone + Galaxy 전체
#   bash scripts/check_mobile_ui.sh --iphone         # iPhone만
#   bash scripts/check_mobile_ui.sh --galaxy          # Galaxy만
# ──────────────────────────────────────────────
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$PROJECT_DIR/logs"
SCREENSHOT_DIR="$LOG_DIR/screenshots"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULT_FILE="$LOG_DIR/mobile_ui_${TIMESTAMP}.log"

mkdir -p "$LOG_DIR" "$SCREENSHOT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

MODE="${1:---all}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee "$RESULT_FILE"
echo " 모바일 카드형 UI 점검" | tee -a "$RESULT_FILE"
echo " 시각: $(date '+%Y-%m-%d %H:%M:%S')" | tee -a "$RESULT_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$RESULT_FILE"

# Playwright 설치 확인
if ! command -v npx > /dev/null 2>&1; then
  echo -e "  ${YELLOW}[NOT TESTED]${NC} npx 미설치 — Playwright 점검 불가" | tee -a "$RESULT_FILE"
  echo "NOT_TESTED|모바일UI|npx 미설치" > "$LOG_DIR/last_mobile_ui_status.txt"
  exit 0  # NOT_TESTED는 FAIL 아님
fi

if ! npx playwright --version > /dev/null 2>&1; then
  echo -e "  ${YELLOW}[NOT TESTED]${NC} Playwright 미설치 — 모바일 UI 점검 건너뜀" | tee -a "$RESULT_FILE"
  echo "  설치: npx playwright install chromium" | tee -a "$RESULT_FILE"
  echo "NOT_TESTED|모바일UI|Playwright 미설치" > "$LOG_DIR/last_mobile_ui_status.txt"
  exit 0  # NOT_TESTED는 FAIL 아님
fi

# 브라우저 설치 여부 확인
if ! npx playwright install --dry-run chromium > /dev/null 2>&1; then
  echo -e "  ${YELLOW}[NOT TESTED]${NC} Chromium 브라우저 미설치" | tee -a "$RESULT_FILE"
  echo "  설치: npx playwright install chromium" | tee -a "$RESULT_FILE"
  echo "NOT_TESTED|모바일UI|브라우저 미설치" > "$LOG_DIR/last_mobile_ui_status.txt"
  exit 0
fi

PROJECTS=""
case "$MODE" in
  --iphone|-i)
    PROJECTS="--project=mobile-iphone13"
    echo " 디바이스: iPhone 13" | tee -a "$RESULT_FILE"
    ;;
  --galaxy|-g)
    PROJECTS="--project=mobile-galaxy-s21"
    echo " 디바이스: Galaxy S9+" | tee -a "$RESULT_FILE"
    ;;
  --all|-a|*)
    PROJECTS="--project=mobile-iphone13 --project=mobile-galaxy-s21"
    echo " 디바이스: iPhone 13 + Galaxy S9+" | tee -a "$RESULT_FILE"
    ;;
esac

cd "$PROJECT_DIR"

# Playwright 실행
echo "" | tee -a "$RESULT_FILE"
echo "▶ Playwright 테스트 실행 중..." | tee -a "$RESULT_FILE"
npx playwright test e2e/mobile-card-ui.spec.ts $PROJECTS --config=e2e/playwright.config.ts --reporter=list 2>&1 | tee -a "$RESULT_FILE"
EXIT_CODE=${PIPESTATUS[0]}

echo "" | tee -a "$RESULT_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$RESULT_FILE"

# 결과 파싱 (Playwright list reporter 출력 기준)
PASSED=$(grep -cE '✓|✔|passed' "$RESULT_FILE" 2>/dev/null || echo "0")
FAILED=$(grep -cE '✘|✗|failed' "$RESULT_FILE" 2>/dev/null || echo "0")
SKIPPED=$(grep -cE 'skipped' "$RESULT_FILE" 2>/dev/null || echo "0")

if [ "$EXIT_CODE" -eq 0 ]; then
  echo -e " 결과: ${GREEN}ALL PASS${NC}" | tee -a "$RESULT_FILE"
  echo "PASS|모바일UI|pass=$PASSED,skip=$SKIPPED" > "$LOG_DIR/last_mobile_ui_status.txt"
else
  echo -e " 결과: ${RED}FAIL${NC}" | tee -a "$RESULT_FILE"
  echo "FAIL|모바일UI|pass=$PASSED,fail=$FAILED,skip=$SKIPPED" > "$LOG_DIR/last_mobile_ui_status.txt"
fi

echo " PASS: $PASSED / FAIL: $FAILED / SKIP: $SKIPPED" | tee -a "$RESULT_FILE"

# 실패 스크린샷 안내
FAIL_SHOTS=$(find "$SCREENSHOT_DIR" -name "FAIL_*" -newer "$RESULT_FILE" 2>/dev/null | head -10)
if [ -n "$FAIL_SHOTS" ]; then
  echo "" | tee -a "$RESULT_FILE"
  echo -e " ${RED}[실패 스크린샷]${NC}" | tee -a "$RESULT_FILE"
  echo "$FAIL_SHOTS" | while read -r f; do
    echo "  - $f" | tee -a "$RESULT_FILE"
  done
fi

# Playwright 자체 스크린샷 디렉터리도 확인
PW_RESULTS="$PROJECT_DIR/test-results"
if [ -d "$PW_RESULTS" ]; then
  PW_SHOTS=$(find "$PW_RESULTS" -name "*.png" -newer "$RESULT_FILE" 2>/dev/null | head -5)
  if [ -n "$PW_SHOTS" ]; then
    echo "" | tee -a "$RESULT_FILE"
    echo " [Playwright 자동 스크린샷]" | tee -a "$RESULT_FILE"
    echo "$PW_SHOTS" | while read -r f; do
      echo "  - $f" | tee -a "$RESULT_FILE"
    done
  fi
fi

echo "" | tee -a "$RESULT_FILE"
echo " 로그: $RESULT_FILE" | tee -a "$RESULT_FILE"
echo " 스크린샷: $SCREENSHOT_DIR/" | tee -a "$RESULT_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$RESULT_FILE"

exit $EXIT_CODE
