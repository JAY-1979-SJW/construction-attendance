#!/usr/bin/env bash
# bulk E2E 통합 실행 + 결과 기록
# 사용: bash scripts/run-bulk-e2e.sh
# 결과: logs/last-bulk-e2e.txt

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_FILE="$ROOT/logs/last-bulk-e2e.txt"
mkdir -p "$ROOT/logs"

START_TS=$(date '+%Y-%m-%d %H:%M:%S')
echo "bulk E2E 실행 시작: $START_TS"

cd "$ROOT"
set +e
npx playwright test \
  e2e/work-confirmations-bulk.spec.ts \
  e2e/presence-checks-bulk.spec.ts \
  e2e/attendance-bulk.spec.ts \
  e2e/workers-bulk-education.spec.ts \
  e2e/site-join-requests-bulk.spec.ts \
  e2e/device-requests-bulk.spec.ts \
  e2e/company-admin-requests-bulk.spec.ts \
  --config=e2e/playwright.config.ts \
  --project=chromium
EXIT_CODE=$?
set -e

END_TS=$(date '+%Y-%m-%d %H:%M:%S')
STATUS="PASS"
[ "$EXIT_CODE" -ne 0 ] && STATUS="FAIL"

{
  echo "status=$STATUS"
  echo "exit_code=$EXIT_CODE"
  echo "run_at=$END_TS"
} > "$LOG_FILE"

echo "bulk E2E 종료: $END_TS — $STATUS (exit $EXIT_CODE)"
echo "기록: $LOG_FILE"
exit $EXIT_CODE
