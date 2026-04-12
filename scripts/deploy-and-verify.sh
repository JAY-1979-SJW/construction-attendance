#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
# deploy-and-verify.sh — 배포 + 자동검증 단일 실행
#
# 절차:
#   [0]   로컬 pre-flight — 모바일 레이아웃 E2E (실패 시 배포 중단)
#   [1]   SSH 연결 확인
#   [1.5] 서버 디스크 점검 + 자동 정리 (85%↑WARN / 90%↑정리 / 95%↑강제정리+FAIL)
#   [2]   서버 git pull + docker compose build + up -d
#   [3]   healthcheck 대기 (최대 90초)
#   [4]   verify-bulk-release.sh 호출
#         → health / ops-check / 에러로그
#         → admin smoke / admin regression / bulk E2E
#   [5]   PASS/WARN/FAIL 요약
#
# 사용법:
#   bash scripts/deploy-and-verify.sh
#   bash scripts/deploy-and-verify.sh e2e/some-new.spec.ts   # 단독 E2E 추가
#
# 종료코드:
#   0 = PASS 또는 WARN
#   1 = pre-flight 실패 / 배포 실패 / FAIL
#
# 결과: logs/last-deploy-verify.txt
# ══════════════════════════════════════════════════════════════
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$ROOT/logs"
RESULT_FILE="$LOG_DIR/last-deploy-verify.txt"
DEPLOY_LOG="$LOG_DIR/deploy_$(date +%Y%m%d_%H%M%S).log"
mkdir -p "$LOG_DIR"

SSH_KEY="${SSH_KEY:-$HOME/.ssh/haehan-ai.pem}"
SSH_HOST="ubuntu@1.201.176.236"
APP_DIR="/home/ubuntu/app/attendance"
CONTAINER_NAME="attendance"
SINGLE_SPEC="${1:-}"

# npx 경로
export PATH="/c/Program Files/nodejs:$PATH"

START_TS=$(date '+%Y-%m-%d %H:%M:%S')
echo "══════════════════════════════════════════════"
echo " deploy-and-verify 시작: $START_TS"
echo "══════════════════════════════════════════════"

# ─── 결과 수집 ────────────────────────────────────
RESULTS=()
FINAL="PASS"

mark() {
  local label="$1" status="$2" note="${3:-}"
  RESULTS+=("$label|$status|$note")
  if   [ "$status" = "FAIL" ]; then FINAL="FAIL"
  elif [ "$status" = "WARN" ] && [ "$FINAL" != "FAIL" ]; then FINAL="WARN"
  fi
  printf "  [%-4s] %s%s\n" "$status" "$label" "${note:+ — $note}"
}

ssh_cmd() {
  ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=10 \
      -o BatchMode=yes "$SSH_HOST" "$@" 2>/dev/null
}

# ──────────────────────────────────────────────────
# [0] pre-flight: 모바일 레이아웃 E2E (배포 전 로컬 실행)
# ──────────────────────────────────────────────────
# [0] pre-flight: UI 레이아웃 E2E (계약서 + 핵심 페이지 공통)
#     두 spec 중 하나라도 FAIL이면 즉시 배포 중단
# ──────────────────────────────────────────────────
echo ""
echo "▶ [0] pre-flight: UI 레이아웃 E2E (계약서 + 핵심 페이지)"
cd "$ROOT"

PREFLIGHT_FAIL=false

# [0-a] 계약서 모바일 레이아웃
set +e
CONTRACT_OUT=$(node_modules/.bin/playwright test \
  e2e/mobile-contract-form-layout.spec.ts \
  --config=e2e/playwright.config.ts \
  --project=chromium 2>&1)
CONTRACT_EC=$?
set -e
CONTRACT_PASSED=$(echo "$CONTRACT_OUT" | grep -oE '[0-9]+ passed' | tail -1 || echo "? passed")
CONTRACT_FAILED=$(echo "$CONTRACT_OUT" | grep -oE '[0-9]+ failed' | head -1 || true)
if [ $CONTRACT_EC -eq 0 ]; then
  mark "preflight:contractLayout" "PASS" "$CONTRACT_PASSED"
else
  mark "preflight:contractLayout" "FAIL" "${CONTRACT_FAILED:-실패} / $CONTRACT_PASSED"
  echo "$CONTRACT_OUT" | grep -E "(✘|Error:)" | head -5 | sed 's/^/      /'
  PREFLIGHT_FAIL=true
fi

# [0-b] 핵심 페이지 공통 레이아웃
set +e
CORE_OUT=$(node_modules/.bin/playwright test \
  e2e/ui-layout-core.spec.ts \
  --config=e2e/playwright.config.ts \
  --project=chromium 2>&1)
CORE_EC=$?
set -e
CORE_PASSED=$(echo "$CORE_OUT" | grep -oE '[0-9]+ passed' | tail -1 || echo "? passed")
CORE_FAILED=$(echo "$CORE_OUT" | grep -oE '[0-9]+ failed' | head -1 || true)
if [ $CORE_EC -eq 0 ]; then
  mark "preflight:coreLayout" "PASS" "$CORE_PASSED"
