#!/bin/sh
set -e

echo "[entrypoint] DB 마이그레이션 실행..."
./node_modules/.bin/prisma migrate deploy

echo "[entrypoint] 앱 시작..."
exec node server.js
