#!/usr/bin/env bash
# ──────────────────────────────────────────────
# deploy_and_check.sh — 통합 파이프라인
#   배포 → 웹점검 → 시나리오점검 → 모바일UI점검 → 정적분석 → 최종보고
#
# 사용법:
#   bash scripts/deploy_and_check.sh "커밋 메시지"        # 배포 + 전체 점검
#   bash scripts/deploy_and_check.sh --check-only         # 점검만 (배포 없이)
#
# 원칙:
#   - 확인되지 않은 항목은 NOT_TESTED
#   - 부분 이상은 WARN
#   - 실패 항목은 절대 누락하지 않음
#   - 코드 변경 없으면 배포 생략
# ──────────────────────────────────────────────
set -uo pipefail

# ── 중복 실행 방지 ──
LOCK_FILE="/tmp/deploy_and_check_sh.lock"
if [ -f "$LOCK_FILE" ]; then
  OLD_PID=$(cat "$LOCK_FILE" 2>/dev/null || echo "")
  if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    echo "[SKIP] deploy_and_check.sh 이미 실행 중 (PID=$OLD_PID) — 중복 실행 차단"
    exit 1
  fi
fi
echo $$ > "$LOCK_FILE"
trap "rm -f '$LOCK_FILE'" EXIT INT TERM

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$PROJECT_DIR/logs"
mkdir -p "$LOG_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT="$LOG_DIR/pipeline_${TIMESTAMP}.log"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

out()  { echo "$1" | tee -a "$REPORT"; }
outc() { echo -e "$1" | tee -a "$REPORT"; }

# 상태 변수 — 4단계: PASS / FAIL / WARN / NOT_RUN
DEPLOY_STATUS="NOT_RUN"
WEB_STATUS="NOT_RUN"
SCENARIO_STATUS="NOT_RUN"
MOBILE_UI_STATUS="NOT_RUN"
AUDIT_STATUS="NOT_RUN"
CONTAINER_STATUS="NOT_RUN"

WARN_ITEMS=""
FAIL_ITEMS=""

# ── 모드 판별 ──
CHECK_ONLY=false
AUTO_APPROVE=false
COMMIT_MSG=""

# 인수 파싱 — --check-only / --auto / "커밋 메시지"
_ARGS=("$@")
_REMAINING=()
for _arg in "${_ARGS[@]:-}"; do
  case "$_arg" in
    --check-only|-c) CHECK_ONLY=true ;;
    --auto)          AUTO_APPROVE=true ;;
    *)               _REMAINING+=("$_arg") ;;
  esac
done

if [ "${#_REMAINING[@]}" -gt 0 ]; then
  COMMIT_MSG="${_REMAINING[0]}"
fi

if ! $CHECK_ONLY && [ -z "$COMMIT_MSG" ]; then
  outc "${RED}[FAIL]${NC} 사용법:"
  out "  배포+점검:    bash scripts/deploy_and_check.sh \"커밋 메시지\""
  out "  점검만:       bash scripts/deploy_and_check.sh --check-only"
  out "  승인형 배포:  bash scripts/deploy_and_check.sh \"커밋 메시지\" --auto"
  exit 1
fi

out ""
out "╔══════════════════════════════════════════════════╗"
if $CHECK_ONLY; then
  out "║  점검 파이프라인 시작 (배포 없음)                ║"
elif $AUTO_APPROVE; then
  out "║  승인형 배포 파이프라인 시작 (Level B)           ║"
else
  out "║  배포 + 점검 파이프라인 시작                     ║"
fi
out "║  $(date '+%Y-%m-%d %H:%M:%S')                              ║"
out "╚══════════════════════════════════════════════════╝"
out ""

STEP=0

