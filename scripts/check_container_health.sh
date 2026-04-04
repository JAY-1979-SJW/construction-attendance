#!/usr/bin/env bash
# ──────────────────────────────────────────────
# check_container_health.sh — 서버 컨테이너 상태 자동 점검
#
# 점검 항목:
#   1. docker compose ps (상태 확인)
#   2. 컨테이너 상태 (running/exited/restarting/unhealthy)
#   3. restart count
#   4. 앱 포트 응답
#   5. health endpoint
#   6. 최근 에러 로그 수집
#   7. error/exception/traceback/segfault/oom 탐지
#   8. 디스크/메모리 상태
#
# 사용법: bash scripts/check_container_health.sh
# ──────────────────────────────────────────────
set -uo pipefail

SSH_KEY="${SSH_KEY:-$HOME/.ssh/haehan-ai.pem}"
SSH_HOST="ubuntu@1.201.176.236"
APP_DIR="~/app/attendance"
DOMAIN="https://attendance.haehan-ai.kr"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$SCRIPT_DIR/../logs"
mkdir -p "$LOG_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT="$LOG_DIR/container_health_${TIMESTAMP}.log"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0
NOT_TESTED=0
RESULTS=""

out()  { echo "$1" | tee -a "$REPORT"; }
outc() { echo -e "$1" | tee -a "$REPORT"; }

result_pass() { PASS=$((PASS+1)); RESULTS="${RESULTS}PASS|$1|${2:-}\n"; outc "  ${GREEN}[PASS]${NC} $1 ${2:+→ $2}"; }
result_fail() { FAIL=$((FAIL+1)); RESULTS="${RESULTS}FAIL|$1|${2:-}\n"; outc "  ${RED}[FAIL]${NC} $1 ${2:+→ $2}"; }
result_warn() { WARN=$((WARN+1)); RESULTS="${RESULTS}WARN|$1|${2:-}\n"; outc "  ${YELLOW}[WARN]${NC} $1 ${2:+→ $2}"; }
result_skip() { NOT_TESTED=$((NOT_TESTED+1)); RESULTS="${RESULTS}NOT_TESTED|$1|${2:-}\n"; outc "  ${YELLOW}[NOT TESTED]${NC} $1 ${2:+→ $2}"; }

outc "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
out " 컨테이너 헬스체크"
out " 시각: $(date '+%Y-%m-%d %H:%M:%S')"
out " 대상: $SSH_HOST"
outc "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
out ""

# ═══════════════════════════════════════════
# SSH 접속 확인
# ═══════════════════════════════════════════
outc "${CYAN}[1] SSH 접속${NC}"
SSH_TEST=$(ssh -i "$SSH_KEY" "$SSH_HOST" -o ConnectTimeout=10 -o BatchMode=yes "echo OK" 2>&1) || true
if [ "$SSH_TEST" = "OK" ]; then
  result_pass "SSH 접속" "정상"
else
  result_fail "SSH 접속" "실패: $SSH_TEST"
  out ""
  out "SSH 접속 실패 — 이후 점검 불가"
  echo -e "$RESULTS" > "$LOG_DIR/last_container_failure.log"
  exit 1
fi
out ""

# ═══════════════════════════════════════════
# 서버 원격 점검 (한 번의 SSH로 전부 수집)
# ═══════════════════════════════════════════
outc "${CYAN}[2-8] 서버 원격 점검${NC}"

