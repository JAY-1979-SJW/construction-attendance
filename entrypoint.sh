#!/bin/sh
set -e

# 마이그레이션은 기준 서버 1대에서만 실행
# 기준 서버: MIGRATE_ON_START=true (APP_SERVER_1)
# 일반 서버: MIGRATE_ON_START=false 또는 미설정
if [ "${MIGRATE_ON_START:-false}" = "true" ]; then
  echo "[entrypoint] DB 마이그레이션 실행 (MIGRATE_ON_START=true)..."
  node node_modules/prisma/build/index.js migrate deploy
  echo "[entrypoint] 마이그레이션 완료."
else
  echo "[entrypoint] 마이그레이션 건너뜀 (MIGRATE_ON_START=false)."
fi

echo "[entrypoint] 앱 시작..."
exec node server.js
