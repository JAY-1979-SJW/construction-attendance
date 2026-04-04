#!/usr/bin/env bash
# ──────────────────────────────────────────────
# check_admin_actions.sh — admin 전체 페이지 기능 전수 점검
# 사용법: bash scripts/check_admin_actions.sh
# ──────────────────────────────────────────────
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$PROJECT_DIR/logs"
SCREENSHOT_DIR="$LOG_DIR/screenshots/admin-actions"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULT_FILE="$LOG_DIR/admin_actions_${TIMESTAMP}.log"

mkdir -p "$LOG_DIR" "$SCREENSHOT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee "$RESULT_FILE"
echo " admin 전체 페이지 기능 점검" | tee -a "$RESULT_FILE"
echo " 시각: $(date '+%Y-%m-%d %H:%M:%S')" | tee -a "$RESULT_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$RESULT_FILE"

# Playwright 확인
if ! command -v npx > /dev/null 2>&1 || ! npx playwright --version > /dev/null 2>&1; then
  echo -e "  ${YELLOW}[NOT TESTED]${NC} Playwright 미설치" | tee -a "$RESULT_FILE"
  echo "NOT_TESTED|admin_actions|Playwright 미설치" > "$LOG_DIR/last_admin_actions_status.txt"
  exit 0
fi

cd "$PROJECT_DIR"

echo "" | tee -a "$RESULT_FILE"
echo "▶ Playwright 테스트 실행 중..." | tee -a "$RESULT_FILE"
npx playwright test e2e/admin-page-actions.spec.ts --project=admin-actions --config=e2e/playwright.config.ts --reporter=list 2>&1 | tee -a "$RESULT_FILE"
EXIT_CODE=${PIPESTATUS[0]}

echo "" | tee -a "$RESULT_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$RESULT_FILE"

PASSED=$(grep -cE '✓|✔|passed' "$RESULT_FILE" 2>/dev/null || echo "0")
FAILED=$(grep -cE '✘|✗|failed' "$RESULT_FILE" 2>/dev/null || echo "0")
SKIPPED=$(grep -cE 'skipped' "$RESULT_FILE" 2>/dev/null || echo "0")

if [ "$EXIT_CODE" -eq 0 ]; then
  echo -e " 결과: ${GREEN}ALL PASS${NC}" | tee -a "$RESULT_FILE"
  echo "PASS|admin_actions|pass=$PASSED,skip=$SKIPPED" > "$LOG_DIR/last_admin_actions_status.txt"
else
  echo -e " 결과: ${RED}FAIL${NC}" | tee -a "$RESULT_FILE"
  echo "FAIL|admin_actions|pass=$PASSED,fail=$FAILED,skip=$SKIPPED" > "$LOG_DIR/last_admin_actions_status.txt"
fi

echo " PASS: $PASSED / FAIL: $FAILED / SKIP: $SKIPPED" | tee -a "$RESULT_FILE"

# 실패 스크린샷
FAIL_SHOTS=$(find "$SCREENSHOT_DIR" -name "FAIL_*" -newer "$RESULT_FILE" 2>/dev/null | head -10)
if [ -n "$FAIL_SHOTS" ]; then
  echo "" | tee -a "$RESULT_FILE"
  echo -e " ${RED}[실패 스크린샷]${NC}" | tee -a "$RESULT_FILE"
  echo "$FAIL_SHOTS" | while read -r f; do
    echo "  - $f" | tee -a "$RESULT_FILE"
  done
fi

echo "" | tee -a "$RESULT_FILE"
echo " 로그: $RESULT_FILE" | tee -a "$RESULT_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$RESULT_FILE"

exit $EXIT_CODE
