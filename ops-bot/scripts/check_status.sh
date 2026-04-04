#!/usr/bin/env bash
# 서버 상태 조회
set -uo pipefail

echo "=== 시스템 ==="
echo "시각: $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "uptime: $(uptime -p 2>/dev/null || uptime)"
echo ""

echo "=== Git ==="
cd ~/app/attendance 2>/dev/null && {
  echo "브랜치: $(git branch --show-current)"
  echo "커밋: $(git rev-parse --short HEAD) $(git log -1 --format='%s' 2>/dev/null)"
  echo "미반영: $(git rev-list HEAD..origin/master --count 2>/dev/null || echo '?')건"
} || echo "git 접근 불가"
echo ""

echo "=== Docker ==="
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null || echo "docker 접근 불가"
echo ""

echo "=== 디스크 ==="
df -h / /mnt/nas 2>/dev/null | tail -n +2 || echo "확인 불가"
echo ""

echo "=== 메모리 ==="
free -h 2>/dev/null | head -2 || echo "확인 불가"
