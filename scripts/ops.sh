#!/usr/bin/env bash
# ══════════════════════════════════════════════════════
# ops.sh — Claude용 운영 진입점
#
# 사용법:
#   bash scripts/ops.sh check          # ops-check.sh
#   bash scripts/ops.sh disk-check     # ops-disk-recover.sh --check-only
#   bash scripts/ops.sh disk-fix       # ops-disk-recover.sh
#   bash scripts/ops.sh deploy-verify  # deploy-and-verify.sh
# ══════════════════════════════════════════════════════
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
  echo "사용법: bash scripts/ops.sh <command>"
  echo ""
  echo "  check          ops-check 전체 점검"
  echo "  disk-check     디스크 사용률 점검 (정리 없음)"
  echo "  disk-fix       디스크 점검 + 필요 시 안전 정리"
  echo "  deploy-verify  배포 + 검증 (deploy-and-verify.sh)"
  exit 1
}

CMD="${1:-}"

case "$CMD" in
  check)
    echo "ops.sh check"
    exec bash "$SCRIPT_DIR/ops-check.sh" "${@:2}"
    ;;
  disk-check)
    echo "ops.sh disk-check"
    exec bash "$SCRIPT_DIR/ops-disk-recover.sh" --check-only
    ;;
  disk-fix)
    echo "ops.sh disk-fix"
    exec bash "$SCRIPT_DIR/ops-disk-recover.sh" "${@:2}"
    ;;
  deploy-verify)
    echo "ops.sh deploy-verify"
    exec bash "$SCRIPT_DIR/deploy-and-verify.sh" "${@:2}"
    ;;
  *)
    usage
    ;;
esac
