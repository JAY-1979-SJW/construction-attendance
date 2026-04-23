#!/usr/bin/env bash
# ──────────────────────────────────────────────
# telegram.sh — 텔레그램 봇 알림/대화 통합
#
# 사용법:
#   bash scripts/telegram.sh send "메시지"           # 메시지 전송
#   bash scripts/telegram.sh report                   # 현재 상태 보고
#   bash scripts/telegram.sh deploy-report "커밋msg"  # 배포 결과 보고
#   bash scripts/telegram.sh listen                   # 대화 모드 (폴링)
#   bash scripts/telegram.sh check                    # 점검 결과 보고
# ──────────────────────────────────────────────
set -uo pipefail

# ── 민감정보 로드 (환경변수 우선 → secrets 파일 fallback) ──
SECRETS_FILE="${TELEGRAM_SECRETS_FILE:-$HOME/.config/ops/telegram.secrets}"
if [ -f "$SECRETS_FILE" ]; then
  set -a; source "$SECRETS_FILE"; set +a
fi
BOT_TOKEN="${TELEGRAM_BOT_TOKEN:?'TELEGRAM_BOT_TOKEN 미설정 — ~/.config/ops/telegram.secrets 또는 환경변수에 설정 필요'}"
CHAT_ID="${TELEGRAM_CHAT_ID:?'TELEGRAM_CHAT_ID 미설정 — ~/.config/ops/telegram.secrets 또는 환경변수에 설정 필요'}"
API="https://api.telegram.org/bot${BOT_TOKEN}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$PROJECT_DIR/logs"
OFFSET_FILE="$LOG_DIR/.telegram_offset"

# ── 전송 함수 ──
tg_send() {
  local text="$1"
  local parse_mode="${2:-HTML}"
  curl -s -X POST "$API/sendMessage" \
    -d "chat_id=$CHAT_ID" \
    -d "parse_mode=$parse_mode" \
    --data-urlencode "text=$text" > /dev/null 2>&1
}

tg_send_raw() {
  local text="$1"
  curl -s -X POST "$API/sendMessage" \
    -d "chat_id=$CHAT_ID" \
    --data-urlencode "text=$text" > /dev/null 2>&1
}

# ── 상태 보고 ──
cmd_report() {
  local COMMIT=$(cd "$PROJECT_DIR" && git rev-parse --short HEAD 2>/dev/null || echo "?")
  local BRANCH=$(cd "$PROJECT_DIR" && git branch --show-current 2>/dev/null || echo "?")
  local CHANGES=$(cd "$PROJECT_DIR" && git status --porcelain 2>/dev/null | wc -l | tr -d ' ')

  # 마지막 배포 상태
  local DEPLOY_STATUS="없음"
  if [ -f "$LOG_DIR/last_deploy_status.txt" ]; then
    DEPLOY_STATUS=$(cat "$LOG_DIR/last_deploy_status.txt" | tr '\n' ' ')
  fi

  # 마지막 점검 상태
  local CHECK_STATUS="없음"
  if [ -f "$LOG_DIR/last_check_status.txt" ]; then
    CHECK_STATUS=$(cat "$LOG_DIR/last_check_status.txt" | tr '\n' ' ')
  fi

  # 컨테이너 상태
  local CONTAINER="없음"
  if [ -f "$LOG_DIR/last_container_status.txt" ]; then
    CONTAINER=$(cat "$LOG_DIR/last_container_status.txt" | tr '\n' ' ')
  fi

  tg_send "📊 <b>현재 상태 보고</b>
━━━━━━━━━━━━━━
🔹 브랜치: $BRANCH
🔹 커밋: $COMMIT
🔹 미커밋 변경: ${CHANGES}건

📦 <b>마지막 배포</b>
$DEPLOY_STATUS

✅ <b>마지막 점검</b>
$CHECK_STATUS

🐳 <b>컨테이너</b>
$CONTAINER

🕐 $(date '+%Y-%m-%d %H:%M:%S')"
}

