#!/usr/bin/env bash
# ──────────────────────────────────────────────
# deploy_rollback.sh — 배포 롤백 스크립트
#
# 기준: logs/last_deploy_state.txt 의 prev_commit 값
#
# 사용법:
#   bash scripts/deploy_rollback.sh          # 자동 (last_deploy_state.txt 기준)
#   bash scripts/deploy_rollback.sh <commit> # 수동 커밋 해시 지정
#
# 동작:
#   1. 롤백 대상 커밋 확인
#   2. git checkout <prev_commit> (detached HEAD) → 빌드/재시작
#   3. 재시작 후 헬스체크
# ──────────────────────────────────────────────
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$PROJECT_DIR/logs"
mkdir -p "$LOG_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT="$LOG_DIR/rollback_${TIMESTAMP}.log"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

out()  { echo "$1" | tee -a "$REPORT"; }
outc() { echo -e "$1" | tee -a "$REPORT"; }

out ""
out "╔══════════════════════════════════════════════════╗"
out "║  롤백 파이프라인                                  ║"
out "║  $(date '+%Y-%m-%d %H:%M:%S')                              ║"
out "╚══════════════════════════════════════════════════╝"
out ""

# ── 롤백 대상 커밋 결정 ──
STATE_FILE="$LOG_DIR/last_deploy_state.txt"
TARGET_COMMIT="${1:-}"

if [ -z "$TARGET_COMMIT" ]; then
  if [ ! -f "$STATE_FILE" ]; then
    outc "${RED}[FAIL]${NC} 롤백 기준 파일 없음: $STATE_FILE"
    out "  수동으로 커밋 해시를 지정하세요:"
    out "  bash scripts/deploy_rollback.sh <commit-hash>"
    exit 1
  fi
  TARGET_COMMIT=$(grep '^prev_commit=' "$STATE_FILE" | cut -d= -f2)
  SAVED_TS=$(grep '^timestamp=' "$STATE_FILE" | cut -d= -f2 || echo "unknown")
  out "  기준 파일: $STATE_FILE"
  out "  저장 시각: $SAVED_TS"
fi

if [ -z "$TARGET_COMMIT" ] || [ "$TARGET_COMMIT" = "unknown" ]; then
  outc "${RED}[FAIL]${NC} 롤백 커밋 해시를 확인할 수 없습니다"
  exit 1
fi

CURRENT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
TARGET_SHORT=$(git rev-parse --short "$TARGET_COMMIT" 2>/dev/null || echo "$TARGET_COMMIT")

out "  현재 커밋: $CURRENT_COMMIT"
out "  롤백 대상: $TARGET_SHORT ($TARGET_COMMIT)"
out ""

if [ "$CURRENT_COMMIT" = "$TARGET_SHORT" ]; then
  outc "  ${YELLOW}[INFO]${NC} 현재 커밋과 롤백 대상이 동일 — 롤백 불필요"
  exit 0
fi

# ── 승인 확인 ──
outc "  ${CYAN}[GATE]${NC} $CURRENT_COMMIT → $TARGET_SHORT 롤백을 진행하시겠습니까? (y/N)"
# 비대화형 환경(cron/ssh 파이프/CI)에서는 절대 자동승인 금지
if [ ! -t 0 ]; then
  outc "${RED}[ABORT]${NC} 비대화형 환경 — 롤백은 대화형 터미널에서만 수동으로 실행해야 합니다."
  out "  cron / ssh 비대화형 / CI 환경에서는 실행 불가."
  exit 1
fi
read -t 30 -r REPLY || REPLY=""
if [[ ! "$REPLY" =~ ^[Yy]$ ]]; then
  out "  [CANCEL] 롤백 취소"
  exit 0
fi

out ""
outc "▶ ${CYAN}STEP 1: git checkout${NC}"
out "────────────────────────────────"

# 워킹트리 정리 후 대상 커밋 체크아웃
git stash --include-untracked 2>&1 | tee -a "$REPORT" || true
if ! git checkout "$TARGET_COMMIT" 2>&1 | tee -a "$REPORT"; then
  outc "${RED}[FAIL]${NC} git checkout 실패"
  exit 1
fi
out "  체크아웃 완료: $(git rev-parse --short HEAD)"
out ""

outc "▶ ${CYAN}STEP 2: Docker 재빌드 및 재시작${NC}"
out "────────────────────────────────"

# deploy.sh 가 있으면 호출, 없으면 docker compose 직접
DEPLOY_SH="$SCRIPT_DIR/deploy.sh"
if [ -f "$DEPLOY_SH" ]; then
  if bash "$DEPLOY_SH" "rollback to $TARGET_SHORT" 2>&1 | tee -a "$REPORT"; then
    outc "  ${GREEN}[OK]${NC} 재배포 완료"
  else
    outc "${RED}[FAIL]${NC} 재배포 실패 — 로그: $REPORT"
    exit 1
  fi
else
  # deploy.sh 없는 경우 직접 compose up
  cd "$PROJECT_DIR"
  if docker compose up -d --build 2>&1 | tee -a "$REPORT"; then
    outc "  ${GREEN}[OK]${NC} docker compose 재시작 완료"
  else
    outc "${RED}[FAIL]${NC} docker compose 실패 — 로그: $REPORT"
    exit 1
  fi
fi
out ""

outc "▶ ${CYAN}STEP 3: 헬스체크${NC}"
out "────────────────────────────────"
sleep 10  # 컨테이너 기동 대기
HEALTH_OUTPUT=$(bash "$SCRIPT_DIR/scheduled_check.sh" --quick 2>&1) || true
HEALTH_EXIT=$?
echo "$HEALTH_OUTPUT" | tee -a "$REPORT"

out ""
out "━━━━━ 롤백 결과 ━━━━━"
out " 롤백 커밋: $TARGET_SHORT"
out " 시각: $(date '+%Y-%m-%d %H:%M:%S')"
if [ "$HEALTH_EXIT" -eq 0 ]; then
  outc " 헬스체크: ${GREEN}PASS${NC}"
  outc " 종합: ${GREEN}롤백 완료${NC}"
  {
    echo "timestamp=$TIMESTAMP"
    echo "rolled_back_to=$TARGET_SHORT"
    echo "health=PASS"
  } >> "$STATE_FILE"
  exit 0
else
  outc " 헬스체크: ${RED}FAIL${NC}"
  outc " 종합: ${RED}롤백 후 헬스체크 실패 — 수동 확인 필요${NC}"
  out " 로그: $REPORT"
  exit 1
fi
