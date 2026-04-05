#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
# pw-run.sh — Playwright 로컬/서버 공용 실행기
#
# 사용:
#   MODE=setup  TARGET=local   bash scripts/pw-run.sh   # 로그인 → 세션 저장 (headed)
#   MODE=check  TARGET=local   bash scripts/pw-run.sh   # 현재 설정 점검
#   MODE=check  TARGET=server  bash scripts/pw-run.sh   # 서버 무인 점검
#   MODE=apply  TARGET=local   bash scripts/pw-run.sh   # 값 입력 후 승인 대기
#
# 환경:
#   TARGET=local  → headed (setup/apply), .env.local 로드
#   TARGET=server → headless, .env.server 로드, storageState 필수
#
# 출력:
#   logs/reports/last-check.txt — 현재값/목표값/불일치/PASS/FAIL
# ══════════════════════════════════════════════════════════════
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

MODE="${MODE:-check}"
TARGET="${TARGET:-server}"
EXTRA_SPEC="${1:-}"

# ── .env 로드 ────────────────────────────────────────────────
ENV_FILE="e2e/.env.${TARGET}"
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

export TARGET MODE
export BASE_URL="${BASE_URL:-https://attendance.haehan-ai.kr}"

# ── 경로 ─────────────────────────────────────────────────────
export PATH="node_modules/.bin:$PATH"
# TARGET 별 state 파일 분리 — local/server 공용 금지
STATE_FILE="logs/playwright-state/admin.${TARGET}.json"
export STATE_FILE
REPORT_FILE="logs/reports/last-check.txt"
mkdir -p "logs/playwright-state" "logs/reports"

PW="node_modules/.bin/playwright"
CONFIG="e2e/playwright.config.ts"

# ── 헬퍼 ─────────────────────────────────────────────────────
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

run_spec() {
  local label="$1" spec="$2" project="${3:-chromium}"
  set +e
  out=$($PW test "$spec" --config="$CONFIG" --project="$project" 2>&1)
  ec=$?
  set -e
  passed=$(echo "$out" | grep -oE '[0-9]+ passed' | tail -1 || echo "?")
  failed=$(echo "$out" | grep -oE '[0-9]+ failed' | head -1 || true)
  if [ $ec -eq 0 ]; then
    mark "$label" "PASS" "$passed"
  else
    mark "$label" "FAIL" "${failed:-실패} / $passed"
    echo "$out" | grep -E "(✘|Error:|×)" | head -5 | sed 's/^/      /'
  fi
}

echo ""
echo "══════════════════════════════════════════════"
echo " pw-run  MODE=$MODE  TARGET=$TARGET"
echo " BASE_URL=$BASE_URL"
echo "══════════════════════════════════════════════"

# ════════════════════════════════════════════════════════════════
# MODE=setup — 로그인 → storageState 저장
# ════════════════════════════════════════════════════════════════
if [ "$MODE" = "setup" ]; then
  # ── 서버 보호: setup 절대 금지 ─────────────────────────────
  if [ "$TARGET" = "server" ]; then
    echo "FAIL  setup 은 TARGET=server 에서 금지됨 (로그인 생성 금지)"
    echo "조치: MODE=setup TARGET=local bash scripts/pw-run.sh 로 로컬에서 실행"
    exit 1
  fi
  if [ "$TARGET" != "local" ]; then
    echo "FAIL  setup 은 TARGET=local 에서만 실행"
    exit 1
  fi
  if [ -z "${ADMIN_PASSWORD:-}" ]; then
    echo "  오류: ADMIN_PASSWORD 필요 (e2e/.env.local 에 설정)"
    exit 1
  fi
  echo ""
  echo "▶ 관리자 로그인 → storageState 저장 (headed)"
  set +e
  out=$($PW test e2e/auth/admin.setup.ts \
    --config="$CONFIG" --project=auth-setup 2>&1)
  ec=$?
  set -e
  echo "$out"
  if [ $ec -eq 0 ] && [ -f "$STATE_FILE" ]; then
    echo "PASS  저장: $STATE_FILE"
    echo "다음: MODE=check TARGET=local bash scripts/pw-run.sh"
    exit 0
  else
    echo "FAIL  storageState 저장 실패"
    exit 1
  fi
fi

