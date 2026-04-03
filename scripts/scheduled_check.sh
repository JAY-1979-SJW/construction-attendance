#!/usr/bin/env bash
# ──────────────────────────────────────────────
# scheduled_check.sh — 주기적 웹/시나리오 자동 점검
# 사용법:
#   bash scripts/scheduled_check.sh              # 전체 점검
#   bash scripts/scheduled_check.sh --quick      # 빠른 점검 (health + 주요 페이지)
# ──────────────────────────────────────────────
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$SCRIPT_DIR/../logs"
mkdir -p "$LOG_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
MODE="${1:---full}"

DOMAIN="https://attendance.haehan-ai.kr"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0
NOT_TESTED=0

quick_check() {
  local label="$1"
  local url="$2"
  local expect="$3"
  local output code time_total
  output=$(curl -s -o /dev/null -w "%{http_code}|%{time_total}" -L --max-time 15 "$url" 2>/dev/null) || true
  code=$(echo "$output" | cut -d'|' -f1)
  time_total=$(echo "$output" | cut -d'|' -f2)

  if [ -z "$code" ] || [ "$code" = "000" ]; then
    echo "NOT_TESTED|$label|timeout"
    NOT_TESTED=$((NOT_TESTED + 1))
    return
  fi

  local matched=false
  IFS=',' read -ra CODES <<< "$expect"
  for c in "${CODES[@]}"; do
    [ "$code" = "$c" ] && matched=true && break
  done

  if $matched; then
    local time_int=${time_total%%.*}
    if [ "${time_int:-0}" -ge 3 ]; then
      echo "WARN|$label|$code|slow:${time_total}s"
      WARN=$((WARN + 1))
    else
      echo "PASS|$label|$code|${time_total}s"
      PASS=$((PASS + 1))
    fi
  else
    echo "FAIL|$label|$code|expected:$expect"
    FAIL=$((FAIL + 1))
  fi
}

# ── 빠른 점검 ──
run_quick() {
  local REPORT="$LOG_DIR/scheduled_quick_${TIMESTAMP}.log"
  {
    echo "[$TIMESTAMP] 빠른 점검"
    echo ""

    quick_check "health"         "$DOMAIN/api/health"    "200"
    quick_check "login"          "$DOMAIN/login"         "200"
    quick_check "m/login"        "$DOMAIN/m/login"       "200"
    quick_check "admin/login"    "$DOMAIN/admin/login"   "200"
    quick_check "m/register"     "$DOMAIN/m/register"    "200"

    echo ""
    local TOTAL=$((PASS + FAIL + WARN + NOT_TESTED))
    if [ "$FAIL" -eq 0 ] && [ "$WARN" -eq 0 ] && [ "$NOT_TESTED" -eq 0 ]; then
      echo "결과: ALL PASS ($PASS/$TOTAL건)"
    else
      echo "결과: PASS=$PASS FAIL=$FAIL WARN=$WARN NOT_TESTED=$NOT_TESTED"
    fi

    if [ "$FAIL" -gt 0 ]; then
      echo "⚠ FAIL 발생 — 즉시 확인 필요"
    fi
  } | tee "$REPORT"

  # 상태 저장
  {
    echo "last_check=$TIMESTAMP"
    echo "mode=quick"
    echo "pass=$PASS"
    echo "fail=$FAIL"
    echo "warn=$WARN"
    echo "not_tested=$NOT_TESTED"
  } > "$LOG_DIR/last_check_status.txt"

  [ "$FAIL" -eq 0 ] && return 0 || return 1
}

# ── 전체 점검 ──
run_full() {
  local REPORT="$LOG_DIR/scheduled_full_${TIMESTAMP}.log"

  echo "[$TIMESTAMP] 전체 점검 시작" | tee "$REPORT"

  local WEB_OK="NOT_RUN"
  local SCENARIO_OK="NOT_RUN"
  local AUDIT_OK="NOT_RUN"

  echo "" >> "$REPORT"
  echo "=== 웹 기본 점검 ===" >> "$REPORT"
  if bash "$SCRIPT_DIR/check_web.sh" >> "$REPORT" 2>&1; then
    WEB_OK="PASS"
  else
    WEB_OK="FAIL"
  fi

  echo "" >> "$REPORT"
  echo "=== 시나리오 점검 ===" >> "$REPORT"
  if bash "$SCRIPT_DIR/scenario_check.sh" >> "$REPORT" 2>&1; then
    SCENARIO_OK="PASS"
  else
    SCENARIO_OK="FAIL"
  fi

  echo "" >> "$REPORT"
  echo "=== 정적 분석 ===" >> "$REPORT"
  if bash "$SCRIPT_DIR/audit_mobile_card.sh" >> "$REPORT" 2>&1; then
    AUDIT_OK="PASS"
  else
    AUDIT_OK="FAIL"
  fi

  # 결과 요약
  {
    echo ""
    echo "━━━━━ 종합 결과 ━━━━━"
    echo " 시각: $(date '+%Y-%m-%d %H:%M:%S')"
    echo " 웹 점검: $WEB_OK"
    echo " 시나리오: $SCENARIO_OK"
    echo " 정적 분석: $AUDIT_OK"

    if [ "$WEB_OK" = "PASS" ] && [ "$SCENARIO_OK" = "PASS" ] && [ "$AUDIT_OK" = "PASS" ]; then
      echo " 종합: ALL PASS"
    else
      local fails=""
      [ "$WEB_OK" = "FAIL" ] && fails="${fails} 웹점검"
      [ "$SCENARIO_OK" = "FAIL" ] && fails="${fails} 시나리오"
      [ "$AUDIT_OK" = "FAIL" ] && fails="${fails} 정적분석"
      echo " 종합: FAIL — ${fails}"
    fi
  } | tee -a "$REPORT"

  # 상태 저장
  {
    echo "last_check=$TIMESTAMP"
    echo "mode=full"
    echo "web=$WEB_OK"
    echo "scenario=$SCENARIO_OK"
    echo "audit=$AUDIT_OK"
  } > "$LOG_DIR/last_check_status.txt"

  if [ "$WEB_OK" = "PASS" ] && [ "$SCENARIO_OK" = "PASS" ] && [ "$AUDIT_OK" = "PASS" ]; then
    return 0
  else
    return 1
  fi
}

# ── 오래된 로그 정리 (30일 이상) ──
cleanup_old_logs() {
  find "$LOG_DIR" -name "*.log" -mtime +30 -delete 2>/dev/null || true
  find "$LOG_DIR" -name "*.txt" -mtime +30 -delete 2>/dev/null || true
  find "$LOG_DIR" -name "*.html" -mtime +30 -delete 2>/dev/null || true
  find "$LOG_DIR" -name "*.json" -mtime +30 -delete 2>/dev/null || true
}

# ── 실행 ──
cleanup_old_logs

case "$MODE" in
  --quick|-q)
    run_quick
    ;;
  --full|-f|*)
    run_full
    ;;
esac
