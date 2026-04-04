#!/usr/bin/env bash
# 앱 로그 조회 — 인자: app|error|nginx|cron
set -uo pipefail

MODE="${1:-app}"

case "$MODE" in
  app)
    echo "=== 앱 최근 로그 (30줄) ==="
    docker logs attendance --tail 30 2>&1
    ;;
  error)
    echo "=== 앱 에러 로그 (최근 100줄 중 에러) ==="
    docker logs attendance --tail 100 2>&1 | grep -iE 'error|exception|fatal|panic|ECONNREFUSED' | tail -20
    FOUND=$?
    [ "$FOUND" -ne 0 ] && echo "(에러 없음)"
    ;;
  nginx)
    echo "=== Nginx 에러 로그 ==="
    sudo tail -20 /var/log/nginx/error.log 2>/dev/null || echo "접근 불가"
    ;;
  cron)
    echo "=== Cron 로그 ==="
    tail -20 /var/log/attendance-cron.log 2>/dev/null || echo "파일 없음"
    ;;
  *)
    echo "사용법: show_logs_app.sh [app|error|nginx|cron]"
    exit 1
    ;;
esac
