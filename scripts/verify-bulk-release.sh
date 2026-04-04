#!/usr/bin/env bash
# ══════════════════════════════════════════════════════
# verify-bulk-release.sh — bulk 기능 배포 후 자동 점검
#
# 점검 순서:
#   [1] health 확인 (서버 직접)
#   [2] ops-check 실행 (SSH)
#   [3] 최근 에러로그 확인 (SSH, 최근 10분)
#   [4] 단독 E2E (선택, 신규 spec 인수 전달 시)
#   [5] bulk 전체 E2E
#   [6] 최종 PASS/WARN/FAIL 요약
#
# 사용법:
#   bash scripts/verify-bulk-release.sh
#   bash scripts/verify-bulk-release.sh e2e/company-admin-requests-bulk.spec.ts
#
# 결과: logs/last-verify-bulk.txt
# ══════════════════════════════════════════════════════
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$ROOT/logs"
RESULT_FILE="$LOG_DIR/last-verify-bulk.txt"
mkdir -p "$LOG_DIR"

SSH_KEY="${SSH_KEY:-$HOME/.ssh/haehan-ai.pem}"
SSH_HOST="ubuntu@1.201.176.236"
APP_PORT="3002"
# 컨테이너 IP 동적 조회 (네트워크 변경 대응)
CONTAINER_IP=$(ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=no "${SSH_HOST}" \
  "docker inspect attendance --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' 2>/dev/null" 2>/dev/null || echo "172.26.0.2")
SINGLE_SPEC="${1:-}"

# npx 경로 탐색
NPX="npx"
for p in "/c/Program Files/nodejs/npx" "/usr/local/bin/npx" "/usr/bin/npx"; do
  [ -x "$p" ] && { NPX="$p"; break; }
done
export PATH="/c/Program Files/nodejs:$PATH"

RUN_TS=$(date '+%Y-%m-%d %H:%M:%S')
echo "══════════════════════════════════════════════"
echo " verify-bulk-release 시작: $RUN_TS"
echo "══════════════════════════════════════════════"

# ─── 결과 수집 ───────────────────────────────────────
RESULTS=()   # "항목|PASS/WARN/FAIL|메모"
FINAL="PASS"

mark() {
  local label="$1" status="$2" note="${3:-}"
  RESULTS+=("$label|$status|$note")
  if [ "$status" = "FAIL" ]; then FINAL="FAIL"
  elif [ "$status" = "WARN" ] && [ "$FINAL" != "FAIL" ]; then FINAL="WARN"
  fi
  printf "  [%-4s] %s%s\n" "$status" "$label" "${note:+ — $note}"
}

ssh_cmd() {
  ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=10 \
      -o BatchMode=yes "$SSH_HOST" "$@" 2>/dev/null
}

# ──────────────────────────────────────────────────────
# [1] health 확인
# ──────────────────────────────────────────────────────
echo ""
echo "▶ [1] health 확인"
set +e
HEALTH=$(ssh_cmd "curl -s --max-time 5 http://${CONTAINER_IP}:${APP_PORT}/api/health")
HC=$?
set -e
if [ $HC -eq 0 ] && echo "$HEALTH" | grep -q '"status":"ok"'; then
  mark "health" "PASS" "$HEALTH"
else
  mark "health" "FAIL" "응답 없음 또는 status≠ok (exit=$HC)"
fi

# ──────────────────────────────────────────────────────
# [2] ops-check (SSH 경유 실행)
# ──────────────────────────────────────────────────────
echo ""
echo "▶ [2] ops-check 실행"
set +e
OPS_OUT=$(ssh_cmd "cd /home/ubuntu/app/attendance && bash scripts/ops-check.sh 2>&1 | tail -25")
OPS_EC=$?
set -e
OPS_SUMMARY=$(echo "$OPS_OUT" | grep -E "^(PASS|WARN|FAIL|총합)" | tail -5 || true)
if echo "$OPS_OUT" | grep -q "^FAIL"; then
  mark "ops-check" "FAIL" "$(echo "$OPS_SUMMARY" | head -1)"
elif echo "$OPS_OUT" | grep -q "^WARN"; then
  mark "ops-check" "WARN" "$(echo "$OPS_SUMMARY" | head -1)"
else
  mark "ops-check" "PASS" "$(echo "$OPS_SUMMARY" | head -1)"
fi

# ──────────────────────────────────────────────────────
# [3] 최근 에러로그 (10분 이내)
# ──────────────────────────────────────────────────────
echo ""
echo "▶ [3] 최근 에러로그 확인 (10분)"
set +e
ERR_LINES=$(ssh_cmd "docker logs attendance --since=10m 2>&1 | grep -iE '\berror\b|\bexception\b|\bfatal\b' | grep -viE 'EarlyHints|schema loaded|migrations found|prisma.*loaded|DeprecationWarning' | head -20")
ERR_EC=$?
set -e
ERR_COUNT=$(echo "$ERR_LINES" | grep -c . || true)
if [ "$ERR_COUNT" -eq 0 ]; then
  mark "에러로그" "PASS" "최근 10분 에러 없음"
elif [ "$ERR_COUNT" -le 3 ]; then
  mark "에러로그" "WARN" "${ERR_COUNT}건 (확인 권고)"
  echo "$ERR_LINES" | head -5 | sed 's/^/      /'
else
  mark "에러로그" "FAIL" "${ERR_COUNT}건"
  echo "$ERR_LINES" | head -10 | sed 's/^/      /'
fi

