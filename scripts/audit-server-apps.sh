#!/usr/bin/env bash
# audit-server-apps.sh — 서버 앱/컨테이너 운영 구조 전수조사
set -euo pipefail

SEP="════════════════════════════════════════════"

echo "$SEP"
echo " 서버 앱 운영 구조 전수조사: $(date '+%Y-%m-%d %H:%M:%S')"
echo "$SEP"

# ── 1. 실행 중 컨테이너 전체 ─────────────────────────────────────
echo ""
echo "▶ [1] 실행 중 컨테이너"
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Status}}"

# ── 2. 중지된 컨테이너 ───────────────────────────────────────────
echo ""
echo "▶ [2] 중지/비정상 컨테이너"
docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}" | grep -Ev "Up [0-9]" || echo "(없음)"

# ── 3. 앱 디렉토리 구조 ──────────────────────────────────────────
echo ""
echo "▶ [3] /home/ubuntu/app 디렉토리"
ls -la /home/ubuntu/app/ 2>/dev/null | grep -E "^d|^total"

# ── 4. docker-compose 파일 목록 ──────────────────────────────────
echo ""
echo "▶ [4] docker-compose 파일 목록"
find /home/ubuntu/app -maxdepth 4 -name "docker-compose*.yml" 2>/dev/null | sort

# ── 5. .env 파일 목록 (내용 제외) ────────────────────────────────
echo ""
echo "▶ [5] .env 파일 목록 (내용 미출력)"
find /home/ubuntu/app -maxdepth 3 \( -name ".env" -o -name ".env.*" \) 2>/dev/null \
  | grep -v node_modules | grep -v ".next" | sort

# ── 6. deploy 스크립트 목록 ──────────────────────────────────────
echo ""
echo "▶ [6] deploy 스크립트"
find /home/ubuntu/app -maxdepth 4 \( -name "deploy*.sh" -o -name "*.deploy.sh" -o -name "release*.sh" \) 2>/dev/null \
  | grep -v node_modules | sort

# ── 7. nginx 업스트림 / proxy_pass 전체 ─────────────────────────
echo ""
echo "▶ [7] nginx upstream / proxy_pass"
grep -rn "server_name\|proxy_pass\|upstream " /home/ubuntu/app/nginx/conf.d/ 2>/dev/null \
  | grep -v "#" | sed 's|/home/ubuntu/app/nginx/conf.d/||'

# ── 8. 도메인→컨테이너 매핑 추출 ────────────────────────────────
echo ""
echo "▶ [8] 도메인 → proxy 대상 매핑"
awk '
  /server_name/ { gsub(/;/,""); split($0,a," "); domain=a[2] }
  /proxy_pass/  { gsub(/;/,""); split($0,a," "); print domain " → " a[2] }
' /home/ubuntu/app/nginx/conf.d/default.conf 2>/dev/null
for f in /home/ubuntu/app/nginx/conf.d/*.conf; do
  [[ "$f" == *default.conf ]] && continue
  awk '
    /server_name/ { gsub(/;/,""); split($0,a," "); domain=a[2] }
    /proxy_pass/  { gsub(/;/,""); split($0,a," "); print domain " → " a[2] }
  ' "$f" 2>/dev/null
done

# ── 9. 컨테이너별 네트워크 ───────────────────────────────────────
echo ""
echo "▶ [9] 컨테이너 네트워크 소속"
docker ps --format "{{.Names}}" | while read name; do
  nets=$(docker inspect "$name" --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' 2>/dev/null)
  echo "  $name → $nets"
done

# ── 10. 포트 충돌 검사 ───────────────────────────────────────────
echo ""
echo "▶ [10] 호스트 포트 매핑 전체"
docker ps --format "{{.Names}}\t{{.Ports}}" | grep -v "^$" | sort

# ── 11. 각 앱 디렉토리별 핵심 파일 존재 여부 ─────────────────────
echo ""
echo "▶ [11] 앱별 핵심 파일 존재 여부"
printf "%-30s %-12s %-8s %-10s %-10s\n" "경로" "compose" ".env" "deploy.sh" "Dockerfile"
for dir in /home/ubuntu/app/*/; do
  name=$(basename "$dir")
  [[ "$name" == "nginx" ]] && continue
  [[ "$name" == "logs" ]]  && continue
  has_compose=$(find "$dir" -maxdepth 3 -name "docker-compose*.yml" 2>/dev/null | head -1 | xargs -I{} echo "O" 2>/dev/null || echo "-")
  has_env=$(find "$dir" -maxdepth 2 -name ".env" 2>/dev/null | head -1 | xargs -I{} echo "O" 2>/dev/null || echo "-")
  has_deploy=$(find "$dir" -maxdepth 3 -name "deploy*.sh" 2>/dev/null | head -1 | xargs -I{} echo "O" 2>/dev/null || echo "-")
  has_docker=$(find "$dir" -maxdepth 2 -name "Dockerfile" 2>/dev/null | head -1 | xargs -I{} echo "O" 2>/dev/null || echo "-")
  [[ -z "$has_compose" ]] && has_compose="-"
  [[ -z "$has_env" ]] && has_env="-"
  [[ -z "$has_deploy" ]] && has_deploy="-"
  [[ -z "$has_docker" ]] && has_docker="-"
  printf "%-30s %-12s %-8s %-10s %-10s\n" "$name" "$has_compose" "$has_env" "$has_deploy" "$has_docker"
done

# ── 12. 공유 볼륨 / 마운트 ───────────────────────────────────────
echo ""
echo "▶ [12] 컨테이너 볼륨 마운트 (호스트 경로)"
docker ps --format "{{.Names}}" | while read name; do
  mounts=$(docker inspect "$name" --format '{{range .Mounts}}{{.Source}} {{end}}' 2>/dev/null | tr ' ' '\n' | grep "^/home" | head -5)
  if [[ -n "$mounts" ]]; then
    echo "  [$name]"
    echo "$mounts" | sed 's/^/    /'
  fi
done

# ── 13. healthcheck 엔드포인트 ───────────────────────────────────
echo ""
echo "▶ [13] 각 도메인 health 응답"
for domain in attendance.haehan-ai.kr gongmu.haehan-ai.kr haehan-ai.kr app.haehan-ai.kr api.haehan-ai.kr; do
  result=$(curl -sk --max-time 3 "https://$domain/api/health" | head -c 80 2>/dev/null || echo "TIMEOUT/ERR")
  echo "  $domain → $result"
done

echo ""
echo "$SEP"
echo " 조사 완료: $(date '+%Y-%m-%d %H:%M:%S')"
echo "$SEP"
