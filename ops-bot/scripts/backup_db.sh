#!/usr/bin/env bash
# DB 백업 — pg_dump → 압축 저장
set -euo pipefail

# ── 중복 실행 방지 ──
LOCK_FILE="/tmp/backup_db_sh.lock"
if [ -f "$LOCK_FILE" ]; then
  OLD_PID=$(cat "$LOCK_FILE" 2>/dev/null || echo "")
  if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    echo "[SKIP] backup_db.sh 이미 실행 중 (PID=$OLD_PID) — 중복 실행 차단"
    exit 1
  fi
fi
echo $$ > "$LOCK_FILE"
trap "rm -f '$LOCK_FILE'" EXIT INT TERM

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

# DB 접근 (attendance_app 유저 — pg_hba.conf 허용 계정)
DB_HOST="${DB_HOST:-192.168.120.18}"
DB_USER="${DB_USER:-attendance_app}"
PGPASSWORD="${DB_PASSWORD:?'DB_PASSWORD 미설정 — ops-bot/.env 또는 환경변수에 설정 필요'}" pg_dump \
  -h "$DB_HOST" \
  -U "$DB_USER" \
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
  if [ "$OLD" -gt 0 ]; then echo "정리: ${OLD}건 삭제 (30일 초과)"; fi
else
  echo "결과: FAIL — pg_dump 실패 (exit=$DUMP_EXIT)"
  rm -f "$BACKUP_FILE"
  exit 1
fi
