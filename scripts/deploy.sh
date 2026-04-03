#!/usr/bin/env bash
# ──────────────────────────────────────────────
# deploy.sh — 로컬 커밋 → git push → 서버 배포
# 사용법: bash scripts/deploy.sh "커밋 메시지"
# ──────────────────────────────────────────────
set -euo pipefail

# ── 설정 ──
SSH_KEY="$HOME/.ssh/haehan-ai.pem"
SSH_HOST="ubuntu@1.201.176.236"
APP_DIR="~/app/attendance"
BRANCH="master"
LOG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/logs"
mkdir -p "$LOG_DIR"
DEPLOY_LOG="$LOG_DIR/deploy_$(date +%Y%m%d_%H%M%S).log"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()   { echo -e "${GREEN}[OK]${NC} $1" | tee -a "$DEPLOY_LOG"; }
fail() { echo -e "${RED}[FAIL]${NC} $1" | tee -a "$DEPLOY_LOG"; exit 1; }
info() { echo -e "${YELLOW}[INFO]${NC} $1" | tee -a "$DEPLOY_LOG"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "$DEPLOY_LOG"; }

# ── 1) 커밋 메시지 확인 ──
COMMIT_MSG="${1:-}"
if [ -z "$COMMIT_MSG" ]; then
  fail "커밋 메시지를 인자로 전달하세요. 예: bash scripts/deploy.sh \"feat: 기능 추가\""
fi

# ── 2) 배포 전 위험 점검 ──
info "배포 전 안전 점검 중..."

# 2-1. 변경사항 확인
CHANGES=$(git status --porcelain 2>/dev/null || true)
if [ -z "$CHANGES" ]; then
  AHEAD=$(git rev-list --count origin/$BRANCH..$BRANCH 2>/dev/null || echo "0")
  if [ "$AHEAD" = "0" ]; then
    fail "커밋할 변경사항도, push할 커밋도 없습니다."
  fi
  info "미push 커밋 ${AHEAD}개 있음. push 진행."
else
  echo "$CHANGES" | tee -a "$DEPLOY_LOG"

  # 2-2. 위험 파일 변경 감지
  RISK_FILES=""
  if echo "$CHANGES" | grep -qE 'docker-compose|Dockerfile|nginx'; then
    RISK_FILES="${RISK_FILES} 인프라(Docker/nginx)"
  fi
  if echo "$CHANGES" | grep -qE 'prisma/schema|migration'; then
    RISK_FILES="${RISK_FILES} DB스키마/마이그레이션"
  fi
  if echo "$CHANGES" | grep -qE 'middleware\.ts|route-policy'; then
    RISK_FILES="${RISK_FILES} 인증/라우트정책"
  fi
  if echo "$CHANGES" | grep -qE 'package\.json|package-lock'; then
    RISK_FILES="${RISK_FILES} 패키지의존성"
  fi
  if echo "$CHANGES" | grep -qE '\.env|credential|\.pem|\.key|secret'; then
    RISK_FILES="${RISK_FILES} 민감파일(!)"
  fi

  if [ -n "$RISK_FILES" ]; then
    warn "위험 변경 감지:${RISK_FILES}"
    echo "  변경 상세:" | tee -a "$DEPLOY_LOG"
    echo "$CHANGES" | grep -E 'docker-compose|Dockerfile|nginx|prisma/schema|migration|middleware|route-policy|package\.json|package-lock|\.env|credential|\.pem|\.key|secret' | tee -a "$DEPLOY_LOG" || true
  fi

  # 2-3. 변경된 파일 수 확인
  FILE_COUNT=$(echo "$CHANGES" | wc -l | tr -d ' ')
  if [ "$FILE_COUNT" -gt 20 ]; then
    warn "변경 파일 ${FILE_COUNT}개 — 대량 변경 주의"
  fi

  # 2-4. git add (위험 파일 제외)
  git add -A
  STAGED=$(git diff --cached --name-only)

  # 민감 파일 차단
  SENSITIVE=$(echo "$STAGED" | grep -E '\.env$|\.env\.|credentials|\.pem|\.key' || true)
  if [ -n "$SENSITIVE" ]; then
    git reset HEAD -- $SENSITIVE 2>/dev/null || true
    warn "민감 파일 스테이징 제외: $SENSITIVE"
  fi

  git commit -m "$COMMIT_MSG" || fail "git commit 실패"
  ok "커밋 완료: $COMMIT_MSG"