# ══════════════════════════════════════════════════
# STEP: 배포 전 안전 점검
# ══════════════════════════════════════════════════
if ! $CHECK_ONLY; then
  STEP=$((STEP + 1))
  outc "▶ STEP $STEP: ${CYAN}배포 전 점검${NC}"
  out "────────────────────────────────"

  # 변경사항 확인
  CHANGES=$(git status --porcelain 2>/dev/null || true)
  AHEAD=$(git rev-list --count origin/master..master 2>/dev/null || echo "0")

  if [ -z "$CHANGES" ] && [ "$AHEAD" = "0" ]; then
    outc "  ${YELLOW}[INFO]${NC} 변경사항 없음 — 배포 생략, 점검만 실행"
    DEPLOY_STATUS="SKIP"
    CHECK_ONLY=true  # 이후 점검만 실행
  else
    if [ -n "$CHANGES" ]; then
      FILE_COUNT=$(echo "$CHANGES" | wc -l | tr -d ' ')
      out "  변경 파일: ${FILE_COUNT}개"

      # 위험 변경 사전 경고
      RISK=""
      echo "$CHANGES" | grep -qE 'docker-compose|Dockerfile|nginx' && RISK="${RISK} 인프라"
      echo "$CHANGES" | grep -qE 'prisma/schema|migration' && RISK="${RISK} DB"
      echo "$CHANGES" | grep -qE 'middleware|route-policy' && RISK="${RISK} 인증"
      echo "$CHANGES" | grep -qE 'package\.json' && RISK="${RISK} 패키지"

      if [ -n "$RISK" ]; then
        outc "  ${YELLOW}[WARN]${NC} 위험 변경:${RISK}"
        WARN_ITEMS="${WARN_ITEMS} 위험변경(${RISK})"
      fi
    fi
    if [ "$AHEAD" -gt 0 ]; then
      out "  미push 커밋: ${AHEAD}개"
    fi
  fi
  out ""

  # ── 사전 헬스체크 (배포 전 PASS 필수) ──
  if [ "$DEPLOY_STATUS" != "SKIP" ]; then
    STEP=$((STEP + 1))
    outc "▶ STEP $STEP: ${CYAN}사전 점검 (배포 허용 판단)${NC}"
    out "────────────────────────────────"
    PREFLIGHT_OUTPUT=$(bash "$SCRIPT_DIR/scheduled_check.sh" --quick 2>&1) || true
    PREFLIGHT_EXIT=$?
    echo "$PREFLIGHT_OUTPUT" | tee -a "$REPORT"

    if [ "$PREFLIGHT_EXIT" -ne 0 ]; then
      outc "  ${RED}[BLOCK]${NC} 사전 점검 FAIL — 배포 차단"
      DEPLOY_STATUS="BLOCKED"
      FAIL_ITEMS="${FAIL_ITEMS} 사전점검FAIL"

      COMMIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
      out ""
      out "━━━━━ 최종 보고 ━━━━━"
      out " 상태: 사전 점검 실패로 배포 차단"
      out " 커밋: $COMMIT_HASH"
      outc " 사전 점검: ${RED}FAIL${NC}"
      outc " 배포: ${YELLOW}NOT_RUN (차단됨)${NC}"
      out " 조치: 사전 점검 항목 확인 후 재시도"
      {
        echo "timestamp=$TIMESTAMP"
        echo "commit=$COMMIT_HASH"
        echo "preflight=FAIL"
        echo "deploy=NOT_RUN"
      } > "$LOG_DIR/last_deploy_status.txt"
      exit 1
    fi
    outc "  ${GREEN}[OK]${NC} 사전 점검 PASS — 배포 진행"
    out ""

    # 직전 커밋/이미지 저장 (롤백용)
    PREV_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
    PREV_IMAGE=$(docker images --format '{{.Repository}}:{{.Tag}} {{.ID}}' 2>/dev/null | head -1 || echo "unknown")
    {
      echo "timestamp=$TIMESTAMP"
      echo "prev_commit=$PREV_COMMIT"
      echo "prev_image=$PREV_IMAGE"
    } > "$LOG_DIR/last_deploy_state.txt"
    out "  [저장] 롤백 기준: $PREV_COMMIT"
    out ""

    # ── 승인 게이트 ──
    if ! $AUTO_APPROVE; then
      outc "  ${CYAN}[GATE]${NC} 배포를 진행하시겠습니까? (y/N, 30초 타임아웃)"
      if [ -t 0 ]; then
        read -t 30 -r REPLY || REPLY=""
      else
        REPLY="y"  # 비대화형(파이프/cron) 환경 — 자동 승인
      fi
      if [[ ! "$REPLY" =~ ^[Yy]$ ]]; then
        out "  [CANCEL] 사용자 취소 또는 타임아웃 — 배포 중단"
        DEPLOY_STATUS="CANCEL"
        out ""
        out "━━━━━ 최종 보고 ━━━━━"
        out " 상태: 배포 취소"
        outc " 사전 점검: ${GREEN}PASS${NC}"
        outc " 배포: ${YELLOW}CANCEL${NC}"
        {
          echo "timestamp=$TIMESTAMP"
          echo "preflight=PASS"
          echo "deploy=CANCEL"
        } > "$LOG_DIR/last_deploy_status.txt"
        exit 0
      fi
    fi
  fi

  # ── 배포 실행 ──
  if [ "$DEPLOY_STATUS" != "SKIP" ] && [ "$DEPLOY_STATUS" != "CANCEL" ] && [ "$DEPLOY_STATUS" != "BLOCKED" ]; then
    STEP=$((STEP + 1))
    outc "▶ STEP $STEP: ${CYAN}배포${NC}"
    out "────────────────────────────────"

    if bash "$SCRIPT_DIR/deploy.sh" "$COMMIT_MSG" 2>&1 | tee -a "$REPORT"; then
      DEPLOY_STATUS="PASS"
    else
      DEPLOY_STATUS="FAIL"
      FAIL_ITEMS="${FAIL_ITEMS} 배포"

      COMMIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
      out ""
      outc "${RED}배포 실패 — 점검 건너뜀${NC}"
      out ""
      out "━━━━━ 최종 보고 ━━━━━"
      out " 상태: 배포 실패"
      out " 커밋: $COMMIT_HASH / $COMMIT_MSG"
      outc " 배포: ${RED}FAIL${NC}"
      outc " 웹 점검: ${YELLOW}NOT_RUN${NC}"
      outc " 시나리오: ${YELLOW}NOT_RUN${NC}"
      outc " 모바일 UI: ${YELLOW}NOT_RUN${NC}"
      outc " 정적 분석: ${YELLOW}NOT_RUN${NC}"
      out " 실패 항목: deploy.sh 로그 참조"
      out " 다음 조치: 에러 로그 확인 후 재시도"

      {
        echo "timestamp=$TIMESTAMP"
        echo "commit=$COMMIT_HASH"
        echo "deploy=FAIL"
        echo "web_check=NOT_RUN"
        echo "scenario_check=NOT_RUN"
        echo "mobile_ui=NOT_RUN"
        echo "audit=NOT_RUN"
      } > "$LOG_DIR/last_deploy_status.txt"

      exit 1
    fi
    out ""
  fi
