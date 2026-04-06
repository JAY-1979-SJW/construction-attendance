#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
# disk-check-and-clean.sh — 디스크 사용률 점검 + 자동 정리
#
# 임계치:
#   85% 이상 → WARN (정리 없이 경고만)
#   90% 이상 → 자동 정리 실행 (builder prune + image prune)
#   95% 이상 → 강제 정리 (+ journalctl vacuum) 후 재측정
#   정리 후에도 95% 이상 → exit 2 (배포 스크립트에서 FAIL 처리 가능)
#
# 자동 실행 금지:
#   - /tmp 정리
#   - 구버전 태그 이미지 삭제 (후보만 로그에 기록)
#   - 실행 중 컨테이너/현재 latest 이미지 삭제
#
# 호출:
#   bash scripts/disk-check-and-clean.sh
#   bash scripts/disk-check-and-clean.sh --dry-run  (정리 없이 측정만)
#
# 종료코드:
#   0 = 정상 (85% 미만, 또는 정리 후 95% 미만)
#   1 = WARN (85%~90% 미만)
#   2 = FAIL (정리 후에도 95% 이상)
#
# 로그: ~/app/attendance/logs/disk-check-YYYYMMDD_HHMMSS.log
# ══════════════════════════════════════════════════════════════
set -uo pipefail

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

LOG_DIR="${DISK_LOG_DIR:-/home/ubuntu/app/attendance/logs}"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/disk-check-$(date +%Y%m%d_%H%M%S).log"

# ── 색상 ────────────────────────────────────────────
RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; NC='\033[0m'

log() { echo -e "$*" | tee -a "$LOG_FILE"; }
log_plain() { echo "$*" | tee -a "$LOG_FILE"; }

# ── 사용률 추출 함수 ────────────────────────────────
get_disk_usage() {
  df / | awk 'NR==2 {gsub(/%/,"",$5); print $5}'
}

# ── 스냅샷 함수 ────────────────────────────────────
snapshot() {
  local label="$1"
  log ""
  log "── [$label] df -h ──"
  df -h / | tee -a "$LOG_FILE"
  log ""
  log "── [$label] docker system df ──"
  docker system df 2>/dev/null | tee -a "$LOG_FILE" || true
}

# ── 구버전 태그 후보 로깅 (자동 삭제 안 함) ─────────
log_old_tag_candidates() {
  log ""
  log "── [후보] 구버전 태그 이미지 (자동 삭제 안 함 — 수동 확인 필요) ──"
  # 날짜 패턴 태그 (2026-xx-xx 형식) 또는 backup 태그
  docker images --format '{{.Repository}}:{{.Tag}}\t{{.Size}}\t{{.CreatedSince}}' \
    | grep -E ':[0-9]{4}-[0-9]{2}-[0-9]{2}|:backup|:old|:prev' \
    | tee -a "$LOG_FILE" || log "(없음)"
  log ""
  log "── [후보] 현재 실행 중인 컨테이너 목록 ──"
  docker ps --format '{{.Names}}\t{{.Image}}' | tee -a "$LOG_FILE" || true
}

# ── 자동 정리 함수 ──────────────────────────────────
run_cleanup() {
  local level="$1"   # "standard" | "full"

  log ""
  log "━━ 자동 정리 시작 (level=$level) ━━"

  # [1] Builder cache (dangling 포함, 완전 안전)
  log "  [1] docker builder prune -f"
  if $DRY_RUN; then
    log "      → DRY-RUN: 실행 안 함"
  else
    docker builder prune -f 2>&1 | tee -a "$LOG_FILE" || true
  fi

  # [2] Dangling 이미지 (태그 없는 <none>:<none>)
  log "  [2] docker image prune -f (dangling only)"
  if $DRY_RUN; then
    log "      → DRY-RUN: 실행 안 함"
    DANGLING_COUNT=$(docker images -f dangling=true -q | wc -l)
    log "      (삭제 대상 dangling: ${DANGLING_COUNT}개)"
  else
    docker image prune -f 2>&1 | tee -a "$LOG_FILE" || true
  fi

  # [3] full 레벨: journalctl vacuum
  if [[ "$level" == "full" ]]; then
    log "  [3] journalctl --vacuum-size=50M"
    if $DRY_RUN; then
      log "      → DRY-RUN: 실행 안 함"
    else
      journalctl --vacuum-size=50M 2>&1 | tee -a "$LOG_FILE" || true
    fi
  fi

  # 구버전 태그 후보 기록 (삭제 안 함)
  log_old_tag_candidates
  log "━━ 자동 정리 완료 ━━"
}

