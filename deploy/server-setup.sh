#!/bin/bash
# ═══════════════════════════════════════════════════════════
#  해한 현장 출퇴근 시스템 — 서버 배포 스크립트
#  Ubuntu 20.04 / 22.04 기준
#  실행: bash deploy/server-setup.sh [--yes]
#  --yes : 대화형 입력 없이 자동 실행 (seed 건너뜀)
#  AUTO_YES=true bash deploy/server-setup.sh  도 동일
# ═══════════════════════════════════════════════════════════

set -euo pipefail

# ── 옵션 파싱 ──
AUTO_YES="${AUTO_YES:-false}"
for arg in "$@"; do
  [ "$arg" = "--yes" ] && AUTO_YES="true"
done

APP_DIR="$HOME/apps/construction-attendance"
REPO_URL="https://github.com/JAY-1979-SJW/construction-attendance.git"

echo "======================================"
echo " 해한 현장 출퇴근 시스템 배포 시작"
echo "======================================"

# 1. Node.js 설치 (없을 시)
if ! command -v node &> /dev/null; then
    echo "[1] Node.js 설치 중..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "[1] Node.js $(node -v) 이미 설치됨"
fi

# 2. pm2 설치 (없을 시)
if ! command -v pm2 &> /dev/null; then
    echo "[2] pm2 설치 중..."
    sudo npm install -g pm2
else
    echo "[2] pm2 이미 설치됨"
fi

# 3. PostgreSQL 확인
if ! command -v psql &> /dev/null; then
    echo "[3] WARNING: PostgreSQL 미설치. 아래 명령으로 설치하세요:"
    echo "    sudo apt-get install -y postgresql postgresql-contrib"
    echo "    sudo -u postgres createuser --interactive"
    echo "    sudo -u postgres createdb construction_attendance"
else
    echo "[3] PostgreSQL $(psql --version) 확인됨"
fi

# 4. 코드 배포
echo "[4] 코드 배포 중..."
if [ -d "$APP_DIR/.git" ]; then
    echo "    기존 저장소 pull..."
    cd "$APP_DIR"
    git pull origin master
else
    echo "    새로 clone..."
    mkdir -p "$HOME/apps"
    git clone "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi

# 5. 환경변수 확인
if [ ! -f "$APP_DIR/.env" ]; then
    echo "[5] .env 파일이 없습니다!"
    echo "    cp .env.example .env 후 실제 값을 입력하세요."
    exit 1
else
    echo "[5] .env 파일 확인됨"
fi

# 6. 의존성 설치
echo "[6] npm install..."
npm install --production=false

# 7. DB 마이그레이션
echo "[7] Prisma 마이그레이션..."
npx prisma migrate deploy

# 8. 초기 데이터 (최초 1회만)
if [ "$AUTO_YES" = "true" ]; then
    echo "[8] 초기 데이터(seed) 건너뜀 (--yes 모드)"
else
    read -p "[8] 초기 데이터(seed)를 실행하시겠습니까? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        npx prisma db seed
    fi
fi

# 9. 빌드
echo "[9] Next.js 빌드..."
npm run build

# 10. 로그 디렉토리
mkdir -p "$APP_DIR/logs"

# 11. pm2 시작
echo "[10] pm2 시작..."
pm2 delete construction-attendance 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup | tail -1

echo ""
echo "======================================"
echo " 배포 완료!"
echo " pm2 상태: pm2 status"
echo " 로그 확인: pm2 logs construction-attendance"
echo " 앱 포트: http://localhost:3000"
echo "======================================"