REMOTE_DATA=$(ssh -i "$SSH_KEY" "$SSH_HOST" -o ConnectTimeout=15 bash -s <<'REMOTE_SCRIPT'
set -uo pipefail

echo "===SECTION:COMPOSE_PS==="
cd ~/app/attendance
docker compose ps --format '{{.Name}}|{{.State}}|{{.Status}}' 2>/dev/null || echo "ERROR:compose_ps_failed"

echo "===SECTION:CONTAINER_INSPECT==="
# attendance 컨테이너 상세
docker inspect attendance --format '{{.State.Status}}|{{.State.Health.Status}}|{{.RestartCount}}|{{.State.StartedAt}}' 2>/dev/null || echo "ERROR:inspect_failed"

echo "===SECTION:PORT_CHECK==="
# 포트 응답 — Docker healthcheck과 동일 방식 (node 내부에서 확인)
docker exec attendance node -e "
const http = require('http');
const start = Date.now();
http.get('http://localhost:3002/api/health', r => {
  const elapsed = ((Date.now() - start) / 1000).toFixed(3);
  console.log(r.statusCode + '|' + elapsed);
  process.exit(0);
}).on('error', () => {
  console.log('000|0');
  process.exit(1);
});
" 2>/dev/null || echo "000|timeout"

echo "===SECTION:HEALTH_BODY==="
docker exec attendance node -e "
const http = require('http');
http.get('http://localhost:3002/api/health', r => {
  let d = '';
  r.on('data', c => d += c);
  r.on('end', () => console.log(d));
}).on('error', () => console.log('ERROR:health_failed'));
" 2>/dev/null || echo "ERROR:health_failed"

echo "===SECTION:ERROR_LOG==="
# 최근 에러 로그 100줄
docker logs attendance --tail 100 2>&1 | grep -iE 'error|exception|traceback|segfault|oom|killed|fatal|panic|ECONNREFUSED|ENOTFOUND' | tail -20 || echo "NONE"

echo "===SECTION:FULL_LOG_TAIL==="
# 최근 로그 마지막 20줄 (에러 아닌 것도 포함)
docker logs attendance --tail 20 2>&1 || echo "ERROR:log_failed"

echo "===SECTION:DISK==="
df -h / /mnt/nas 2>/dev/null | tail -n +2 || echo "ERROR:disk_failed"

echo "===SECTION:MEMORY==="
free -m 2>/dev/null | head -2 || echo "ERROR:memory_failed"

echo "===SECTION:DOCKER_STATS==="
docker stats attendance --no-stream --format '{{.CPUPerc}}|{{.MemUsage}}|{{.MemPerc}}' 2>/dev/null || echo "ERROR:stats_failed"

echo "===SECTION:END==="
REMOTE_SCRIPT
) 2>&1

# 원격 데이터를 로그에 저장
echo "$REMOTE_DATA" >> "$REPORT"

# ── 파싱 함수 ──
get_section() {
  echo "$REMOTE_DATA" | sed -n "/===SECTION:$1===/,/===SECTION:/p" | sed '1d;$d'
}

# ═══════════════════════════════════════════
# 2. docker compose ps
# ═══════════════════════════════════════════
out ""
outc "${CYAN}[2] 컨테이너 상태${NC}"

COMPOSE_PS=$(get_section "COMPOSE_PS")
if echo "$COMPOSE_PS" | grep -q "ERROR"; then
  result_fail "compose ps" "명령 실패"
else
  while IFS='|' read -r name state status; do
    [ -z "$name" ] && continue
    if [ "$state" = "running" ]; then
      result_pass "$name" "$state ($status)"
    elif [ "$state" = "exited" ]; then
      result_fail "$name" "exited ($status)"
    elif [ "$state" = "restarting" ]; then
      result_fail "$name" "restarting ($status)"
    else
      result_warn "$name" "$state ($status)"
    fi
  done <<< "$COMPOSE_PS"
fi
out ""

# ═══════════════════════════════════════════
# 3. 컨테이너 상세 (health, restart count)
# ═══════════════════════════════════════════
outc "${CYAN}[3] 컨테이너 상세${NC}"

INSPECT=$(get_section "CONTAINER_INSPECT")
if echo "$INSPECT" | grep -q "ERROR"; then
  result_skip "컨테이너 상세" "inspect 실패"
else
  IFS='|' read -r c_status c_health c_restart c_started <<< "$INSPECT"

  # health 상태
  if [ "$c_health" = "healthy" ]; then
    result_pass "health 상태" "$c_health"
  elif [ "$c_health" = "starting" ]; then
    result_warn "health 상태" "$c_health (아직 시작 중)"
  else
    result_fail "health 상태" "$c_health"
  fi

  # restart count
  c_restart=${c_restart:-0}
  if [ "$c_restart" -eq 0 ]; then
    result_pass "restart count" "${c_restart}회"
  elif [ "$c_restart" -le 3 ]; then
    result_warn "restart count" "${c_restart}회"
  else
    result_fail "restart count" "${c_restart}회 — 반복 재시작 의심"
  fi

  out "  시작 시각: ${c_started:-unknown}"
