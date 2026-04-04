#!/usr/bin/env bash
# ──────────────────────────────────────────────
# ops_daily_report.sh — 일일 통합 운영 리포트
#
# 점검 항목:
#   1. DB 백업 파일 (24시간 이내 + 크기 정상)
#   2. JWT sign→verify 런타임 검증
#   3. 마지막 정기 점검 상태
#   4. 마지막 컨테이너 상태
#
# 사용법: bash scripts/ops_daily_report.sh
# cron:   0 7 * * * /bin/bash -c 'set -a; source .../ops-bot/.env; set +a; bash .../ops_daily_report.sh'
# ──────────────────────────────────────────────
set -uo pipefail

# ── 중복 실행 방지 ──
LOCK_FILE="/tmp/ops_daily_report_sh.lock"
if [ -f "$LOCK_FILE" ]; then
  OLD_PID=$(cat "$LOCK_FILE" 2>/dev/null || echo "")
  if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    echo "[SKIP] ops_daily_report.sh 이미 실행 중 (PID=$OLD_PID) — 중복 실행 차단"
    exit 1
  fi
fi
echo $$ > "$LOCK_FILE"
trap "rm -f '$LOCK_FILE'" EXIT INT TERM

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$SCRIPT_DIR/../logs"
OPS_BOT_ENV="$SCRIPT_DIR/../ops-bot/.env"
JWT_SCRIPT="$SCRIPT_DIR/../ops-bot/scripts/check_jwt_runtime.sh"
TELEGRAM="$SCRIPT_DIR/telegram.sh"
BACKUP_DIR="/mnt/nas/attendance/backups"

mkdir -p "$LOG_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT="$LOG_DIR/daily_report_${TIMESTAMP}.log"

PASS=0; FAIL=0; WARN=0
RESULTS=""

out()  { echo "$1" | tee -a "$REPORT"; }
result_pass() { PASS=$((PASS+1)); RESULTS="${RESULTS}PASS|$1|${2:-}\n"; out "  [PASS] $1${2:+ → $2}"; }
result_fail() { FAIL=$((FAIL+1)); RESULTS="${RESULTS}FAIL|$1|${2:-}\n"; out "  [FAIL] $1${2:+ → $2}"; }
result_warn() { WARN=$((WARN+1)); RESULTS="${RESULTS}WARN|$1|${2:-}\n"; out "  [WARN] $1${2:+ → $2}"; }

out "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
out " 일일 통합 리포트 — $(date '+%Y-%m-%d %H:%M:%S')"
out "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
out ""

# ═══════════════════════════════════════════
# [1] DB 백업
# ═══════════════════════════════════════════
out "[1] DB 백업"
LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/attendance_*.sql.gz 2>/dev/null | head -1)
if [ -z "$LATEST_BACKUP" ]; then
  result_fail "DB 백업" "백업 파일 없음 ($BACKUP_DIR)"
else
  BACKUP_NAME=$(basename "$LATEST_BACKUP")
  BACKUP_SIZE=$(du -h "$LATEST_BACKUP" 2>/dev/null | cut -f1)
  BACKUP_SIZE_BYTES=$(stat -c%s "$LATEST_BACKUP" 2>/dev/null || echo 0)
  # 24시간 기준: find -mtime 0은 오늘 날짜 파일만
  RECENT=$(find "$BACKUP_DIR" -name "attendance_*.sql.gz" -mmin -1500 2>/dev/null | wc -l | tr -d ' ')
  if [ "${RECENT:-0}" -gt 0 ] && [ "${BACKUP_SIZE_BYTES:-0}" -gt 1048576 ]; then
    result_pass "DB 백업" "$BACKUP_NAME ($BACKUP_SIZE)"
  elif [ "${BACKUP_SIZE_BYTES:-0}" -le 1048576 ]; then
    result_fail "DB 백업" "크기 이상 ($BACKUP_SIZE) — $BACKUP_NAME"
  else
    result_warn "DB 백업" "25시간 초과 — 최신: $BACKUP_NAME ($BACKUP_SIZE)"
  fi
fi
out ""

# ═══════════════════════════════════════════
# [2] JWT 런타임 검증
# ═══════════════════════════════════════════
out "[2] JWT 런타임"
# ops-bot/.env 로드 (OPS_LOGIN_ID, OPS_LOGIN_PW, DB_PASSWORD 등)
if [ -f "$OPS_BOT_ENV" ]; then
  set -a; source "$OPS_BOT_ENV"; set +a
fi
if [ ! -f "$JWT_SCRIPT" ]; then
  # 서버 배포 경로 폴백
  JWT_SCRIPT="$HOME/app/ops-bot/scripts/check_jwt_runtime.sh"
fi
if [ -f "$JWT_SCRIPT" ]; then
  JWT_OUT=$(timeout 30 bash "$JWT_SCRIPT" 2>&1) || true
  if echo "$JWT_OUT" | grep -q "PASS"; then
    JWT_DETAIL=$(echo "$JWT_OUT" | grep -E 'OK:|결과' | tr '\n' ' ' | head -c 80)
    result_pass "JWT sign→verify" "${JWT_DETAIL:-정상}"
  else
    JWT_ERR=$(echo "$JWT_OUT" | grep -iE 'fail|error|FAIL' | head -1)
    result_fail "JWT sign→verify" "${JWT_ERR:-검증 실패}"
  fi
