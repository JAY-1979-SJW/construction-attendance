#!/usr/bin/env bash
# ops-bot 실행 래퍼
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

# .env 로드
if [ -f .env ]; then
  set -a; source .env; set +a
fi

export PYTHONPATH="$DIR"
exec python3 -m ops.telegram_bot "$@"
