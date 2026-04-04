#!/usr/bin/env bash
# DB 백업 — pg_dump → 압축 저장
set -euo pipefail

TARGET="${1:-db}"
if [ "$TARGET" != "db" ]; then
  echo "FAIL: 허용 대상 아님 — db만 가능"
  exit 1
fi

BACKUP_DIR="/mnt/nas/attendance/backups"
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/attendance_${TIMESTAMP}.sql.gz"

echo "=== DB 백업 ==="
echo "시각: $(date '+%Y-%m-%d %H:%M:%S')"
echo "대상: construction_attendance"
echo "저장: $BACKUP_FILE"
echo ""

# Docker 네트워크에서 DB 접근
DB_HOST="${DB_HOST:-192.168.120.18}"
PGPASSWORD="${DB_PASSWORD:?'DB_PASSWORD 미설정 — ops-bot/.env 또는 환경변수에 설정 필요'}" pg_dump \
  -h "$DB_HOST" \
  -U postgres \
  -d construction_attendance \
  --no-owner \
  --no-privileges \
  2>&1 | gzip > "$BACKUP_FILE"

DUMP_EXIT=${PIPESTATUS[0]}

if [ "$DUMP_EXIT" -eq 0 ] && [ -s "$BACKUP_FILE" ]; then
  SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "결과: PASS"
  echo "크기: $SIZE"
  echo "경로: $BACKUP_FILE"

  # 30일 이상 백업 정리
  OLD=$(find "$BACKUP_DIR" -name "attendance_*.sql.gz" -mtime +30 -delete -print | wc -l)
  [ "$OLD" -gt 0 ] && echo "정리: ${OLD}건 삭제 (30일 초과)"
else
  echo "결과: FAIL — pg_dump 실패 (exit=$DUMP_EXIT)"
  rm -f "$BACKUP_FILE"
  exit 1
fi