# ── 배포 결과 보고 ──
cmd_deploy_report() {
  local msg="${1:-배포}"
  local COMMIT=$(cd "$PROJECT_DIR" && git rev-parse --short HEAD 2>/dev/null || echo "?")

  if [ -f "$LOG_DIR/last_deploy_status.txt" ]; then
    local deploy=$(grep "^deploy=" "$LOG_DIR/last_deploy_status.txt" | cut -d= -f2)
    local web=$(grep "^web_check=" "$LOG_DIR/last_deploy_status.txt" | cut -d= -f2)
    local scenario=$(grep "^scenario_check=" "$LOG_DIR/last_deploy_status.txt" | cut -d= -f2)
    local mobile=$(grep "^mobile_ui=" "$LOG_DIR/last_deploy_status.txt" | cut -d= -f2)
    local audit=$(grep "^audit=" "$LOG_DIR/last_deploy_status.txt" | cut -d= -f2)
    local container=$(grep "^container=" "$LOG_DIR/last_deploy_status.txt" | cut -d= -f2)
    local fails=$(grep "^fail_items=" "$LOG_DIR/last_deploy_status.txt" | cut -d= -f2)
    local warns=$(grep "^warn_items=" "$LOG_DIR/last_deploy_status.txt" | cut -d= -f2)

    # 이모지 매핑
    icon() {
      case "$1" in
        PASS) echo "✅" ;;
        FAIL) echo "❌" ;;
        WARN) echo "⚠️" ;;
        NOT_TESTED|NOT_RUN) echo "⏭" ;;
        SKIP) echo "⏩" ;;
        *) echo "❓" ;;
      esac
    }

    tg_send "🚀 <b>배포+점검 결과</b>
━━━━━━━━━━━━━━
📝 $msg
🔹 커밋: $COMMIT

$(icon "${deploy:-?}") 배포: ${deploy:-?}
$(icon "${web:-?}") 웹 점검: ${web:-?}
$(icon "${scenario:-?}") 시나리오: ${scenario:-?}
$(icon "${mobile:-?}") 모바일 UI: ${mobile:-?}
$(icon "${audit:-?}") 정적 분석: ${audit:-?}
$(icon "${container:-?}") 컨테이너: ${container:-?}

$([ "${fails:-none}" != "none" ] && echo "❌ 실패: $fails" || echo "")
$([ "${warns:-none}" != "none" ] && echo "⚠️ 경고: $warns" || echo "")

🕐 $(date '+%Y-%m-%d %H:%M:%S')"
  else
    tg_send "🚀 <b>배포</b>: $msg ($COMMIT)
결과 파일 없음 — deploy_and_check.sh 실행 필요"
  fi
}

# ── 점검 결과 보고 ──
cmd_check_report() {
  # 웹 점검 + 시나리오 + 컨테이너 결과를 종합
  local msg="🔍 <b>점검 결과</b>\n━━━━━━━━━━━━━━"

  if [ -f "$LOG_DIR/last_check_status.txt" ]; then
    msg="$msg\n$(cat "$LOG_DIR/last_check_status.txt" | sed 's/^/🔹 /')"
  fi

  if [ -f "$LOG_DIR/last_container_status.txt" ]; then
    msg="$msg\n\n🐳 컨테이너:\n$(cat "$LOG_DIR/last_container_status.txt" | sed 's/^/  /')"
  fi

  # 실패 항목 — 현재 시나리오 점검이 FAIL일 때만 표시 (stale 캐시 노이즈 방지)
  local scenario_result
  scenario_result=$(grep "^scenario=" "$LOG_DIR/last_check_status.txt" 2>/dev/null | cut -d= -f2)
  if [ "$scenario_result" = "FAIL" ] && [ -f "$LOG_DIR/last_failure.log" ]; then
    msg="$msg\n\n❌ 실패:\n$(head -5 "$LOG_DIR/last_failure.log" | sed 's/^/  /')"
  fi

  msg="$msg\n\n🕐 $(date '+%Y-%m-%d %H:%M:%S')"
  tg_send "$msg"
}