fi
out ""

# ═══════════════════════════════════════════
# 4. 앱 포트 응답
# ═══════════════════════════════════════════
outc "${CYAN}[4] 앱 포트 응답 (localhost:3002)${NC}"

PORT_CHECK=$(get_section "PORT_CHECK")
IFS='|' read -r p_code p_time <<< "$PORT_CHECK"
p_code=${p_code:-000}
p_time=${p_time:-0}

if [ "$p_code" = "200" ]; then
  p_time_int=${p_time%%.*}
  if [ "${p_time_int:-0}" -ge 3 ]; then
    result_warn "포트 응답" "$p_code (${p_time}s slow)"
  else
    result_pass "포트 응답" "$p_code (${p_time}s)"
  fi
elif [ "$p_code" = "000" ]; then
  result_fail "포트 응답" "타임아웃/연결실패"
else
  result_fail "포트 응답" "HTTP $p_code"
fi
out ""

# ═══════════════════════════════════════════
# 5. health endpoint body
# ═══════════════════════════════════════════
outc "${CYAN}[5] health endpoint body${NC}"

HEALTH_BODY=$(get_section "HEALTH_BODY")
if echo "$HEALTH_BODY" | grep -q '"status":"ok"'; then
  result_pass "health body" "status=ok"
elif echo "$HEALTH_BODY" | grep -q "ERROR"; then
  result_fail "health body" "응답 없음"
else
  result_warn "health body" "$(echo "$HEALTH_BODY" | head -c 80)"
fi
out ""

# ═══════════════════════════════════════════
# 6. 외부 health (도메인 경유)
# ═══════════════════════════════════════════
outc "${CYAN}[6] 외부 health (도메인)${NC}"

EXT_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$DOMAIN/api/health" 2>/dev/null) || true
if [ "$EXT_CODE" = "200" ]; then
  result_pass "외부 health" "$EXT_CODE"
elif [ -z "$EXT_CODE" ] || [ "$EXT_CODE" = "000" ]; then
  result_fail "외부 health" "타임아웃"
else
  result_fail "외부 health" "HTTP $EXT_CODE"
fi
out ""

# ═══════════════════════════════════════════
# 7. 에러 로그 탐지
# ═══════════════════════════════════════════
outc "${CYAN}[7] 에러 로그 탐지${NC}"

ERROR_LOG=$(get_section "ERROR_LOG")
if [ "$ERROR_LOG" = "NONE" ] || [ -z "$ERROR_LOG" ]; then
  result_pass "에러 로그" "최근 100줄 내 에러 없음"
else
  ERROR_COUNT=$(echo "$ERROR_LOG" | wc -l | tr -d ' ')
  ERROR_COUNT=${ERROR_COUNT:-0}
  if [ "$ERROR_COUNT" -le 3 ]; then
    result_warn "에러 로그" "${ERROR_COUNT}건 발견"
  else
    result_fail "에러 로그" "${ERROR_COUNT}건 발견"
  fi
  # 에러 로그 별도 저장
  echo "$ERROR_LOG" > "$LOG_DIR/container_errors_${TIMESTAMP}.log"
  out "  에러 로그 저장: logs/container_errors_${TIMESTAMP}.log"
  out "  최근 에러:"
  echo "$ERROR_LOG" | head -5 | while IFS= read -r line; do
    out "    $line"
  done
fi
out ""

# ═══════════════════════════════════════════
# 8. 디스크/메모리
# ═══════════════════════════════════════════
outc "${CYAN}[8] 디스크/메모리${NC}"

DISK=$(get_section "DISK")
if echo "$DISK" | grep -q "ERROR"; then
  result_skip "디스크" "확인 실패"