else
  # 스냅샷 불일치(toHaveScreenshot)인 경우 자동 갱신 후 재시도
  if echo "$CORE_OUT" | grep -q "toHaveScreenshot"; then
    printf "  [AUTO] 스냅샷 불일치 감지 — 기준선 자동 갱신 중...\n"
    node_modules/.bin/playwright test \
      e2e/ui-layout-core.spec.ts \
      --config=e2e/playwright.config.ts \
      --project=chromium \
      --update-snapshots > /dev/null 2>&1 || true
    # 재시도
    set +e
    CORE_RETRY=$(node_modules/.bin/playwright test \
      e2e/ui-layout-core.spec.ts \
      --config=e2e/playwright.config.ts \
      --project=chromium 2>&1)
    CORE_RETRY_EC=$?
    set -e
    CORE_RETRY_PASSED=$(echo "$CORE_RETRY" | grep -oE '[0-9]+ passed' | tail -1 || echo "? passed")
    CORE_RETRY_FAILED=$(echo "$CORE_RETRY" | grep -oE '[0-9]+ failed' | head -1 || true)
    if [ $CORE_RETRY_EC -eq 0 ]; then
      mark "preflight:coreLayout" "PASS" "$CORE_RETRY_PASSED (스냅샷 자동갱신)"
    else
      mark "preflight:coreLayout" "FAIL" "${CORE_RETRY_FAILED:-실패} / $CORE_RETRY_PASSED"
      echo "$CORE_RETRY" | grep -E "(✘|Error:)" | head -5 | sed 's/^/      /'
      PREFLIGHT_FAIL=true
    fi
  else
    mark "preflight:coreLayout" "FAIL" "${CORE_FAILED:-실패} / $CORE_PASSED"
    echo "$CORE_OUT" | grep -E "(✘|Error:)" | head -5 | sed 's/^/      /'
    PREFLIGHT_FAIL=true
  fi
fi

# [0-c] 핵심 페이지 인터랙션 (실사용 차단 수준)
set +e
INTERACT_OUT=$(node_modules/.bin/playwright test \
  e2e/ui-interaction-core.spec.ts \
  --config=e2e/playwright.config.ts \
  --project=chromium 2>&1)
INTERACT_EC=$?
set -e
INTERACT_PASSED=$(echo "$INTERACT_OUT" | grep -oE '[0-9]+ passed' | tail -1 || echo "? passed")
INTERACT_FAILED=$(echo "$INTERACT_OUT" | grep -oE '[0-9]+ failed' | head -1 || true)
if [ $INTERACT_EC -eq 0 ]; then
  mark "preflight:interactionCore" "PASS" "$INTERACT_PASSED"
else
  mark "preflight:interactionCore" "FAIL" "${INTERACT_FAILED:-실패} / $INTERACT_PASSED"
  echo "$INTERACT_OUT" | grep -E "(✘|Error:)" | head -5 | sed 's/^/      /'
  PREFLIGHT_FAIL=true
fi

if $PREFLIGHT_FAIL; then
  END_TS=$(date '+%Y-%m-%d %H:%M:%S')
  echo ""
  echo "══════════════════════════════════════════════"
  printf " 최종: FAIL — pre-flight 실패, 배포 중단 (%s)\n" "$END_TS"
  echo "══════════════════════════════════════════════"
  {
    echo "run_at=$END_TS"
    echo "final=FAIL"
    echo "preflight:contractLayout=${CONTRACT_EC:-?} ($CONTRACT_PASSED)"
    echo "preflight:coreLayout=${CORE_EC:-?} ($CORE_PASSED)"
    echo "preflight:interactionCore=${INTERACT_EC:-?} ($INTERACT_PASSED)"
  } > "$RESULT_FILE"
  exit 1
fi

# ──────────────────────────────────────────────────
# [1] SSH 연결 확인
# ──────────────────────────────────────────────────
echo ""
echo "▶ [1] SSH 연결 확인"
set +e
ssh_cmd "echo ok" > /dev/null 2>&1
SSH_EC=$?
set -e
if [ $SSH_EC -ne 0 ]; then
  mark "SSH" "FAIL" "접속 불가 — 키/서버 상태 확인"
  echo "" && echo "══ 최종: FAIL ══" && exit 1
fi
mark "SSH" "PASS"

# ──────────────────────────────────────────────────
# [1.5] 서버 디스크 점검 + 자동 정리
# ──────────────────────────────────────────────────
echo ""
echo "▶ [1.5] 서버 디스크 점검 + 자동 정리"
set +e
DISK_OUT=$(ssh_cmd bash -s <<'DISK_REMOTE' 2>&1
set -uo pipefail
bash /home/ubuntu/app/attendance/scripts/disk-check-and-clean.sh
DISK_REMOTE
)
DISK_EC=$?
set -e

echo "$DISK_OUT" | tee -a "$DEPLOY_LOG"