else
  result_warn "JWT 검증" "check_jwt_runtime.sh 없음"
fi
out ""

# ═══════════════════════════════════════════
# [3] 마지막 정기 점검 (last_check_status.txt)
# ═══════════════════════════════════════════
out "[3] 정기 점검 상태"
STATUS_FILE="$LOG_DIR/last_check_status.txt"
if [ -f "$STATUS_FILE" ]; then
  LAST_TS=$(grep '^last_check=' "$STATUS_FILE" | cut -d= -f2)
  LAST_MODE=$(grep '^mode=' "$STATUS_FILE" | cut -d= -f2 || echo "unknown")
  # full 모드: web/scenario/audit/container 항목
  # quick 모드: fail= 카운트
  if grep -q '^fail=' "$STATUS_FILE"; then
    LAST_FAIL=$(grep '^fail=' "$STATUS_FILE" | cut -d= -f2)
    if [ "${LAST_FAIL:-0}" -eq 0 ]; then
      result_pass "정기 점검" "${LAST_TS} (${LAST_MODE})"
    else
      result_fail "정기 점검" "FAIL ${LAST_FAIL}건 — ${LAST_TS}"
    fi
  else
    # full 모드: FAIL이 있는지 확인
    if grep -qE '=FAIL' "$STATUS_FILE"; then
      FAIL_ITEMS=$(grep '=FAIL' "$STATUS_FILE" | cut -d= -f1 | tr '\n' ' ')
      result_fail "정기 점검" "${FAIL_ITEMS}FAIL — ${LAST_TS}"
    else
      result_pass "정기 점검" "${LAST_TS} (${LAST_MODE})"
    fi
  fi
else
  result_warn "정기 점검" "상태 파일 없음"
fi
out ""

# ═══════════════════════════════════════════
# [4] 컨테이너 상태 (last_container_status.txt)
# ═══════════════════════════════════════════
out "[4] 컨테이너 상태"
CONTAINER_FILE="$LOG_DIR/last_container_status.txt"
if [ -f "$CONTAINER_FILE" ]; then
  C_TS=$(grep '^timestamp=' "$CONTAINER_FILE" | cut -d= -f2 || echo "unknown")
  C_FAIL=$(grep '^fail=' "$CONTAINER_FILE" | cut -d= -f2 || echo "0")
  C_WARN=$(grep '^warn=' "$CONTAINER_FILE" | cut -d= -f2 || echo "0")
  C_PASS=$(grep '^pass=' "$CONTAINER_FILE" | cut -d= -f2 || echo "0")
  if [ "${C_FAIL:-0}" -gt 0 ]; then
    result_fail "컨테이너" "FAIL ${C_FAIL}건 (${C_TS})"
  elif [ "${C_WARN:-0}" -gt 0 ]; then
    result_warn "컨테이너" "WARN ${C_WARN}건 (${C_TS})"
  else
    result_pass "컨테이너" "ALL PASS ${C_PASS}건 (${C_TS})"
  fi
else
  result_warn "컨테이너 상태" "상태 파일 없음"
fi
out ""

# ═══════════════════════════════════════════
# 종합
# ═══════════════════════════════════════════
out "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
TOTAL=$((PASS + FAIL + WARN))
if [ "$FAIL" -eq 0 ] && [ "$WARN" -eq 0 ]; then
  SUMMARY="ALL PASS ($PASS/$TOTAL)"
elif [ "$FAIL" -gt 0 ]; then
  SUMMARY="FAIL — PASS:$PASS FAIL:$FAIL WARN:$WARN"
else
  SUMMARY="WARN — PASS:$PASS WARN:$WARN"
fi
out " 종합: $SUMMARY"
out " 로그: $REPORT"
out "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 상태 저장
{
  echo "timestamp=$TIMESTAMP"
  echo "pass=$PASS"
  echo "fail=$FAIL"
  echo "warn=$WARN"
  echo "summary=$SUMMARY"
} > "$LOG_DIR/last_daily_report.txt"

# 실패 항목 상세 저장
if [ "$FAIL" -gt 0 ]; then
  echo -e "$RESULTS" | grep "^FAIL" > "$LOG_DIR/last_daily_failure.log"
fi

# Telegram 발송
if [ -f "$TELEGRAM" ]; then
  FAIL_LINES=$(echo -e "$RESULTS" | grep -E '^FAIL|^WARN' | sed 's/|/ /g; s/^FAIL/❌/; s/^WARN/⚠/' | head -5)
  MSG="📊 일일 리포트 $(date '+%Y-%m-%d')
$SUMMARY
${FAIL_LINES:+
$FAIL_LINES}"
  bash "$TELEGRAM" send "$MSG" 2>/dev/null || true
fi

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
