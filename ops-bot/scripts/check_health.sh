#!/usr/bin/env bash
# 앱 헬스체크 + 컨테이너 상태
set -uo pipefail

echo "=== 컨테이너 ==="
STATUS=$(docker inspect attendance --format '{{.State.Status}}|{{.State.Health.Status}}|{{.RestartCount}}' 2>/dev/null || echo "?|?|?")
IFS='|' read -r c_status c_health c_restart <<< "$STATUS"
echo "상태: $c_status"
echo "헬스: $c_health"
echo "재시작: ${c_restart}회"
echo ""

echo "=== 내부 헬스 ==="
HEALTH=$(docker exec attendance node -e "
const http=require('http');
const s=Date.now();
http.get('http://localhost:3002/api/health',r=>{
  let d='';r.on('data',c=>d+=c);
  r.on('end',()=>console.log('HTTP '+r.statusCode+' '+(Date.now()-s)+'ms '+d));
}).on('error',e=>console.log('FAIL '+e.message));
" 2>&1)
echo "$HEALTH"
echo ""

echo "=== 외부 헬스 ==="
EXT=$(curl -s -o /dev/null -w "%{http_code} %{time_total}s" --max-time 10 https://attendance.haehan-ai.kr/api/health 2>/dev/null)
echo "도메인: $EXT"
echo ""

echo "=== Docker 리소스 ==="
docker stats attendance --no-stream --format 'CPU={{.CPUPerc}} MEM={{.MemUsage}} ({{.MemPerc}})' 2>/dev/null || echo "확인 불가"
