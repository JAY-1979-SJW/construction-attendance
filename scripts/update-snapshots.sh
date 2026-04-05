#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
# update-snapshots.sh — 레이아웃 스냅샷 기준선 일괄 갱신
#
# chromium 프로젝트(deploy 스크립트 기준)와
# ui-layout-core 프로젝트(단독 실행 기준) 양쪽을 동시에 갱신한다.
#
# 사용법:
#   bash scripts/update-snapshots.sh             # 전체 갱신
#   bash scripts/update-snapshots.sh --grep workers  # 특정 패턴만
# ══════════════════════════════════════════════════════════════
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

export PATH="/c/Program Files/nodejs:$PATH"

GREP_ARG="${1:-}"
GREP_FLAG=""
[ -n "$GREP_ARG" ] && GREP_FLAG="--grep ${GREP_ARG#--grep }"

echo "══════════════════════════════════════════════"
echo " update-snapshots 시작: $(date '+%Y-%m-%d %H:%M:%S')"
echo "══════════════════════════════════════════════"

# [1] chromium 프로젝트 (deploy-and-verify.sh 기준)
echo ""
echo "▶ [1] chromium 프로젝트 갱신"
set +e
OUT1=$(node_modules/.bin/playwright test \
  e2e/ui-layout-core.spec.ts \
  --config=e2e/playwright.config.ts \
  --project=chromium \
  --update-snapshots $GREP_FLAG 2>&1)
EC1=$?
set -e
PASSED1=$(echo "$OUT1" | grep -oE '[0-9]+ passed' | tail -1 || echo "? passed")
REGEN1=$(echo "$OUT1" | grep -c "re-generated\|writing actual" || true)
printf "  [%s] %s — %s 갱신\n" "$([ $EC1 -eq 0 ] && echo PASS || echo FAIL)" "$PASSED1" "$REGEN1"

# [2] ui-layout-core 프로젝트 (단독 실행 기준)
echo ""
echo "▶ [2] ui-layout-core 프로젝트 갱신"
set +e
OUT2=$(node_modules/.bin/playwright test \
  e2e/ui-layout-core.spec.ts \
  --config=e2e/playwright.config.ts \
  --project=ui-layout-core \
  --update-snapshots $GREP_FLAG 2>&1)
EC2=$?
set -e
PASSED2=$(echo "$OUT2" | grep -oE '[0-9]+ passed' | tail -1 || echo "? passed")
REGEN2=$(echo "$OUT2" | grep -c "re-generated\|writing actual" || true)
printf "  [%s] %s — %s 갱신\n" "$([ $EC2 -eq 0 ] && echo PASS || echo FAIL)" "$PASSED2" "$REGEN2"

echo ""
echo "══════════════════════════════════════════════"
if [ $EC1 -eq 0 ] && [ $EC2 -eq 0 ]; then
  echo " 완료: 양쪽 프로젝트 스냅샷 갱신 성공"
  echo " → git add e2e/ui-layout-core.spec.ts-snapshots/"
  echo " → git commit -m 'test: 스냅샷 기준선 갱신'"
  exit 0
else
  echo " 일부 실패 — 위 오류 확인 후 재실행"
  exit 1
fi
