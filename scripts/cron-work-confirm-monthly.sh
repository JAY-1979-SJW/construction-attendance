#!/usr/bin/env bash
# 근무확정 월별 자동처리 cron 래퍼
# 실행: 매월 1일 00:00 UTC (09:00 KST)  →  crontab: 0 0 1 * *
# 대상: 전월 monthKey (API 내부 getPreviousMonthKey 로직)
# finalize 자동 실행 금지 — generate + auto-confirm + 집계만 수행
#
# 알림 정책:
#   pendingReview > 0  → 텔레그램 검토 요청 알림
#   errors > 0         → 텔레그램 경고 알림
#   pendingReview = 0  → 로그만 기록, 알림 생략
#   skipped = true     → 멱등성 스킵, 로그만 기록
set -uo pipefail

APP_DIR=/home/ubuntu/app/attendance
ENV_FILE=$APP_DIR/.env.production
OPS_ENV=$APP_DIR/ops-bot/.env
LOG_DIR=$APP_DIR/logs
CONTAINER_IP=$(docker inspect attendance --format='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' 2>/dev/null)
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE=$LOG_DIR/work-confirm-monthly_${TIMESTAMP}.log

mkdir -p "$LOG_DIR"

# ── CRON_SECRET ──
CRON_SECRET=$(grep '^CRON_SECRET' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")
if [ -z "$CRON_SECRET" ]; then
  echo "[$TIMESTAMP] FAIL: CRON_SECRET 미설정 ($ENV_FILE)" | tee -a "$LOG_FILE"
  exit 1
fi

# ── Telegram 설정 ──
TG_TOKEN=$(grep '^TELEGRAM_BOT_TOKEN' "$OPS_ENV" | cut -d= -f2- | tr -d '"' | tr -d "'")
TG_CHAT=$(grep '^TELEGRAM_CHAT_ID'   "$OPS_ENV" | cut -d= -f2- | tr -d '"' | tr -d "'")

tg_send() {
  local text="$1"
  if [ -z "${TG_TOKEN:-}" ] || [ -z "${TG_CHAT:-}" ]; then
    echo "[$TIMESTAMP] WARN: Telegram 미설정 — 알림 생략" | tee -a "$LOG_FILE"
    return
  fi
  curl -s -X POST "https://api.telegram.org/bot${TG_TOKEN}/sendMessage" \
    -d "chat_id=${TG_CHAT}" \
    -d "parse_mode=HTML" \
    --data-urlencode "text=${text}" > /dev/null 2>&1
}

# ── 컨테이너 확인 ──
if [ -z "$CONTAINER_IP" ]; then
  echo "[$TIMESTAMP] FAIL: attendance 컨테이너 IP 조회 실패" | tee -a "$LOG_FILE"
  tg_send "❌ <b>근무확정 자동처리 실패</b>
사유: attendance 컨테이너 IP 조회 실패
시각: $(date '+%Y-%m-%d %H:%M KST')"
  exit 1
fi

echo "[$TIMESTAMP] START work-confirm-monthly (IP=$CONTAINER_IP)" | tee -a "$LOG_FILE"

# ── API 호출 ──
RESPONSE=$(curl -s -w '\n%{http_code}' -X POST \
  "http://${CONTAINER_IP}:3002/api/cron/work-confirm-monthly" \
  -H "x-cron-secret: $CRON_SECRET" \
  -H 'Content-Type: application/json' \
  --max-time 300) || { echo "[$TIMESTAMP] FAIL: curl 오류" | tee -a "$LOG_FILE"; exit 1; }

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

echo "[$TIMESTAMP] HTTP=$HTTP_CODE BODY=$BODY" | tee -a "$LOG_FILE"

if [ "$HTTP_CODE" != '200' ]; then
  echo "[$TIMESTAMP] FAIL: HTTP $HTTP_CODE" | tee -a "$LOG_FILE"
  tg_send "❌ <b>근무확정 자동처리 실패</b>
HTTP: $HTTP_CODE
응답: $(echo "$BODY" | head -c 300)
시각: $(date '+%Y-%m-%d %H:%M KST')"
  exit 1
fi

# ── JSON 파싱 ──
read -r MONTH_KEY GENERATED AUTO_CONFIRMED PENDING_REVIEW ERRORS SKIPPED SKIP_REASON <<< \
  "$(python3 -c "
import sys, json
try:
    d = json.loads('''$BODY''').get('data', {})
    print(
        d.get('monthKey','?'),
        d.get('generated', 0),
        d.get('autoConfirmed', 0),
        d.get('pendingReview', 0),
        d.get('errors', 0),
        str(d.get('skipped', False)).lower(),
        d.get('skipReason','') or ''
    )
except Exception as e:
    print('? 0 0 0 0 false', str(e))
" 2>/dev/null)"

echo "[$TIMESTAMP] monthKey=$MONTH_KEY generated=$GENERATED autoConfirmed=$AUTO_CONFIRMED pendingReview=$PENDING_REVIEW errors=$ERRORS skipped=$SKIPPED" | tee -a "$LOG_FILE"

# ── 스킵된 경우 (멱등성) ──
if [ "$SKIPPED" = 'true' ]; then
  echo "[$TIMESTAMP] SKIP: $SKIP_REASON" | tee -a "$LOG_FILE"
  echo "[$TIMESTAMP] DONE (skipped)" | tee -a "$LOG_FILE"
  exit 0
fi

# ── errors > 0 → 경고 알림 ──
if [ "${ERRORS:-0}" -gt 0 ]; then
  tg_send "⚠️ <b>근무확정 자동처리 오류 발생</b>
월: <b>$MONTH_KEY</b>
━━━━━━━━━━━━━━
📝 생성: ${GENERATED}건
✅ 자동확정: ${AUTO_CONFIRMED}건
🔍 검토대기: ${PENDING_REVIEW}건
❌ 오류: ${ERRORS}건
━━━━━━━━━━━━━━
오류 로그를 확인하세요.
🕐 $(date '+%Y-%m-%d %H:%M KST')"
fi

# ── pendingReview > 0 → 검토 요청 알림 ──
if [ "${PENDING_REVIEW:-0}" -gt 0 ]; then
  tg_send "🔍 <b>근무확정 검토 요청</b>
월: <b>$MONTH_KEY</b>
━━━━━━━━━━━━━━
📝 생성: ${GENERATED}건
✅ 자동확정: ${AUTO_CONFIRMED}건
🔍 검토대기: ${PENDING_REVIEW}건
❌ 오류: ${ERRORS}건
━━━━━━━━━━━━━━
⚠️ DRAFT 상태 ${PENDING_REVIEW}건이 검토를 기다립니다.
관리자 확인 후 finalize 실행 필요.
🕐 $(date '+%Y-%m-%d %H:%M KST')"
  echo "[$TIMESTAMP] NOTIFY: pendingReview=${PENDING_REVIEW} → 텔레그램 알림 발송" | tee -a "$LOG_FILE"
else
  # pendingReview = 0 → 로그만, 알림 생략
  echo "[$TIMESTAMP] OK: pendingReview=0 — 알림 생략" | tee -a "$LOG_FILE"
fi

echo "[$TIMESTAMP] DONE" | tee -a "$LOG_FILE"
