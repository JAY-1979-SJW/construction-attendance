#!/bin/sh
set -e

echo "[entrypoint] DB 마이그레이션 실행..."
node node_modules/prisma/build/index.js migrate deploy

echo "[entrypoint] 앱 시작..."
exec node server.js
