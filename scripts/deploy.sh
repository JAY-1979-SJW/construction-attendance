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

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; exit 1; }
info() { echo -e "${YELLOW}[INFO]${NC} $1"; }

# ── 1) 커밋 메시지 확인 ──
COMMIT_MSG="${1:-}"
if [ -z "$COMMIT_MSG" ]; then
  fail "커밋 메시지를 인자로 전달하세요. 예: bash scripts/deploy.sh \"feat: 기능 추가\""
fi

# ── 2) 변경사항 확인 ──
info "변경사항 확인 중..."
CHANGES=$(git status --porcelain 2>/dev/null || true)
if [ -z "$CHANGES" ]; then
  info "변경사항 없음. push만 확인합니다."
  AHEAD=$(git rev-list --count origin/$BRANCH..$BRANCH 2>/dev/null || echo "0")
  if [ "$AHEAD" = "0" ]; then
    fail "커밋할 변경사항도, push할 커밋도 없습니다."
  fi
  info "미push 커밋 ${AHEAD}개 있음. push 진행."
else
  echo "$CHANGES"
  # 변경된 파일만 add (위험 파일 제외)
  git add -A
  STAGED=$(git diff --cached --name-only)
  # .env, credential 파일 차단
  if echo "$STAGED" | grep -qE '\.env$|\.env\.|credentials|\.pem|\.key'; then
    git reset HEAD -- $(echo "$STAGED" | grep -E '\.env$|\.env\.|credentials|\.pem|\.key')
    info "민감 파일은 스테이징에서 제외했습니다."
  fi
  git commit -m "$COMMIT_MSG" || fail "git commit 실패"
  ok "커밋 완료: $COMMIT_MSG"
fi

# ── 3) git push ──
info "git push 중..."
git push origin $BRANCH || fail "git push 실패"
COMMIT_HASH=$(git rev-parse --short HEAD)
ok "push 완료: $COMMIT_HASH"

# ── 4) 서버 배포 ──
info "서버 배포 중... (pull → build → restart)"
DEPLOY_OUTPUT=$(ssh -i "$SSH_KEY" "$SSH_HOST" bash -s <<'REMOTE'
set -e
cd ~/app/attendance
git pull origin master 2>&1
docker compose up -d --build 2>&1 | tail -10
# 헬스체크 대기 (최대 60초)
for i in $(seq 1 12); do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' attendance 2>/dev/null || echo "unknown")
  if [ "$STATUS" = "healthy" ]; then
    echo "HEALTH:healthy"
    break
  fi
  sleep 5
done
STATUS=$(docker inspect --format='{{.State.Health.Status}}' attendance 2>/dev/null || echo "unknown")
if [ "$STATUS" != "healthy" ]; then
  echo "HEALTH:$STATUS"
fi
docker ps --filter name=attendance --format '{{.Names}} {{.Status}}' 2>&1
REMOTE
) 2>&1

echo "$DEPLOY_OUTPUT"

if echo "$DEPLOY_OUTPUT" | grep -q "HEALTH:healthy"; then
  ok "서버 배포 완료 (healthy)"
else
  fail "서버 배포 후 헬스체크 실패. 로그 확인 필요."
fi

# ── 5) 결과 요약 ──
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e " 커밋: ${GREEN}${COMMIT_HASH}${NC} $COMMIT_MSG"
echo -e " push: ${GREEN}OK${NC}"
echo -e " 배포: ${GREEN}OK (healthy)${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
