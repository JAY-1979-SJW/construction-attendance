#!/usr/bin/env bash
# 컨테이너 재시작
set -euo pipefail

TARGET="${1:-attendance}"

# 화이트리스트
if [ "$TARGET" != "attendance" ]; then
  echo "FAIL: 허용 대상 아님 — attendance만 가능"
  exit 1
fi

echo "=== $TARGET 재시작 ==="
echo "시각: $(date '+%Y-%m-%d %H:%M:%S')"

cd ~/app/attendance
docker compose restart "$TARGET" 2>&1
echo ""

echo "헬스체크 대기 (최대 60초)..."
for i in $(seq 1 12); do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$TARGET" 2>/dev/null || echo "unknown")
  echo "  [$i/12] health=$STATUS"
  if [ "$STATUS" = "healthy" ]; then
    echo ""
    echo "결과: PASS — 재시작 성공"
    exit 0
  fi
  sleep 5
done

echo ""
echo "결과: FAIL — 헬스체크 타임아웃"
exit 1
