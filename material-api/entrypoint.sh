#!/bin/sh
set -e

echo "[material-api] Running DB migration..."
node node_modules/prisma/build/index.js migrate deploy

echo "[material-api] Starting server..."
exec node dist/index.js
