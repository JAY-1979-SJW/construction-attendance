#!/usr/bin/env bash
# JWT 런타임 검증 — sign → verify 테스트
set -uo pipefail

# ── 민감정보 확인 ──
OPS_LOGIN_ID="${OPS_LOGIN_ID:?'OPS_LOGIN_ID 미설정 — ops-bot/.env 또는 환경변수에 설정 필요'}"
OPS_LOGIN_PW="${OPS_LOGIN_PW:?'OPS_LOGIN_PW 미설정 — ops-bot/.env 또는 환경변수에 설정 필요'}"

# ── 컨테이너 IP 동적 조회 ──
APP_HOST=$(docker inspect attendance --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' 2>/dev/null)
APP_HOST="${APP_HOST:-172.18.0.2}"
APP_BASE="http://${APP_HOST}:3002"

echo "=== JWT 런타임 검증 ==="

# 1. 로그인 API로 토큰 발급
echo "[1] 로그인 API 호출..."
LOGIN_PAYLOAD="{\"email\":\"${OPS_LOGIN_ID}\",\"password\":\"${OPS_LOGIN_PW}\"}"
LOGIN_RESULT=$(curl -s -w "\n%{http_code}" -X POST ${APP_BASE}/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d "$LOGIN_PAYLOAD" 2>/dev/null)

LOGIN_CODE=$(echo "$LOGIN_RESULT" | tail -1)
LOGIN_BODY=$(echo "$LOGIN_RESULT" | sed '$d')

if [ "$LOGIN_CODE" != "200" ]; then
  echo "FAIL: 로그인 실패 (HTTP $LOGIN_CODE)"
  echo "$LOGIN_BODY" | head -c 200
  exit 1
fi
echo "OK: 로그인 성공 (HTTP $LOGIN_CODE)"

# 2. Set-Cookie 헤더에서 토큰 추출 (Secure 쿠키 → 헤더 직접 파싱)
TOKEN=$(curl -s -D - -o /dev/null -X POST "${APP_BASE}/api/admin/auth/login" \
  -H "Content-Type: application/json" \
  -d "$LOGIN_PAYLOAD" 2>/dev/null \
  | grep -i "set-cookie: admin_token=" \
  | grep -oP '(?<=admin_token=)[^;]+')

if [ -z "$TOKEN" ]; then
  echo "FAIL: 토큰 추출 실패"
  exit 1
fi
echo "OK: 토큰 발급됨 (${#TOKEN}자)"

# 3. 토큰으로 API 호출 (verify 테스트)
echo ""
echo "[2] 토큰 검증 (API 호출)..."
VERIFY=$(docker exec attendance node -e "
const http=require('http');
const opts={hostname:'localhost',port:3002,path:'/api/admin/sites',headers:{Cookie:'admin_token=$TOKEN'}};
http.get(opts,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>console.log(r.statusCode+' '+d.substring(0,100)));}).on('error',e=>console.log('ERR '+e.message));
" 2>&1)
echo "$VERIFY"

VERIFY_CODE=$(echo "$VERIFY" | head -1 | cut -d' ' -f1)
if [ "$VERIFY_CODE" = "200" ]; then
  echo ""
  echo "결과: PASS — sign→verify 정상"
else
  echo ""
  echo "결과: FAIL — 토큰 검증 실패 ($VERIFY_CODE)"
  exit 1
fi