# ──────────────────────────────────────────────────────
# [4] 단독 E2E (신규 spec 지정 시)
# ──────────────────────────────────────────────────────
if [ -n "$SINGLE_SPEC" ]; then
  echo ""
  echo "▶ [4] 단독 E2E: $SINGLE_SPEC"
  cd "$ROOT"
  set +e
  SINGLE_OUT=$(npx playwright test "$SINGLE_SPEC" \
    --config=e2e/playwright.config.ts --project=chromium 2>&1)
  SINGLE_EC=$?
  set -e
  SINGLE_PASSED=$(echo "$SINGLE_OUT" | grep -oE '[0-9]+ passed' | head -1 || echo "? passed")
  SINGLE_FAILED=$(echo "$SINGLE_OUT" | grep -oE '[0-9]+ failed' | head -1 || true)
  if [ $SINGLE_EC -eq 0 ]; then
    mark "단독E2E" "PASS" "$SINGLE_PASSED"
  else
    mark "단독E2E" "FAIL" "${SINGLE_FAILED:-실패} / $SINGLE_PASSED"
    echo "$SINGLE_OUT" | grep -E "(✘|Error:)" | head -5 | sed 's/^/      /'
  fi
else
  echo ""
  echo "  (단독 E2E 스킵 — spec 인수 없음)"
fi

# ──────────────────────────────────────────────────────
# [5] bulk 전체 E2E
# ──────────────────────────────────────────────────────
echo ""
echo "▶ [5] bulk 전체 E2E"
cd "$ROOT"
set +e
BULK_OUT=$(bash scripts/run-bulk-e2e.sh 2>&1)
BULK_EC=$?
set -e
BULK_STATUS=$(grep "^bulk E2E 종료" <<< "$BULK_OUT" | tail -1 || true)
BULK_PASSED=$(echo "$BULK_OUT" | grep -oE '[0-9]+ passed' | tail -1 || echo "? passed")
BULK_FAILED=$(echo "$BULK_OUT" | grep -oE '[0-9]+ failed' | head -1 || true)
if [ $BULK_EC -eq 0 ]; then
  mark "bulk전체E2E" "PASS" "$BULK_PASSED"
else
  mark "bulk전체E2E" "FAIL" "${BULK_FAILED:-실패} / $BULK_PASSED"
  echo "$BULK_OUT" | grep -E "(✘|Error:)" | head -5 | sed 's/^/      /'
fi

# ──────────────────────────────────────────────────────
# [6] admin smoke E2E
# ──────────────────────────────────────────────────────
echo ""
echo "▶ [6] admin smoke E2E"
cd "$ROOT"
set +e
SMOKE_OUT=$(npx playwright test e2e/admin-smoke.spec.ts \
  --config=e2e/playwright.config.ts --project=chromium 2>&1)
SMOKE_EC=$?
set -e
SMOKE_PASSED=$(echo "$SMOKE_OUT" | grep -oE '[0-9]+ passed' | tail -1 || echo "? passed")
SMOKE_FAILED=$(echo "$SMOKE_OUT" | grep -oE '[0-9]+ failed' | head -1 || true)
if [ $SMOKE_EC -eq 0 ]; then
  mark "adminSmokeE2E" "PASS" "$SMOKE_PASSED"
else
  mark "adminSmokeE2E" "FAIL" "${SMOKE_FAILED:-실패} / $SMOKE_PASSED"
  echo "$SMOKE_OUT" | grep -E "(✘|Error:)" | head -5 | sed 's/^/      /'
fi

# ──────────────────────────────────────────────────────
# [7] admin regression E2E
# ──────────────────────────────────────────────────────
echo ""
echo "▶ [7] admin regression E2E"
cd "$ROOT"
set +e
REG_OUT=$(npx playwright test e2e/admin-regression.spec.ts \
  --config=e2e/playwright.config.ts --project=chromium 2>&1)
REG_EC=$?
set -e
REG_PASSED=$(echo "$REG_OUT" | grep -oE '[0-9]+ passed' | tail -1 || echo "? passed")
REG_FAILED=$(echo "$REG_OUT" | grep -oE '[0-9]+ failed' | head -1 || true)
if [ $REG_EC -eq 0 ]; then
  mark "adminRegressionE2E" "PASS" "$REG_PASSED"
else
  mark "adminRegressionE2E" "FAIL" "${REG_FAILED:-실패} / $REG_PASSED"
  echo "$REG_OUT" | grep -E "(✘|Error:)" | head -5 | sed 's/^/      /'
fi

# ──────────────────────────────────────────────────────
# [8] 최종 요약
# ──────────────────────────────────────────────────────
END_TS=$(date '+%Y-%m-%d %H:%M:%S')
echo ""
echo "══════════════════════════════════════════════"
printf " 최종: %-4s  (%s)\n" "$FINAL" "$END_TS"
echo "══════════════════════════════════════════════"
for r in "${RESULTS[@]}"; do
  IFS='|' read -r label status note <<< "$r"
  printf "  [%-4s] %s%s\n" "$status" "$label" "${note:+ — $note}"
done
echo ""

# 파일 기록
{
  echo "run_at=$END_TS"
  echo "final=$FINAL"
  for r in "${RESULTS[@]}"; do
    IFS='|' read -r label status note <<< "$r"
    echo "${label}=${status}${note:+ ($note)}"
  done
} > "$RESULT_FILE"
echo "기록: $RESULT_FILE"

[ "$FINAL" = "FAIL" ] && exit 1
[ "$FINAL" = "WARN" ] && exit 2
exit 0