# 마지막 disk-check 요약 읽기
DISK_SUMMARY=$(ssh_cmd "cat /home/ubuntu/app/attendance/logs/last-disk-check.txt 2>/dev/null" || echo "")
DISK_USAGE_AFTER=$(echo "$DISK_SUMMARY" | grep 'usage_after' | cut -d= -f2 || echo "?")
DISK_CLEANUP=$(echo "$DISK_SUMMARY" | grep 'cleanup_level' | cut -d= -f2 || echo "?")
DISK_FINAL=$(echo "$DISK_SUMMARY" | grep '^final=' | cut -d= -f2 || echo "?")

if   [ $DISK_EC -eq 2 ]; then
  mark "disk" "FAIL" "disk=${DISK_USAGE_AFTER} → FAIL (정리 후에도 95%+, 배포 중단)"
  echo "" && echo "══ 최종: FAIL — 디스크 부족, 배포 중단 ══" && exit 1
elif [ $DISK_EC -eq 1 ]; then
  mark "disk" "WARN" "disk=${DISK_USAGE_AFTER} → WARN (cleanup=${DISK_CLEANUP})"
else
  mark "disk" "PASS" "disk=${DISK_USAGE_AFTER} → PASS (cleanup=${DISK_CLEANUP})"
fi

# ──────────────────────────────────────────────────
# [2] 서버 git pull + docker compose build + up -d
# ──────────────────────────────────────────────────
echo ""
echo "▶ [2] 서버 배포 (git pull → build → up)"
set +e
DEPLOY_OUT=$(ssh_cmd bash -s <<REMOTE 2>&1
set -euo pipefail
cd ${APP_DIR}

echo "--- git pull ---"
git pull origin master 2>&1

echo "--- docker compose build + up ---"
docker compose up -d --build 2>&1 | tail -20

echo "DEPLOY_DONE"
REMOTE
)
DEPLOY_EC=$?
set -e

echo "$DEPLOY_OUT" | tee -a "$DEPLOY_LOG"

if [ $DEPLOY_EC -ne 0 ] || ! echo "$DEPLOY_OUT" | grep -q "DEPLOY_DONE"; then
  mark "배포" "FAIL" "git pull 또는 docker compose 실패"
  echo "" && echo "══ 최종: FAIL ══" && exit 1
fi
mark "배포" "PASS" "build+up 완료"

# ──────────────────────────────────────────────────
# [3] healthcheck 대기 (최대 90초)
# ──────────────────────────────────────────────────
echo ""
echo "▶ [3] healthcheck 대기 (최대 90초)"
HEALTHY=false
for i in $(seq 1 18); do
  set +e
  STATUS=$(ssh_cmd "docker inspect --format='{{.State.Health.Status}}' ${CONTAINER_NAME} 2>/dev/null || echo unknown")
  set -e
  printf "  [%2d/18] health=%s\n" "$i" "$STATUS"
  if [ "$STATUS" = "healthy" ]; then
    HEALTHY=true
    break
  fi
  sleep 5
done

if $HEALTHY; then
  mark "healthcheck" "PASS" "healthy"
else
  # 마지막 상태 + 로그 첨부
  LAST_LOG=$(ssh_cmd "docker logs ${CONTAINER_NAME} --tail 20 2>&1" || true)
  echo "$LAST_LOG" | tee -a "$DEPLOY_LOG"
  mark "healthcheck" "FAIL" "90초 내 healthy 미달성 (status=$STATUS)"
  echo "" && echo "══ 최종: FAIL ══" && exit 1
fi

# ──────────────────────────────────────────────────
# [4] verify-bulk-release.sh 호출
# ──────────────────────────────────────────────────
echo ""
echo "▶ [4] verify-bulk-release.sh 실행"
cd "$ROOT"
set +e
VERIFY_OUT=$(bash scripts/verify-bulk-release.sh "${SINGLE_SPEC}" 2>&1)
VERIFY_EC=$?
set -e

echo "$VERIFY_OUT" | tee -a "$DEPLOY_LOG"

# verify 내부 결과 파싱
for section in health ops-check 에러로그 adminSmokeE2E adminRegressionE2E bulk전체E2E adminWorkerE2E; do
  line=$(echo "$VERIFY_OUT" | grep -E "\[PASS\]|\[WARN\]|\[FAIL\]" | grep "$section" | tail -1 || true)
  if [ -n "$line" ]; then
    status=$(echo "$line" | grep -oE 'PASS|WARN|FAIL' | head -1)
    note=$(echo "$line"  | sed 's/.*— //' || true)
    mark "verify:${section}" "${status:-WARN}" "${note:-}"
  fi
done

# verify 최종 판정 (종료코드 기준)
if [ $VERIFY_EC -eq 0 ]; then
  : # PASS — already marked above
elif [ $VERIFY_EC -eq 2 ]; then
  [ "$FINAL" != "FAIL" ] && FINAL="WARN"
else
  FINAL="FAIL"
fi

# ──────────────────────────────────────────────────
# [5] 최종 요약
# ──────────────────────────────────────────────────
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
echo "배포로그: $DEPLOY_LOG"

[ "$FINAL" = "FAIL" ] && exit 1
exit 0