fi

# ══════════════════════════════════════════════════
# STEP: 웹 기본 점검
# ══════════════════════════════════════════════════
STEP=$((STEP + 1))
outc "▶ STEP $STEP: ${CYAN}웹 기본 점검${NC}"
out "────────────────────────────────"
WEB_OUTPUT=$(bash "$SCRIPT_DIR/check_web.sh" 2>&1) || true
WEB_EXIT=$?
echo "$WEB_OUTPUT" | tee -a "$REPORT"

if [ "$WEB_EXIT" -eq 0 ]; then
  # WARN 확인
  if echo "$WEB_OUTPUT" | grep -q "WARN"; then
    WEB_STATUS="WARN"
    WARN_ITEMS="${WARN_ITEMS} 웹점검"
  else
    WEB_STATUS="PASS"
  fi
else
  WEB_STATUS="FAIL"
  FAIL_ITEMS="${FAIL_ITEMS} 웹점검"
fi
out ""

# ══════════════════════════════════════════════════
# STEP: 시나리오 점검
# ══════════════════════════════════════════════════
STEP=$((STEP + 1))
outc "▶ STEP $STEP: ${CYAN}시나리오 점검${NC}"
out "────────────────────────────────"
SCENARIO_OUTPUT=$(bash "$SCRIPT_DIR/scenario_check.sh" 2>&1) || true
SCENARIO_EXIT=$?
echo "$SCENARIO_OUTPUT" | tee -a "$REPORT"

if [ "$SCENARIO_EXIT" -eq 0 ]; then
  if echo "$SCENARIO_OUTPUT" | grep -q "WARN"; then
    SCENARIO_STATUS="WARN"
    WARN_ITEMS="${WARN_ITEMS} 시나리오"
  else
    SCENARIO_STATUS="PASS"
  fi
else
  SCENARIO_STATUS="FAIL"
  FAIL_ITEMS="${FAIL_ITEMS} 시나리오"
fi
out ""