# ── 대화 모드 (폴링) ──
cmd_listen() {
  local offset=0
  if [ -f "$OFFSET_FILE" ]; then
    offset=$(cat "$OFFSET_FILE")
  fi

  tg_send_raw "🤖 대화 모드 시작. 명령어:
/status - 현재 상태
/check - 점검 실행
/deploy - 마지막 배포 결과
/health - 서버 헬스체크
/logs - 최근 에러 로그
/help - 명령어 목록"

  while true; do
    local response
    response=$(curl -s "$API/getUpdates?offset=$offset&timeout=30" 2>/dev/null)

    echo "$response" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if not data.get('ok'): sys.exit(0)
    for u in data.get('result', []):
        uid = u['update_id']
        msg = u.get('message', {})
        text = msg.get('text', '')
        chat_id = msg.get('chat', {}).get('id', 0)
        print(f'{uid}|{chat_id}|{text}')
except: pass
" 2>/dev/null | while IFS='|' read -r uid cid text; do
      [ -z "$uid" ] && continue
      offset=$((uid + 1))
      echo "$offset" > "$OFFSET_FILE"

      # 다른 채팅은 무시
      [ "$cid" != "$CHAT_ID" ] && continue

      case "$text" in
        /status|상태)
          cmd_report
          ;;
        /check|점검)
          tg_send_raw "🔍 점검 실행 중..."
          bash "$SCRIPT_DIR/scheduled_check.sh" --quick > /dev/null 2>&1
          cmd_check_report
          ;;
        /deploy|배포)
          cmd_deploy_report
          ;;
        /health|헬스)
          tg_send_raw "🏥 헬스체크 중..."
          bash "$SCRIPT_DIR/check_container_health.sh" > /dev/null 2>&1
          local h_pass=$(grep "^pass=" "$LOG_DIR/last_container_status.txt" 2>/dev/null | cut -d= -f2)
          local h_fail=$(grep "^fail=" "$LOG_DIR/last_container_status.txt" 2>/dev/null | cut -d= -f2)
          tg_send_raw "🐳 헬스체크: PASS=${h_pass:-?} FAIL=${h_fail:-?}"
          ;;
        /logs|로그)
          if [ -f "$LOG_DIR/container_errors_"*.log 2>/dev/null ]; then
            local latest_err=$(ls -t "$LOG_DIR"/container_errors_*.log 2>/dev/null | head -1)
            if [ -n "$latest_err" ]; then
              local content=$(head -10 "$latest_err")
              tg_send_raw "📋 최근 에러 로그:
$content"
            else
              tg_send_raw "✅ 에러 로그 없음"
            fi
          else
            tg_send_raw "✅ 에러 로그 파일 없음"
          fi
          ;;
        /help|도움)
          tg_send_raw "🤖 명령어:
/status - 현재 상태 (git, 배포, 점검)
/check - 빠른 점검 실행
/deploy - 마지막 배포 결과
/health - 서버 헬스체크
/logs - 최근 에러 로그
/help - 이 목록"
          ;;
        /*)
          tg_send_raw "❓ 모르는 명령어: $text
/help 로 명령어 목록 확인"
          ;;
        *)
          # 일반 메시지 — 에코
          tg_send_raw "💬 수신: $text
(명령어는 / 로 시작하세요)"
          ;;
      esac
    done

    sleep 1
  done
}

# ── 메인 ──
CMD="${1:-help}"
shift || true

case "$CMD" in
  send)
    tg_send_raw "${1:-테스트 메시지}"
    echo "전송 완료"
    ;;
  report|status)
    cmd_report
    echo "상태 보고 전송"
    ;;
  deploy-report)
    cmd_deploy_report "${1:-배포}"
    echo "배포 보고 전송"
    ;;
  check)
    cmd_check_report
    echo "점검 보고 전송"
    ;;
  listen)
    cmd_listen
    ;;
  help|*)
    echo "사용법:"
    echo "  bash scripts/telegram.sh send \"메시지\""
    echo "  bash scripts/telegram.sh report"
    echo "  bash scripts/telegram.sh deploy-report \"커밋 메시지\""
    echo "  bash scripts/telegram.sh check"
    echo "  bash scripts/telegram.sh listen"
    ;;
esac
