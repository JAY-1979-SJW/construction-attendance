#!/bin/bash
# 나라장터 자재물가 주간 수집 (매주 월요일 11:00 KST)
# 크론 등록: 0 11 * * 1 bash /home/ubuntu/app/attendance/scripts/nara-collect-weekly.sh >> /home/ubuntu/app/attendance/logs/nara_weekly.log 2>&1

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$APP_DIR/logs"
TIMESTAMP="$(date '+%Y-%m-%d %H:%M:%S')"
WEEK="$(date '+%Y_W%V')"

mkdir -p "$LOG_DIR"
echo "========================================"
echo "nara-collect-weekly 시작: $TIMESTAMP"
echo "========================================"

# 환경변수: .env에서 로드
ENV_FILE="$APP_DIR/.env.production"
if [ ! -f "$ENV_FILE" ]; then
  ENV_FILE="$APP_DIR/.env"
fi
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

NARA_KEY="${G2B_API_KEY_BID:-${NARA_PRICE_API_KEY:-}}"
if [ -z "$NARA_KEY" ]; then
  echo "[FAIL] API 키 미설정 (G2B_API_KEY_BID 또는 NARA_PRICE_API_KEY)"
  exit 1
fi

DB_URL="${DATABASE_URL:-}"
if [ -z "$DB_URL" ]; then
  echo "[FAIL] DATABASE_URL 미설정"
  exit 1
fi

# API 응답 확인 (타임아웃 10초)
echo "[1] NARA API 응답 확인..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
  "http://apis.data.go.kr/1230000/ao/PriceInfoService/getNetRsceinfoList?serviceKey=${NARA_KEY}&numOfRows=1&pageNo=1&type=json" || echo "000")

if [ "$HTTP_CODE" != "200" ]; then
  echo "[WARN] API 응답 없음 (HTTP $HTTP_CODE) — 수집 건너뜀"
  echo "[결과] SKIP (API 장애)"
  exit 0
fi

echo "[OK] API 응답 확인 (HTTP $HTTP_CODE)"

# material-api collect_materials.py 실행
echo "[2] material-api 수집 시작..."
cd "$APP_DIR/material-api"

NARA_PRICE_API_KEY="$NARA_KEY" DATABASE_URL="$DB_URL" \
  python3 scripts/collect_materials.py --source nara \
  >> "$LOG_DIR/collect_nara_${WEEK}.log" 2>&1

echo "[OK] 수집 완료"
echo "========================================"
echo "nara-collect-weekly 종료: $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"