else
  while read -r fs size used avail pct mount; do
    [ -z "$pct" ] && continue
    pct_num=${pct%\%}
    pct_num=${pct_num:-0}
    if [ "$pct_num" -ge 90 ]; then
      result_fail "디스크 $mount" "${pct} 사용 (${avail} 남음)"
    elif [ "$pct_num" -ge 80 ]; then
      result_warn "디스크 $mount" "${pct} 사용 (${avail} 남음)"
    else
      result_pass "디스크 $mount" "${pct} 사용 (${avail} 남음)"
    fi
  done <<< "$DISK"
fi

MEMORY=$(get_section "MEMORY")
if echo "$MEMORY" | grep -q "ERROR"; then
  result_skip "메모리" "확인 실패"
else
  MEM_LINE=$(echo "$MEMORY" | tail -1)
  MEM_TOTAL=$(echo "$MEM_LINE" | awk '{print $2}')
  MEM_USED=$(echo "$MEM_LINE" | awk '{print $3}')
  MEM_AVAIL=$(echo "$MEM_LINE" | awk '{print $NF}')
  if [ -n "$MEM_TOTAL" ] && [ "$MEM_TOTAL" -gt 0 ] 2>/dev/null; then
    MEM_PCT=$((MEM_USED * 100 / MEM_TOTAL))
    if [ "$MEM_PCT" -ge 90 ]; then
      result_fail "메모리" "${MEM_PCT}% (${MEM_AVAIL}MB 가용)"
    elif [ "$MEM_PCT" -ge 80 ]; then
      result_warn "메모리" "${MEM_PCT}% (${MEM_AVAIL}MB 가용)"
    else
      result_pass "메모리" "${MEM_PCT}% (${MEM_AVAIL}MB 가용)"
    fi
  else
    result_skip "메모리" "파싱 실패"
  fi
fi

# Docker stats
DOCKER_STATS=$(get_section "DOCKER_STATS")
if [ -n "$DOCKER_STATS" ] && ! echo "$DOCKER_STATS" | grep -q "ERROR"; then
  IFS='|' read -r d_cpu d_mem d_mempct <<< "$DOCKER_STATS"
  out "  컨테이너 리소스: CPU=${d_cpu:-?} MEM=${d_mem:-?} (${d_mempct:-?})"
fi
out ""

# ═══════════════════════════════════════════
# 종합
# ═══════════════════════════════════════════
outc "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
TOTAL=$((PASS + FAIL + WARN + NOT_TESTED))

if [ "$FAIL" -eq 0 ] && [ "$WARN" -eq 0 ] && [ "$NOT_TESTED" -eq 0 ]; then
  outc " 결과: ${GREEN}ALL PASS${NC} (${PASS}/${TOTAL}건)"
else
  outc " 결과: PASS=${GREEN}${PASS}${NC} FAIL=${RED}${FAIL}${NC} WARN=${YELLOW}${WARN}${NC} NOT_TESTED=${YELLOW}${NOT_TESTED}${NC}"
fi

if [ "$FAIL" -gt 0 ]; then
  out ""
  outc " ${RED}[FAIL 항목]${NC}"
  echo -e "$RESULTS" | grep "^FAIL" | while IFS='|' read -r s label detail; do
    outc "  - $label: $detail"
  done
fi

if [ "$WARN" -gt 0 ]; then
  out ""
  outc " ${YELLOW}[WARN 항목]${NC}"
  echo -e "$RESULTS" | grep "^WARN" | while IFS='|' read -r s label detail; do
    outc "  - $label: $detail"
  done
fi

out ""
out " 로그: $REPORT"

# 실패 시 마지막 상태 저장
if [ "$FAIL" -gt 0 ]; then
  echo -e "$RESULTS" | grep "^FAIL" > "$LOG_DIR/last_container_failure.log"
fi

# 상태 파일 저장
{
  echo "timestamp=$TIMESTAMP"
  echo "pass=$PASS"
  echo "fail=$FAIL"
  echo "warn=$WARN"
  echo "not_tested=$NOT_TESTED"
} > "$LOG_DIR/last_container_status.txt"

outc "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
