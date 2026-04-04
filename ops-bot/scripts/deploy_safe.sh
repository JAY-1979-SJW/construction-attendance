#!/usr/bin/env bash
# 안전 배포 — git pull → docker rebuild → 헬스체크
set -euo pipefail

echo "=== 안전 배포 시작 ==="
echo "시각: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

cd ~/app/attendance

echo "[1] git pull"
git pull origin master 2>&1
echo ""

echo "[2] docker build + restart"
docker compose up -d --build 2>&1 | tail -15
echo ""

echo "[3] 헬스체크 (최대 90초)"
for i in $(seq 1 18); do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' attendance 2>/dev/null || echo "unknown")
  echo "  [$i/18] health=$STATUS"
  if [ "$STATUS" = "healthy" ]; then
    echo ""
    echo "결과: PASS — 배포 성공 (healthy)"
    docker ps --filter name=attendance --format '{{.Names}} {{.Status}}' 2>&1
    exit 0
  fi
  sleep 5
done

echo ""
echo "결과: FAIL — 헬스체크 타임아웃"
echo "최근 로그:"
docker logs attendance --tail 15 2>&1
exit 1
