#!/usr/bin/env bash
# ──────────────────────────────────────────────
# deploy_and_check.sh — 통합: 커밋 → 배포 → 웹 점검 → 결과 보고
# 사용법: bash scripts/deploy_and_check.sh "커밋 메시지"
# ──────────────────────────────────────────────
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

COMMIT_MSG="${1:-}"
if [ -z "$COMMIT_MSG" ]; then
  echo -e "${RED}[FAIL]${NC} 커밋 메시지를 인자로 전달하세요."
  echo "  예: bash scripts/deploy_and_check.sh \"feat: 기능 추가\""
  exit 1
fi

echo ""
echo "╔══════════════════════════════════════╗"
echo "║  배포 + 점검 시작                    ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── STEP 1: 배포 ──
echo "▶ STEP 1: 배포"
echo "────────────────────────────────"
if bash "$SCRIPT_DIR/deploy.sh" "$COMMIT_MSG"; then
  DEPLOY_OK=true
else
  DEPLOY_OK=false
fi
echo ""

if [ "$DEPLOY_OK" = false ]; then
  echo "╔══════════════════════════════════════╗"
  echo -e "║  ${RED}배포 실패 — 웹 점검 건너뜀${NC}         ║"
  echo "╚══════════════════════════════════════╝"
  echo ""
  COMMIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
  echo "━━━━━ 최종 보고 ━━━━━"
  echo " 커밋 해시: $COMMIT_HASH"
  echo " 커밋 메시지: $COMMIT_MSG"
  echo " push: 확인 필요"
  echo -e " 서버 배포: ${RED}실패${NC}"
  echo " 웹 점검: 미실행"
  echo " 실패 항목: deploy.sh 참조"
  echo " 롤백 필요: 배포 실패이므로 서버는 이전 버전 유지"
  echo " 다음 조치: 에러 로그 확인 후 재시도"
  exit 1
fi

# ── STEP 2: 웹 점검 ──
echo "▶ STEP 2: 웹 점검"
echo "────────────────────────────────"
if bash "$SCRIPT_DIR/check_web.sh"; then
  CHECK_OK=true
else
  CHECK_OK=false
fi
echo ""

# ── 최종 보고 ──
COMMIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

echo "╔══════════════════════════════════════╗"
echo "║  최종 보고                           ║"
echo "╚══════════════════════════════════════╝"
echo ""
echo " 커밋 해시: $COMMIT_HASH"
echo " 커밋 메시지: $COMMIT_MSG"
echo -e " push: ${GREEN}성공${NC}"
echo -e " 서버 배포: ${GREEN}성공 (healthy)${NC}"

if [ "$CHECK_OK" = true ]; then
  echo -e " 웹 점검: ${GREEN}ALL PASS${NC}"
  echo " 실패 항목: 없음"
  echo " 롤백 필요: 아니오"
  echo " 다음 조치: 없음"
else
  echo -e " 웹 점검: ${RED}일부 실패${NC}"
  echo " 실패 항목: check_web.sh 출력 참조"
  echo " 롤백 필요: 점검 결과에 따라 판단"
  echo " 다음 조치: 실패 항목 확인 후 수정 또는 롤백"
fi
echo ""