# ══════════════════════════════════════════════════
# STEP: 모바일 카드형 UI 점검
# ══════════════════════════════════════════════════
STEP=$((STEP + 1))
outc "▶ STEP $STEP: ${CYAN}모바일 카드형 UI 점검${NC}"
out "────────────────────────────────"
MOBILE_OUTPUT=$(bash "$SCRIPT_DIR/check_mobile_ui.sh" --iphone 2>&1) || true
MOBILE_EXIT=$?
echo "$MOBILE_OUTPUT" | tee -a "$REPORT"

if echo "$MOBILE_OUTPUT" | grep -q "NOT TESTED\|NOT_TESTED"; then
  MOBILE_UI_STATUS="NOT_TESTED"
  WARN_ITEMS="${WARN_ITEMS} 모바일UI(미검증)"
elif [ "$MOBILE_EXIT" -eq 0 ]; then
  MOBILE_UI_STATUS="PASS"
else
  MOBILE_UI_STATUS="FAIL"
  FAIL_ITEMS="${FAIL_ITEMS} 모바일UI"
fi
out ""

# ══════════════════════════════════════════════════
# STEP: 정적 분석
# ══════════════════════════════════════════════════
STEP=$((STEP + 1))
outc "▶ STEP $STEP: ${CYAN}정적 분석 (모바일 카드)${NC}"
out "────────────────────────────────"
AUDIT_OUTPUT=$(bash "$SCRIPT_DIR/audit_mobile_card.sh" 2>&1) || true
AUDIT_EXIT=$?
echo "$AUDIT_OUTPUT" | tee -a "$REPORT"

if [ "$AUDIT_EXIT" -eq 0 ]; then
  if echo "$AUDIT_OUTPUT" | grep -q "WARN"; then
    AUDIT_STATUS="WARN"
    WARN_ITEMS="${WARN_ITEMS} 정적분석"
  else
    AUDIT_STATUS="PASS"
  fi
else
  AUDIT_STATUS="FAIL"
  FAIL_ITEMS="${FAIL_ITEMS} 정적분석"
fi
out ""

# ══════════════════════════════════════════════════
# STEP: 컨테이너 헬스체크
# ══════════════════════════════════════════════════
STEP=$((STEP + 1))
outc "▶ STEP $STEP: ${CYAN}컨테이너 헬스체크${NC}"
out "────────────────────────────────"
CONTAINER_OUTPUT=$(bash "$SCRIPT_DIR/check_container_health.sh" 2>&1)
CONTAINER_EXIT=$?
echo "$CONTAINER_OUTPUT" | tee -a "$REPORT"

if [ "$CONTAINER_EXIT" -eq 0 ]; then
  if echo "$CONTAINER_OUTPUT" | grep -q "\[WARN\]"; then
    CONTAINER_STATUS="WARN"
    WARN_ITEMS="${WARN_ITEMS} 컨테이너"
  else
    CONTAINER_STATUS="PASS"
  fi
else
  CONTAINER_STATUS="FAIL"
  FAIL_ITEMS="${FAIL_ITEMS} 컨테이너"
fi
out ""

# ══════════════════════════════════════════════════
# STEP: JWT 사후 점검 (배포 후 인증 정상 확인)
# ══════════════════════════════════════════════════
JWT_STATUS="NOT_RUN"
JWT_SCRIPT_PATH=""
OPS_BOT_ENV="$SCRIPT_DIR/../ops-bot/.env"
for _p in "$SCRIPT_DIR/../ops-bot/scripts/check_jwt_runtime.sh" \
          "$HOME/app/ops-bot/scripts/check_jwt_runtime.sh" \
          "$HOME/app/attendance/ops-bot/scripts/check_jwt_runtime.sh"; do
  [ -f "$_p" ] && { JWT_SCRIPT_PATH="$_p"; break; }
done

if [ -n "$JWT_SCRIPT_PATH" ]; then
  STEP=$((STEP + 1))
  outc "▶ STEP $STEP: ${CYAN}JWT 사후 점검${NC}"
  out "────────────────────────────────"
  if [ -f "$OPS_BOT_ENV" ]; then
    set -a; source "$OPS_BOT_ENV"; set +a
  fi
  JWT_OUT=$(timeout 30 bash "$JWT_SCRIPT_PATH" 2>&1) || true
  echo "$JWT_OUT" | tee -a "$REPORT"
  if echo "$JWT_OUT" | grep -q "PASS"; then
    JWT_STATUS="PASS"
  else
    JWT_STATUS="FAIL"
    FAIL_ITEMS="${FAIL_ITEMS} JWT사후점검"
  fi
  out ""
