#!/usr/bin/env bash
# ══════════════════════════════════════════════════════
# ops-disk-recover.sh — 디스크 점검 + 필요 시 안전 정리 + 재검증
#
# 판정 기준: PASS 0~84% / WARN 85~94% / FAIL 95%+
#
# 사용법:
#   bash scripts/ops-disk-recover.sh              # 점검 + 필요 시 정리
#   bash scripts/ops-disk-recover.sh --check-only # 점검만 (정리 금지)
#
# 의존 스크립트:
#   - disk-check-and-clean.sh  (실제 cleanup 위임)
#   - ops-check.sh             (재검증)
#
# 안전 규칙:
#   - running container 중지 금지
#   - docker compose down 금지
#   - volume 삭제 금지
#   - prune 로직 직접 구현 금지 → disk-check-and-clean.sh에만 위임
# ══════════════════════════════════════════════════════
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLEANUP_SCRIPT="$SCRIPT_DIR/disk-check-and-clean.sh"
OPS_CHECK_SCRIPT="$SCRIPT_DIR/ops-check.sh"
LOG_DIR="${SCRIPT_DIR}/../logs"
LAST_CHECK_FILE="$LOG_DIR/last-disk-check.txt"

CHECK_ONLY=false
for arg in "$@"; do
  case "$arg" in --check-only) CHECK_ONLY=true ;; esac
done

# ── 유틸 ──────────────────────────────────────────────
get_disk_pct() {
  df / 2>/dev/null | awk 'NR==2 {gsub(/%/,"",$5); print $5}'
}

judge_disk() {
  local pct=$1
  if   [ "$pct" -ge 95 ]; then echo "FAIL"
  elif [ "$pct" -ge 85 ]; then echo "WARN"
  else                          echo "PASS"
  fi
}

get_container_status() {
  docker inspect --format='{{.State.Status}}' "$1" 2>/dev/null || echo "unknown"
}

# ── 초기 측정 ──────────────────────────────────────────
DISK_BEFORE=$(get_disk_pct)
MARK_BEFORE=$(judge_disk "$DISK_BEFORE")

# ── --check-only ───────────────────────────────────────
if $CHECK_ONLY; then
  ATT_STATUS=$(get_container_status attendance)
  MAT_STATUS=$(get_container_status material-api)
  printf "disk_before        : %s%%\n"  "$DISK_BEFORE"
  printf "disk_mark_before   : %s\n"    "$MARK_BEFORE"
  printf "action             : none (--check-only)\n"
  printf "disk_after         : %s%%\n"  "$DISK_BEFORE"
  printf "disk_mark_after    : %s\n"    "$MARK_BEFORE"
  printf "reclaimed_total    : 0\n"
  printf "attendance_status  : %s\n"    "$ATT_STATUS"
  printf "material_api_status: %s\n"    "$MAT_STATUS"
  printf "final              : %s\n"    "$MARK_BEFORE"
  [ "$MARK_BEFORE" = "FAIL" ] && exit 2
  [ "$MARK_BEFORE" = "WARN" ] && exit 1
  exit 0
fi

# ── PASS면 정리 없이 종료 ──────────────────────────────
if [ "$MARK_BEFORE" = "PASS" ]; then
  ATT_STATUS=$(get_container_status attendance)
  MAT_STATUS=$(get_container_status material-api)
  printf "disk_before        : %s%%\n"  "$DISK_BEFORE"
  printf "disk_mark_before   : %s\n"    "PASS"
  printf "action             : none\n"
  printf "disk_after         : %s%%\n"  "$DISK_BEFORE"
  printf "disk_mark_after    : %s\n"    "PASS"
  printf "reclaimed_total    : 0\n"
  printf "attendance_status  : %s\n"    "$ATT_STATUS"
  printf "material_api_status: %s\n"    "$MAT_STATUS"
  printf "final              : PASS\n"
  exit 0
fi

# ── WARN / FAIL: dry-run → cleanup ────────────────────
printf ">> [dry-run] 정리 예상 결과:\n"
bash "$CLEANUP_SCRIPT" --dry-run 2>&1 | grep -E 'docker|cache|reclaimable|Build Cache|Images' | head -6 || true

printf "\n>> [cleanup] 실제 정리 실행 중...\n"
set +e
bash "$CLEANUP_SCRIPT" 2>&1 | grep -E '정리|reclaimed|PASS|WARN|FAIL|final=' | head -8
CLEANUP_EC=$?
set -e

# ── 재측정 ─────────────────────────────────────────────
DISK_AFTER=$(get_disk_pct)
MARK_AFTER=$(judge_disk "$DISK_AFTER")
RECLAIMED_PCT=$((DISK_BEFORE - DISK_AFTER))
RECLAIMED_STR="${RECLAIMED_PCT}%p 감소 (${DISK_BEFORE}% → ${DISK_AFTER}%)"

# ── 서비스 상태 ────────────────────────────────────────
ATT_STATUS=$(get_container_status attendance)
MAT_STATUS=$(get_container_status material-api)

# ── ops-check 재검증 ──────────────────────────────────
printf "\n>> [ops-check] 재검증 중...\n"
set +e
OPS_OUT=$(bash "$OPS_CHECK_SCRIPT" 2>&1)
OPS_EC=$?
set -e
echo "$OPS_OUT" | grep -E '\[(PASS|WARN|FAIL)\]' | grep -E 'disk|health|db' | head -5 || true

# ── 최종 판정 ──────────────────────────────────────────
FINAL="$MARK_AFTER"
if [ "$ATT_STATUS" != "running" ] && [ "$ATT_STATUS" != "healthy" ]; then
  FINAL="FAIL"
fi

# ── 결과 출력 ──────────────────────────────────────────
printf "\n"
printf "disk_before        : %s%%\n"  "$DISK_BEFORE"
printf "disk_mark_before   : %s\n"    "$MARK_BEFORE"
printf "action             : cleanup executed\n"
printf "disk_after         : %s%%\n"  "$DISK_AFTER"
printf "disk_mark_after    : %s\n"    "$MARK_AFTER"
printf "reclaimed_total    : %s\n"    "$RECLAIMED_STR"
printf "attendance_status  : %s\n"    "$ATT_STATUS"
printf "material_api_status: %s\n"    "$MAT_STATUS"
printf "final              : %s\n"    "$FINAL"

[ "$FINAL" = "FAIL" ] && exit 2
[ "$FINAL" = "WARN" ] && exit 1
exit 0