# ════════════════════════════════════════════════════════════════
# MODE=check — 현재 설정 점검 + PASS/FAIL 판정
# ════════════════════════════════════════════════════════════════
if [ "$MODE" = "check" ]; then
  # ── 서버 보호: storageState 없으면 즉시 FAIL ──────────────
  if [ "$TARGET" = "server" ] && [ ! -f "$STATE_FILE" ]; then
    echo "FAIL  storageState 없음: $STATE_FILE"
    echo "조치: MODE=setup TARGET=local bash scripts/pw-run.sh"
    exit 1
  fi

  run_spec "smoke"        "e2e/admin-smoke.spec.ts"                    "chromium"
  run_spec "layout"       "e2e/ui-layout-core.spec.ts"                 "ui-layout-core"
  run_spec "contract"     "e2e/mobile-contract-form-layout.spec.ts"    "mobile-contract-layout"
  run_spec "interaction"  "e2e/ui-interaction-core.spec.ts"            "chromium"
  [ -n "$EXTRA_SPEC" ] && run_spec "extra" "$EXTRA_SPEC" "chromium"

  # ── 출력: 4줄 고정 ─────────────────────────────────────────
  FAILS=()
  SNAP_FAIL=false
  for r in "${RESULTS[@]}"; do
    IFS='|' read -r label status note <<< "$r"
    if [ "$status" = "FAIL" ]; then
      FAILS+=("$label")
      echo "$note" | grep -qi "snapshot\|toHaveScreenshot" && SNAP_FAIL=true
    fi
  done

  TS=$(date '+%Y-%m-%d %H:%M:%S')
  echo ""
  printf "%s  [%s]  %s\n" "$FINAL" "$TARGET" "$TS"
  if [ ${#FAILS[@]} -gt 0 ]; then
    echo "실패: ${FAILS[*]}"
  fi
  if $SNAP_FAIL; then
    echo "자동조치: MODE=fix bash scripts/pw-run.sh"
  elif [ ${#FAILS[@]} -gt 0 ]; then
    echo "자동조치: 불가 — 코드 수정 필요"
  fi
  if [ "$FINAL" = "FAIL" ]; then
    echo "다음: 위 항목 수정 후 MODE=check TARGET=${TARGET} bash scripts/pw-run.sh"
  fi

  # 파일 기록 (상세는 파일에만)
  {
    echo "run_at=$TS  mode=$MODE  target=$TARGET  final=$FINAL"
    for r in "${RESULTS[@]}"; do
      IFS='|' read -r label status note <<< "$r"
      echo "${label}=${status}${note:+ ($note)}"
    done
  } > "$REPORT_FILE"

  [ "$FINAL" = "FAIL" ] && exit 1
  exit 0
fi

# ════════════════════════════════════════════════════════════════
# MODE=fix — 스냅샷 기준선 자동 갱신
# ════════════════════════════════════════════════════════════════
if [ "$MODE" = "fix" ]; then
  echo ""
  echo "▶ 스냅샷 자동 갱신"
  $PW test e2e/ui-layout-core.spec.ts \
    --config="$CONFIG" --project=ui-layout-core \
    --update-snapshots
  $PW test e2e/mobile-contract-form-layout.spec.ts \
    --config="$CONFIG" --project=mobile-contract-layout \
    --update-snapshots
  echo "  ✓ 스냅샷 갱신 완료 — check 재실행 필요"
  exit 0
fi

# ════════════════════════════════════════════════════════════════
# MODE=apply — 값 입력 후 저장 직전 승인 대기 (로컬 전용)
# ════════════════════════════════════════════════════════════════
if [ "$MODE" = "apply" ]; then
  if [ "$TARGET" != "local" ]; then
    echo "  오류: apply 는 TARGET=local 에서만 실행"
    exit 1
  fi
  APPLY_SPEC="${EXTRA_SPEC:-e2e/admin-apply.spec.ts}"
  if [ ! -f "$APPLY_SPEC" ]; then
    echo "  오류: apply 스펙 없음 — $APPLY_SPEC"
    exit 1
  fi
  echo ""
  echo "▶ apply 모드 (headed, 저장 직전 일시정지)"
  $PW test "$APPLY_SPEC" \
    --config="$CONFIG" --project=chromium \
    --headed --debug
  exit 0
fi

echo "  오류: 알 수 없는 MODE=$MODE (setup|check|fix|apply)"
exit 1