fi

# ══════════════════════════════════════════════════
# 최종 보고
# ══════════════════════════════════════════════════
COMMIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

out "╔══════════════════════════════════════════════════╗"
out "║  최종 보고                                       ║"
out "╚══════════════════════════════════════════════════╝"
out ""
out " 시각: $(date '+%Y-%m-%d %H:%M:%S')"
out " 커밋: $COMMIT_HASH"
$CHECK_ONLY || out " 메시지: $COMMIT_MSG"
out ""

# 상태 표시 함수
show_status() {
  local label="$1"; local status="$2"
  case "$status" in
    PASS)     outc " $label: ${GREEN}PASS${NC}" ;;
    FAIL)     outc " $label: ${RED}FAIL${NC}" ;;
    WARN)     outc " $label: ${YELLOW}WARN${NC}" ;;
    NOT_TESTED) outc " $label: ${YELLOW}NOT_TESTED${NC}" ;;
    NOT_RUN)  outc " $label: ${YELLOW}NOT_RUN${NC}" ;;
    SKIP)     outc " $label: ${YELLOW}SKIP (변경 없음)${NC}" ;;
    *)        outc " $label: ${YELLOW}$status${NC}" ;;
  esac
}

show_status "배포" "$DEPLOY_STATUS"
show_status "웹 점검" "$WEB_STATUS"
show_status "시나리오" "$SCENARIO_STATUS"
show_status "모바일 UI" "$MOBILE_UI_STATUS"
show_status "정적 분석" "$AUDIT_STATUS"
show_status "컨테이너" "$CONTAINER_STATUS"
[ "$JWT_STATUS" != "NOT_RUN" ] && show_status "JWT 사후 점검" "$JWT_STATUS"

# 종합 판정
out ""
HAS_FAIL=false
HAS_WARN=false

[ -n "$FAIL_ITEMS" ] && HAS_FAIL=true
[ -n "$WARN_ITEMS" ] && HAS_WARN=true

if $HAS_FAIL; then
  outc " 종합: ${RED}FAIL${NC}"
  out " 실패 항목:${FAIL_ITEMS}"
elif $HAS_WARN; then
  outc " 종합: ${YELLOW}WARN${NC}"
  out " 경고 항목:${WARN_ITEMS}"
else
  outc " 종합: ${GREEN}ALL PASS${NC}"
fi

# WARN 항목도 표시
if $HAS_WARN && $HAS_FAIL; then
  out " 경고 항목:${WARN_ITEMS}"
fi

# 다음 조치
if $HAS_FAIL; then
  out " 다음 조치: 실패 항목 로그 확인"
elif $HAS_WARN; then
  out " 다음 조치: 경고 항목 수동 확인 필요"
else
  out " 다음 조치: 없음"
fi

# 결과 파일 저장
{
  echo "timestamp=$TIMESTAMP"
  echo "commit=$COMMIT_HASH"
  echo "deploy=$DEPLOY_STATUS"
  echo "web_check=$WEB_STATUS"
  echo "scenario_check=$SCENARIO_STATUS"
  echo "mobile_ui=$MOBILE_UI_STATUS"
  echo "audit=$AUDIT_STATUS"
  echo "container=$CONTAINER_STATUS"
  echo "fail_items=${FAIL_ITEMS:-none}"
  echo "warn_items=${WARN_ITEMS:-none}"
} > "$LOG_DIR/last_deploy_status.txt"

out ""

# 실패 로그 경로 안내
if [ -f "$LOG_DIR/last_failure.log" ]; then
  out " 실패 로그: $LOG_DIR/last_failure.log"
fi
if [ -f "$LOG_DIR/last_web_failure.log" ]; then
  out " 웹 실패: $LOG_DIR/last_web_failure.log"
fi

out " 전체 로그: $REPORT"
out ""

# 텔레그램 보고 (자동)
if [ -f "$SCRIPT_DIR/telegram.sh" ]; then
  bash "$SCRIPT_DIR/telegram.sh" deploy-report "${COMMIT_MSG:-점검}" 2>/dev/null || true
fi

$HAS_FAIL && exit 1 || exit 0