# ══ 메인 ═══════════════════════════════════════════
RUN_TS=$(date '+%Y-%m-%d %H:%M:%S')
log "══════════════════════════════════════════════"
log " disk-check-and-clean 시작: $RUN_TS"
$DRY_RUN && log " ※ DRY-RUN 모드 (측정만)"
log "══════════════════════════════════════════════"

# 사전 스냅샷
snapshot "정리 전"
USAGE_BEFORE=$(get_disk_usage)
log ""
log "  디스크 사용률: ${USAGE_BEFORE}%"

CLEANED=false
CLEANUP_LEVEL="none"

# ── 임계치 분기 ────────────────────────────────────
if   [ "$USAGE_BEFORE" -ge 95 ]; then
  log ""
  log -e "${RED}  [ALERT] 사용률 ${USAGE_BEFORE}% — 95% 초과, 강제 정리 실행${NC}"
  CLEANUP_LEVEL="full"
  run_cleanup "full"
  CLEANED=true

elif [ "$USAGE_BEFORE" -ge 90 ]; then
  log ""
  log -e "${YELLOW}  [WARN] 사용률 ${USAGE_BEFORE}% — 90% 초과, 표준 정리 실행${NC}"
  CLEANUP_LEVEL="standard"
  run_cleanup "standard"
  CLEANED=true

elif [ "$USAGE_BEFORE" -ge 85 ]; then
  log ""
  log -e "${YELLOW}  [WARN] 사용률 ${USAGE_BEFORE}% — 85% 초과, 경고 (정리 없음)${NC}"
  log_old_tag_candidates

else
  log ""
  log -e "${GREEN}  [OK] 사용률 ${USAGE_BEFORE}% — 정상 (정리 없음)${NC}"
fi

# ── 정리 후 재측정 ─────────────────────────────────
USAGE_AFTER="$USAGE_BEFORE"
RECLAIMED_MSG="(정리 없음)"

if $CLEANED; then
  snapshot "정리 후"
  USAGE_AFTER=$(get_disk_usage)
  RECLAIMED=$(( USAGE_BEFORE - USAGE_AFTER ))
  RECLAIMED_MSG="${RECLAIMED}%p 회수 (${USAGE_BEFORE}% → ${USAGE_AFTER}%)"
  log ""
  log "  회수 결과: $RECLAIMED_MSG"
fi

# ── 최종 판정 ──────────────────────────────────────
log ""
log "══════════════════════════════════════════════"

FINAL_STATUS="PASS"
EXIT_CODE=0

if   [ "$USAGE_AFTER" -ge 95 ]; then
  FINAL_STATUS="FAIL"
  EXIT_CODE=2
  log -e "${RED}  최종 판정: FAIL — 정리 후에도 ${USAGE_AFTER}% (95% 이상)${NC}"
  log "  → 배포 전 수동 개입 필요"

elif [ "$USAGE_AFTER" -ge 85 ]; then
  FINAL_STATUS="WARN"
  EXIT_CODE=1
  log -e "${YELLOW}  최종 판정: WARN — 사용률 ${USAGE_AFTER}% (85%~95%)${NC}"
  log "  → 배포 진행 가능하나 조기 정리 권장"

else
  FINAL_STATUS="PASS"
  EXIT_CODE=0
  log -e "${GREEN}  최종 판정: PASS — 사용률 ${USAGE_AFTER}%${NC}"
fi

# 요약 기록
{
  echo "run_at=$RUN_TS"
  echo "usage_before=${USAGE_BEFORE}%"
  echo "cleanup_level=$CLEANUP_LEVEL"
  echo "usage_after=${USAGE_AFTER}%"
  echo "reclaimed=$RECLAIMED_MSG"
  echo "final=$FINAL_STATUS"
} | tee -a "$LOG_FILE"

log "══════════════════════════════════════════════"
log "로그: $LOG_FILE"

# last-disk-check.txt 갱신 (ops-check 등에서 참조 가능)
LAST_FILE="$LOG_DIR/last-disk-check.txt"
{
  echo "run_at=$RUN_TS"
  echo "usage_before=${USAGE_BEFORE}%"
  echo "usage_after=${USAGE_AFTER}%"
  echo "cleanup_level=$CLEANUP_LEVEL"
  echo "reclaimed=$RECLAIMED_MSG"
  echo "final=$FINAL_STATUS"
} > "$LAST_FILE"

exit $EXIT_CODE