fi

# ── 3) git push ──
info "git push 중..."
git push origin $BRANCH || fail "git push 실패"
COMMIT_HASH=$(git rev-parse --short HEAD)
ok "push 완료: $COMMIT_HASH"

# ── 4) 서버 사전 상태 확인 ──
info "서버 사전 상태 확인 중..."
SERVER_PRE_STATUS=$(ssh -i "$SSH_KEY" "$SSH_HOST" -o ConnectTimeout=10 \
  "docker ps --filter name=attendance --format '{{.Names}} {{.Status}}' 2>/dev/null || echo 'UNREACHABLE'" 2>&1) || true

if echo "$SERVER_PRE_STATUS" | grep -q "UNREACHABLE"; then
  fail "서버 SSH 접속 실패. 서버 상태 확인 필요."
fi
echo "  서버 현재 상태: $SERVER_PRE_STATUS" | tee -a "$DEPLOY_LOG"

# ── 5) 서버 배포 ──
info "서버 배포 중... (pull → build → restart)"
DEPLOY_OUTPUT=$(ssh -i "$SSH_KEY" "$SSH_HOST" bash -s <<'REMOTE'
set -e
cd ~/app/attendance
echo "=== git pull ==="
git pull origin master 2>&1
echo "=== docker build ==="
docker compose up -d --build 2>&1 | tail -15
# 헬스체크 대기 (최대 90초, 더 보수적)
echo "=== healthcheck ==="
for i in $(seq 1 18); do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' attendance 2>/dev/null || echo "unknown")
  echo "  [$i/18] health=$STATUS"
  if [ "$STATUS" = "healthy" ]; then
    echo "HEALTH:healthy"
    break
  fi
  sleep 5
done
STATUS=$(docker inspect --format='{{.State.Health.Status}}' attendance 2>/dev/null || echo "unknown")
if [ "$STATUS" != "healthy" ]; then
  echo "HEALTH:$STATUS"
  echo "=== 최근 로그 ==="
  docker logs attendance --tail 30 2>&1 || true
fi
docker ps --filter name=attendance --format '{{.Names}} {{.Status}}' 2>&1
REMOTE
) 2>&1

echo "$DEPLOY_OUTPUT" | tee -a "$DEPLOY_LOG"

if echo "$DEPLOY_OUTPUT" | grep -q "HEALTH:healthy"; then
  ok "서버 배포 완료 (healthy)"
else
  # 실패 시 서버 로그 저장
  FAIL_LOG="$LOG_DIR/deploy_fail_$(date +%Y%m%d_%H%M%S).log"
  echo "$DEPLOY_OUTPUT" > "$FAIL_LOG"
  warn "실패 로그 저장: $FAIL_LOG"
  fail "서버 배포 후 헬스체크 실패. 로그 확인 필요."
fi

# ── 6) 결과 요약 ──
echo "" | tee -a "$DEPLOY_LOG"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$DEPLOY_LOG"
echo -e " 커밋: ${GREEN}${COMMIT_HASH}${NC} $COMMIT_MSG" | tee -a "$DEPLOY_LOG"
echo -e " push: ${GREEN}OK${NC}" | tee -a "$DEPLOY_LOG"
echo -e " 배포: ${GREEN}OK (healthy)${NC}" | tee -a "$DEPLOY_LOG"
if [ -n "${RISK_FILES:-}" ]; then
  echo -e " ${YELLOW}위험 변경:${RISK_FILES}${NC}" | tee -a "$DEPLOY_LOG"
fi
echo " 로그: $DEPLOY_LOG" | tee -a "$DEPLOY_LOG"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$DEPLOY_LOG"
