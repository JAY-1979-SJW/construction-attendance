#!/usr/bin/env bash
# ══════════════════════════════════════════════════════
# ops-check.sh — 운영 자동점검 기준선 (읽기 전용)
# schema_version: 3
#
# 점검 항목:
#   [1]  SSH/실행 모드
#   [2]  docker compose ps
#   [3]  컨테이너 상세 (healthy/restart)
#   [4]  앱 포트 응답 (localhost:3002/api/health)
#   [5]  외부 health (도메인 경유)
#   [6]  최근 15분 에러로그
#   [7]  DB 포트 연결 (nc)
#   [8]  DB SELECT 1 (앱 컨테이너 내 실제 쿼리)
#   [9]  nginx 상태
#  [10]  디스크 사용량 (/ + NAS)
#  [11]  메모리
#  [12]  CPU load average
#  [13]  NAS write/read/delete 테스트
#  [14]  health 응답 latency 평균 (5회)
#  [15]  Admin API audit/FK 패턴 정적 검사 (로컬)
#
# 사용법:
#   bash scripts/ops-check.sh                # 기본 점검
#   bash scripts/ops-check.sh --logs         # FAIL 로그 50줄 확장 출력
#   bash scripts/ops-check.sh --json         # logs/날짜/ops_check_*.json 생성
#   bash scripts/ops-check.sh --notify-warn  # WARN도 텔레그램 전송
#
# 규칙:
#   - --fix 없음. 재시작/삭제/롤백 자동 수행 금지.
#   - FAIL 시 로그 자동 첨부 (승인 전 조치 금지).
# ══════════════════════════════════════════════════════
set -uo pipefail

# ══════════════════════════════════════════════════════
# 옵션 파싱
# ══════════════════════════════════════════════════════
OPT_LOGS=false
OPT_JSON=false
OPT_NOTIFY_WARN=false
OPS_TRIGGER="${OPS_TRIGGER:-manual}"   # manual | cron | deploy (환경변수로 주입 가능)

for arg in "$@"; do
  case "$arg" in
    --logs)        OPT_LOGS=true ;;
    --json)        OPT_JSON=true ;;
    --notify-warn) OPT_NOTIFY_WARN=true ;;
    --fix)
      echo "[ERROR] --fix 옵션은 지원하지 않습니다. 자동 조치 금지 원칙 유지."
      exit 2
      ;;
  esac
done

# ══════════════════════════════════════════════════════
# 설정 상수
# ══════════════════════════════════════════════════════
SSH_KEY="${SSH_KEY:-$HOME/.ssh/haehan-ai.pem}"
SSH_HOST="ubuntu@1.201.176.236"
APP_CONTAINER="attendance"
APP_DIR_REMOTE="$HOME/app/attendance"
DOMAIN="https://attendance.haehan-ai.kr"
DB_HOST="192.168.120.18"
DB_PORT="5432"
NAS_PATH="/mnt/nas/attendance/uploads"
SCHEMA_VERSION="3"

# ── 로그 경로: logs/YYYY-MM-DD/ ──
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_LOG_DIR="$SCRIPT_DIR/../logs"
DATE_DIR="$(date +%Y-%m-%d)"
LOG_DIR="$BASE_LOG_DIR/$DATE_DIR"
mkdir -p "$LOG_DIR"

TIMESTAMP=$(date +%H%M%S)
DATETIME_ISO=$(date '+%Y-%m-%dT%H:%M:%S')
REPORT="$LOG_DIR/ops_check_${TIMESTAMP}.log"

# ══════════════════════════════════════════════════════
# 색상
# ══════════════════════════════════════════════════════
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ══════════════════════════════════════════════════════
# 집계 / 결과 배열
# ══════════════════════════════════════════════════════
PASS=0; FAIL=0; WARN=0
declare -a FAIL_ITEMS=()
declare -a WARN_ITEMS=()
declare -a CHECK_RECORDS=()   # JSON checks[] 용

# ══════════════════════════════════════════════════════
# 출력 함수
# ══════════════════════════════════════════════════════
out()  { echo "$1"    | tee -a "$REPORT"; }
outc() { echo -e "$1" | tee -a "$REPORT"; }

_esc_json() {
  local s="${1:-}"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/ }"
  echo "$s"
}

result_pass() {
  local id="$1" name="$2" label="$3" detail="${4:-}"
  PASS=$((PASS+1))
  outc "  ${GREEN}[PASS]${NC} $label${detail:+ — $detail}"
  CHECK_RECORDS+=("{\"id\":$id,\"name\":\"$(_esc_json "$name")\",\"label\":\"$(_esc_json "$label")\",\"status\":\"PASS\",\"detail\":\"$(_esc_json "$detail")\"}")
}

result_warn() {
  local id="$1" name="$2" label="$3" detail="${4:-}"
  WARN=$((WARN+1))
  WARN_ITEMS+=("$label: $detail")
  outc "  ${YELLOW}[WARN]${NC} $label${detail:+ — $detail}"
  CHECK_RECORDS+=("{\"id\":$id,\"name\":\"$(_esc_json "$name")\",\"label\":\"$(_esc_json "$label")\",\"status\":\"WARN\",\"detail\":\"$(_esc_json "$detail")\"}")
}

result_fail() {
  local id="$1" name="$2" label="$3" detail="${4:-}"
  FAIL=$((FAIL+1))
  FAIL_ITEMS+=("$label: $detail")
  outc "  ${RED}[FAIL]${NC} $label${detail:+ — $detail}"
  CHECK_RECORDS+=("{\"id\":$id,\"name\":\"$(_esc_json "$name")\",\"label\":\"$(_esc_json "$label")\",\"status\":\"FAIL\",\"detail\":\"$(_esc_json "$detail")\"}")
}

result_skip() {
  local id="$1" name="$2" label="$3" detail="${4:-}"
  outc "  ${YELLOW}[SKIP]${NC} $label${detail:+ — $detail}"
  CHECK_RECORDS+=("{\"id\":$id,\"name\":\"$(_esc_json "$name")\",\"label\":\"$(_esc_json "$label")\",\"status\":\"SKIP\",\"detail\":\"$(_esc_json "$detail")\"}")
}

# ══════════════════════════════════════════════════════
# 헤더
# ══════════════════════════════════════════════════════
outc "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
outc "${BOLD} 운영 자동점검 (ops-check v${SCHEMA_VERSION})${NC}"
out  " 시각: $(date '+%Y-%m-%d %H:%M:%S')  트리거: $OPS_TRIGGER"
out  " 대상: $SSH_HOST"
outc "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
out  ""

# ══════════════════════════════════════════════════════
# [1] 실행 모드 결정 (서버 로컬 / SSH 원격)
# ══════════════════════════════════════════════════════
outc "${CYAN}[1] 실행 모드${NC}"
LOCAL_MODE=false
DOCKER_CHECKS_AVAILABLE=false
RUNNING_ON_SERVER=false

# SSH 키 폴백 (WSL/Windows 마운트 경로)
if [ ! -f "$SSH_KEY" ]; then
  WIN_PEM="/mnt/c/Users/skyjw/OneDrive/03. PYTHON/haehan-ai/haehan-ai.pem"
  [ -f "$WIN_PEM" ] && SSH_KEY="$WIN_PEM"
fi

# 서버 로컬 여부: docker ps로 attendance 컨테이너 직접 확인
if docker ps --quiet --filter "name=^${APP_CONTAINER}$" 2>/dev/null | grep -q .; then
  RUNNING_ON_SERVER=true
  LOCAL_MODE=true
  DOCKER_CHECKS_AVAILABLE=true
  out "  [INFO] 서버 로컬 실행 모드 — docker 직접 점검"
elif [ -f "$SSH_KEY" ]; then
  SSH_TEST=$(ssh -i "$SSH_KEY" "$SSH_HOST" \
    -o ConnectTimeout=10 -o BatchMode=yes -o StrictHostKeyChecking=no \
    "echo OK" 2>&1) || SSH_TEST="FAILED"
  if [ "$SSH_TEST" = "OK" ]; then
    result_pass 1 "ssh" "SSH 접속" "$SSH_HOST"
    DOCKER_CHECKS_AVAILABLE=true
  else
    result_fail 1 "ssh" "SSH 접속" "$SSH_TEST — docker 점검 불가"
  fi
else
  result_warn 1 "ssh" "SSH 키" "파일 없음 — 외부 health 점검만 수행"
  LOCAL_MODE=true
fi
out ""

# ══════════════════════════════════════════════════════
# 원격 수집 스크립트 (SSH 1회 / 로컬 1회로 전체 수집)
# ══════════════════════════════════════════════════════
REMOTE_SCRIPT=$(cat <<'REMOTE_EOF'
set -uo pipefail
APP_CONTAINER="attendance"
APP_DIR="$HOME/app/attendance"
DB_HOST="192.168.120.18"
DB_PORT="5432"
NAS_PATH="/mnt/nas/attendance/uploads"

# ── [2] compose ps ──
echo "===SECTION:COMPOSE_PS==="
cd "$APP_DIR" 2>/dev/null \
  && docker compose ps --format '{{.Name}}|{{.State}}|{{.Status}}' 2>/dev/null \
  || echo "ERROR:compose_ps_failed"

# ── [3] container inspect ──
echo "===SECTION:CONTAINER_INSPECT==="
docker inspect "$APP_CONTAINER" \
  --format '{{.State.Status}}|{{.State.Health.Status}}|{{.RestartCount}}|{{.State.StartedAt}}' \
  2>/dev/null || echo "ERROR:inspect_failed"

# ── [4] 포트 응답 ──
echo "===SECTION:PORT_CHECK==="
docker exec "$APP_CONTAINER" node -e "
const http = require('http'), t = Date.now();
http.get('http://localhost:3002/api/health', r => {
  r.resume();
  console.log(r.statusCode + '|' + ((Date.now()-t)/1000).toFixed(3));
  process.exit(0);
}).on('error', () => { console.log('000|0'); process.exit(1); });
" 2>/dev/null || echo "000|timeout"

# ── [6] 15분 에러로그 ──
# allow-list: 실제 장애 신호만 탐지
# deny-list:  정상 JSON 요약 로그 제외 ("errors": 0 / errors: 0 / 정상 cron 결과 로그)
echo "===SECTION:ERROR_LOG_15M==="
ERR_OUT=$(docker logs "$APP_CONTAINER" --since 15m 2>&1 \
  | grep -iE 'uncaughtException|unhandledRejection|TypeError|ReferenceError|SyntaxError|RangeError|PrismaClientKnownRequestError|PrismaClientUnknownRequestError|PrismaClientInitializationError|P[0-9]{4}:|exception|traceback|segfault|oom |killed|fatal|panic|ECONNREFUSED|ENOTFOUND' \
  | grep -vE '"errors"\s*:\s*[0-9]+|errors:\s*[0-9]+|\berrors\b.*done|\[cron/' \
  | tail -50 2>/dev/null) || ERR_OUT=""
[ -z "$ERR_OUT" ] && echo "NONE" || echo "$ERR_OUT"

# ── 전체 로그 테일 (FAIL 첨부용) ──
echo "===SECTION:FULL_LOG_TAIL==="
docker logs "$APP_CONTAINER" --tail 50 2>&1 || echo "ERROR:log_failed"

# ── [7] DB 포트 nc ──
echo "===SECTION:DB_PORT==="
nc -zw3 "$DB_HOST" "$DB_PORT" 2>/dev/null \
  && echo "OK:${DB_HOST}:${DB_PORT}" \
  || echo "FAIL:${DB_HOST}:${DB_PORT}"

# ── [8] DB SELECT 1 (Prisma PrismaClient 사용) ──
echo "===SECTION:DB_QUERY==="
docker exec "$APP_CONTAINER" node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({ log: [] });
const t = Date.now();
p.\$queryRawUnsafe('SELECT 1')
  .then(function() { console.log('OK|' + (Date.now()-t) + 'ms'); return p.\$disconnect(); })
  .then(function() { process.exit(0); })
  .catch(function(e) {
    const msg = String(e && e.message || e).split('\n')[0].slice(0, 80);
    console.log('FAIL:' + msg);
    p.\$disconnect().catch(function(){});
    process.exit(1);
  });
" 2>/dev/null || echo "FAIL:exec_error"

# ── [9] nginx ──
echo "===SECTION:NGINX==="
NGINX_CNT=$(docker ps --filter name=nginx --format '{{.Names}}|{{.Status}}' 2>/dev/null | head -1)
if [ -n "$NGINX_CNT" ]; then
  echo "container|$NGINX_CNT"
elif pgrep nginx > /dev/null 2>&1; then
  echo "process|running"
else
  echo "none|not_found"
fi

# ── [10] 디스크 ──
echo "===SECTION:DISK==="
df -h / 2>/dev/null | tail -1 || echo "ERROR:disk_root_failed"
df -h "$NAS_PATH" 2>/dev/null | tail -1 || echo "SKIP:nas_not_mounted"

# ── [11] 메모리 ──
echo "===SECTION:MEMORY==="
free -m 2>/dev/null | grep '^Mem:' || echo "ERROR:memory_failed"

# ── [12] CPU load ──
echo "===SECTION:CPU_LOAD==="
uptime 2>/dev/null || echo "ERROR:uptime_failed"

# ── [12b] docker stats ──
echo "===SECTION:DOCKER_STATS==="
docker stats "$APP_CONTAINER" --no-stream \
  --format '{{.CPUPerc}}|{{.MemUsage}}|{{.MemPerc}}' 2>/dev/null \
  || echo "ERROR:stats_failed"

# ── [13] NAS write/read/delete ──
echo "===SECTION:NAS_WRITE==="
if [ -d "$NAS_PATH" ]; then
  PROBE="$NAS_PATH/.ops_probe_$$"
  if echo "ops-check-probe" > "$PROBE" 2>/dev/null; then
    READ_VAL=$(cat "$PROBE" 2>/dev/null || echo "")
    rm -f "$PROBE" 2>/dev/null
    if [ "$READ_VAL" = "ops-check-probe" ]; then
      echo "OK:write+read+delete"
    else
      echo "FAIL:read_mismatch"
    fi
  else
    echo "FAIL:write_error"
  fi
else
  echo "SKIP:nas_dir_missing ($NAS_PATH)"
fi

# ── [14] latency 평균 (5회 순차) ──
echo "===SECTION:LATENCY==="
docker exec "$APP_CONTAINER" node -e "
const http = require('http');
const N = 5, times = [];
function req(i) {
  if (i >= N) {
    const avg = Math.round(times.reduce((a,b)=>a+b,0)/N);
    const mn = Math.min(...times), mx = Math.max(...times);
    console.log('avg=' + avg + '|min=' + mn + '|max=' + mx + '|n=' + N);
    return;
  }
  const t = Date.now();
  const r = http.get('http://localhost:3002/api/health', res => {
    res.resume();
    times.push(Date.now() - t);
    req(i + 1);
  });
  r.setTimeout(5000, function() { this.destroy(); times.push(5000); req(i+1); });
  r.on('error', () => { times.push(5000); req(i+1); });
}
req(0);
" 2>/dev/null || echo "FAIL:latency_error"

echo "===SECTION:END==="
REMOTE_EOF
)

# ── 실행 ──
REMOTE_DATA=""
if [ "$RUNNING_ON_SERVER" = true ]; then
  REMOTE_DATA=$(bash <<< "$REMOTE_SCRIPT" 2>&1) || true
elif [ "$DOCKER_CHECKS_AVAILABLE" = true ]; then
  REMOTE_DATA=$(ssh -i "$SSH_KEY" "$SSH_HOST" \
    -o ConnectTimeout=15 -o BatchMode=yes -o StrictHostKeyChecking=no \
    bash -s <<< "$REMOTE_SCRIPT" 2>&1) || REMOTE_DATA="ERROR:ssh_exec_failed"
fi

get_section() {
  echo "$REMOTE_DATA" | sed -n "/===SECTION:$1===/,/===SECTION:/p" | sed '1d;$d'
}

# ══════════════════════════════════════════════════════
# [2] docker compose ps
# ══════════════════════════════════════════════════════
if [ "$DOCKER_CHECKS_AVAILABLE" = true ]; then
  outc "${CYAN}[2] docker compose ps${NC}"
  COMPOSE_PS=$(get_section "COMPOSE_PS")
  if echo "$COMPOSE_PS" | grep -q "^ERROR"; then
    result_fail 2 "compose_ps" "compose ps" "명령 실패"
  else
    while IFS='|' read -r name state status; do
      [ -z "$name" ] && continue
      case "$state" in
        running)    result_pass 2 "compose_ps" "$name" "$state ($status)" ;;
        exited)     result_fail 2 "compose_ps" "$name" "exited ($status)" ;;
        restarting) result_fail 2 "compose_ps" "$name" "restarting ($status)" ;;
        *)          result_warn 2 "compose_ps" "$name" "$state ($status)" ;;
      esac
    done <<< "$COMPOSE_PS"
  fi
  out ""

  # ══════════════════════════════════════════════════════
  # [3] 컨테이너 상세
  # ══════════════════════════════════════════════════════
  outc "${CYAN}[3] 컨테이너 상세${NC}"
  INSPECT=$(get_section "CONTAINER_INSPECT")
  if echo "$INSPECT" | grep -q "^ERROR"; then
    result_warn 3 "container_inspect" "컨테이너 상세" "inspect 실패"
  else
    IFS='|' read -r _c_status c_health c_restart c_started <<< "$INSPECT"
    case "${c_health:-}" in
      healthy)  result_pass 3 "container_health" "health 상태" "healthy" ;;
      starting) result_warn 3 "container_health" "health 상태" "starting (초기화 중)" ;;
      "")       result_warn 3 "container_health" "health 상태" "healthcheck 미설정" ;;
      *)        result_fail 3 "container_health" "health 상태" "${c_health}" ;;
    esac
    c_restart=${c_restart:-0}
    if   [ "$c_restart" -eq 0 ]; then result_pass 3 "restart_count" "restart count" "0회"
    elif [ "$c_restart" -le 3 ]; then result_warn 3 "restart_count" "restart count" "${c_restart}회 (재기동 이력)"
    else                               result_fail 3 "restart_count" "restart count" "${c_restart}회 — 반복 재시작 의심"
    fi
    out "  기동 시각: ${c_started:-unknown}"
  fi
  out ""

  # ══════════════════════════════════════════════════════
  # [4] 앱 포트 응답
  # ══════════════════════════════════════════════════════
  outc "${CYAN}[4] 앱 포트 응답 (localhost:3002/api/health)${NC}"
  PORT_RAW=$(get_section "PORT_CHECK")
  IFS='|' read -r p_code p_time <<< "${PORT_RAW:-000|0}"
  p_code=${p_code:-000}
  if [ "$p_code" = "200" ]; then
    p_int=${p_time%%.*}
    if [ "${p_int:-0}" -ge 3 ]; then
      result_warn 4 "port_check" "포트 응답" "200 (${p_time}s — slow)"
    else
      result_pass 4 "port_check" "포트 응답" "200 (${p_time}s)"
    fi
  elif [ "$p_code" = "000" ]; then
    result_fail 4 "port_check" "포트 응답" "타임아웃/연결불가"
  else
    result_fail 4 "port_check" "포트 응답" "HTTP $p_code"
  fi
  out ""
fi

# ══════════════════════════════════════════════════════
# [5] 외부 health (도메인 경유) — 항상 실행
# ══════════════════════════════════════════════════════
outc "${CYAN}[5] 외부 health (도메인)${NC}"
EXT_RESP=$(curl -s -w "\n%{http_code}" --max-time 10 "$DOMAIN/api/health" 2>/dev/null) || EXT_RESP=""
EXT_CODE=$(echo "$EXT_RESP" | tail -1)
EXT_BODY=$(echo "$EXT_RESP" | head -1 | head -c 80)
if   [ "$EXT_CODE" = "200" ]; then result_pass 5 "ext_health" "외부 health" "200 — $EXT_BODY"
elif [ -z "$EXT_CODE" ] || [ "$EXT_CODE" = "000" ]; then result_fail 5 "ext_health" "외부 health" "타임아웃"
else result_fail 5 "ext_health" "외부 health" "HTTP $EXT_CODE"
fi
out ""

if [ "$DOCKER_CHECKS_AVAILABLE" = true ]; then
  # ══════════════════════════════════════════════════════
  # [6] 최근 15분 에러로그
  # ══════════════════════════════════════════════════════
  outc "${CYAN}[6] 최근 15분 에러로그${NC}"
  ERROR_LOG=$(get_section "ERROR_LOG_15M")
  if [ -z "$ERROR_LOG" ] || [ "$ERROR_LOG" = "NONE" ]; then
    result_pass 6 "error_log_15m" "15분 에러로그" "에러 없음"
  else
    ERR_COUNT=$(echo "$ERROR_LOG" | grep -c . 2>/dev/null || echo 0)
    ERR_LOG_FILE="$LOG_DIR/errors_15m_${TIMESTAMP}.log"
    echo "$ERROR_LOG" > "$ERR_LOG_FILE"
    if   [ "${ERR_COUNT:-0}" -le 3 ];  then result_warn 6 "error_log_15m" "15분 에러로그" "${ERR_COUNT}건"
    elif [ "${ERR_COUNT:-0}" -le 10 ]; then result_warn 6 "error_log_15m" "15분 에러로그" "${ERR_COUNT}건 — 증가 추이 확인"
    else                                    result_fail 6 "error_log_15m" "15분 에러로그" "${ERR_COUNT}건 — 다수 에러"
    fi
    out "  에러 파일: $ERR_LOG_FILE"
    out "  최근 3줄:"
    echo "$ERROR_LOG" | tail -3 | while IFS= read -r l; do out "    $l"; done
  fi
  out ""

  # ══════════════════════════════════════════════════════
  # [7] DB 포트 연결
  # ══════════════════════════════════════════════════════
  outc "${CYAN}[7] DB 포트 (${DB_HOST}:${DB_PORT})${NC}"
  DB_PORT_RESULT=$(get_section "DB_PORT")
  if echo "$DB_PORT_RESULT" | grep -q "^OK:"; then
    result_pass 7 "db_port" "DB 포트" "${DB_HOST}:${DB_PORT} 응답"
  else
    result_fail 7 "db_port" "DB 포트" "${DB_HOST}:${DB_PORT} 연결 실패"
  fi
  out ""

  # ══════════════════════════════════════════════════════
  # [8] DB SELECT 1
  # ══════════════════════════════════════════════════════
  outc "${CYAN}[8] DB SELECT 1${NC}"
  DB_QUERY_RESULT=$(get_section "DB_QUERY")
  if echo "$DB_QUERY_RESULT" | grep -q "^OK|"; then
    DB_QUERY_TIME=$(echo "$DB_QUERY_RESULT" | grep -oP '\|\K[0-9]+ms')
    result_pass 8 "db_query" "DB SELECT 1" "쿼리 성공 (${DB_QUERY_TIME:-?})"
  elif echo "$DB_QUERY_RESULT" | grep -q "^FAIL:DATABASE_URL_not_set"; then
    result_warn 8 "db_query" "DB SELECT 1" "DATABASE_URL 미설정 — 컨테이너 env 확인"
  else
    FAIL_MSG=$(echo "$DB_QUERY_RESULT" | head -c 80)
    result_fail 8 "db_query" "DB SELECT 1" "$FAIL_MSG"
  fi
  out ""

  # ══════════════════════════════════════════════════════
  # [9] nginx
  # ══════════════════════════════════════════════════════
  outc "${CYAN}[9] nginx / 리버스프록시${NC}"
  NGINX_LINE=$(get_section "NGINX")
  NGINX_TYPE=$(echo "$NGINX_LINE" | cut -d'|' -f1)
  NGINX_INFO=$(echo "$NGINX_LINE" | cut -d'|' -f2-)
  case "$NGINX_TYPE" in
    container)
      if echo "$NGINX_INFO" | grep -qi "up"; then
        result_pass 9 "nginx" "nginx 컨테이너" "$NGINX_INFO"
      else
        result_fail 9 "nginx" "nginx 컨테이너" "$NGINX_INFO"
      fi
      ;;
    process) result_pass 9 "nginx" "nginx 프로세스" "running" ;;
    none)    result_warn 9 "nginx" "nginx" "컨테이너/프로세스 없음" ;;
    *)       result_warn 9 "nginx" "nginx" "상태 확인 불가" ;;
  esac
  out ""

  # ══════════════════════════════════════════════════════
  # [10] 디스크
  # ══════════════════════════════════════════════════════
  outc "${CYAN}[10] 디스크${NC}"
  DISK_RAW=$(get_section "DISK")
  while IFS= read -r disk_line; do
    [ -z "$disk_line" ] && continue
    if echo "$disk_line" | grep -q "^ERROR"; then
      result_warn 10 "disk" "디스크" "확인 실패: $disk_line"
      continue
    fi
    if echo "$disk_line" | grep -q "^SKIP:"; then
      result_skip 10 "disk_nas" "디스크 NAS" "마운트 없음"
      continue
    fi
    # df -h: Filesystem Size Used Avail Use% Mountpoint
    read -r _fs _size _used _avail pct mount <<< "$disk_line"
    [ -z "${pct:-}" ] && continue
    pct_num=${pct%\%}
    # 판정 기준: PASS 0~84% / WARN 85~94% / FAIL 95%+
    if   [[ "$pct_num" =~ ^[0-9]+$ ]] && [ "$pct_num" -ge 95 ]; then
      result_fail 10 "disk_${mount//\//_}" "disk $mount" "disk=${pct} → FAIL (${_avail} 남음)"
    elif [[ "$pct_num" =~ ^[0-9]+$ ]] && [ "$pct_num" -ge 85 ]; then
      result_warn 10 "disk_${mount//\//_}" "disk $mount" "disk=${pct} → WARN (${_avail} 남음)"
    else
      result_pass 10 "disk_${mount//\//_}" "disk $mount" "disk=${pct} → PASS (${_avail} 남음)"
    fi
  done <<< "$DISK_RAW"
  out ""

  # ══════════════════════════════════════════════════════
  # [11] 메모리
  # ══════════════════════════════════════════════════════
  outc "${CYAN}[11] 메모리${NC}"
  MEM_LINE=$(get_section "MEMORY")
  if echo "$MEM_LINE" | grep -q "^ERROR"; then
    result_warn 11 "memory" "메모리" "확인 실패"
  else
    # free -m: Mem: total used free shared buff/cache available
    read -r _lbl total used _free _shared _buff avail <<< "$MEM_LINE"
    if [[ "${total:-}" =~ ^[0-9]+$ ]] && [ "$total" -gt 0 ]; then
      used_pct=$((used * 100 / total))
      if   [ "$used_pct" -ge 90 ]; then result_fail 11 "memory" "메모리" "${used_pct}% 사용 (${avail}MB 가용)"
      elif [ "$used_pct" -ge 80 ]; then result_warn 11 "memory" "메모리" "${used_pct}% 사용 (${avail}MB 가용)"
      else                               result_pass 11 "memory" "메모리" "${used_pct}% 사용 (${avail}MB 가용)"
      fi
    else
      result_warn 11 "memory" "메모리" "파싱 실패"
    fi
  fi
  out ""

  # ══════════════════════════════════════════════════════
  # [12] CPU load
  # ══════════════════════════════════════════════════════
  outc "${CYAN}[12] CPU load average${NC}"
  UPTIME_LINE=$(get_section "CPU_LOAD")
  if echo "$UPTIME_LINE" | grep -q "^ERROR"; then
    result_warn 12 "cpu_load" "CPU load" "확인 실패"
  else
    LOAD1=$(echo  "$UPTIME_LINE" | grep -oP 'load average: \K[0-9.]+' || echo "0")
    LOAD5=$(echo  "$UPTIME_LINE" | grep -oP 'load average: [0-9.]+, \K[0-9.]+' || echo "0")
    LOAD15=$(echo "$UPTIME_LINE" | grep -oP 'load average: [0-9.]+, [0-9.]+, \K[0-9.]+' || echo "0")
    LOAD1_INT=${LOAD1%%.*}
    if   [ "${LOAD1_INT:-0}" -ge 8 ]; then result_fail 12 "cpu_load" "CPU load" "1m=${LOAD1} 5m=${LOAD5} 15m=${LOAD15}"
    elif [ "${LOAD1_INT:-0}" -ge 4 ]; then result_warn 12 "cpu_load" "CPU load" "1m=${LOAD1} 5m=${LOAD5} 15m=${LOAD15}"
    else                                    result_pass 12 "cpu_load" "CPU load" "1m=${LOAD1} 5m=${LOAD5} 15m=${LOAD15}"
    fi
  fi
  # docker stats 보조
  STATS=$(get_section "DOCKER_STATS")
  if [ -n "$STATS" ] && ! echo "$STATS" | grep -q "^ERROR"; then
    IFS='|' read -r d_cpu d_mem d_mempct <<< "$STATS"
    out "  컨테이너 리소스: CPU=${d_cpu:-?}  MEM=${d_mem:-?} (${d_mempct:-?})"
  fi
  out ""

  # ══════════════════════════════════════════════════════
  # [13] NAS write/read/delete
  # ══════════════════════════════════════════════════════
  outc "${CYAN}[13] NAS write test${NC}"
  NAS_RESULT=$(get_section "NAS_WRITE")
  if echo "$NAS_RESULT" | grep -q "^OK:"; then
    result_pass 13 "nas_write" "NAS write/read/delete" "정상 ($NAS_PATH)"
  elif echo "$NAS_RESULT" | grep -q "^SKIP:"; then
    result_skip 13 "nas_write" "NAS write test" "${NAS_RESULT#SKIP:}"
  else
    result_fail 13 "nas_write" "NAS write test" "${NAS_RESULT:-write 실패}"
  fi
  out ""

  # ══════════════════════════════════════════════════════
  # [14] latency 평균
  # ══════════════════════════════════════════════════════
  outc "${CYAN}[14] health latency 평균 (5회)${NC}"
  LATENCY_RAW=$(get_section "LATENCY")
  if echo "$LATENCY_RAW" | grep -q "^FAIL"; then
    result_warn 14 "latency" "latency 평균" "측정 실패"
  else
    LAT_AVG=$(echo "$LATENCY_RAW" | grep -oP 'avg=\K[0-9]+' || echo "0")
    LAT_MIN=$(echo "$LATENCY_RAW" | grep -oP 'min=\K[0-9]+' || echo "?")
    LAT_MAX=$(echo "$LATENCY_RAW" | grep -oP 'max=\K[0-9]+' || echo "?")
    if   [ "${LAT_AVG:-0}" -ge 3000 ]; then result_fail 14 "latency" "latency 평균" "${LAT_AVG}ms (min=${LAT_MIN} max=${LAT_MAX})"
    elif [ "${LAT_AVG:-0}" -ge 1500 ]; then result_warn 14 "latency" "latency 평균" "${LAT_AVG}ms (min=${LAT_MIN} max=${LAT_MAX})"
    else                                     result_pass 14 "latency" "latency 평균" "${LAT_AVG}ms (min=${LAT_MIN} max=${LAT_MAX})"
    fi
  fi
  out ""
fi

# ══════════════════════════════════════════════════════
# [15] Admin API audit/FK 패턴 정적 검사 (로컬 전용)
# ══════════════════════════════════════════════════════
outc "${CYAN}[15] audit-fk-check (정적 분석)${NC}"
AUDIT_FK_SCRIPT="$SCRIPT_DIR/check-audit-fk.sh"
if [ ! -f "$AUDIT_FK_SCRIPT" ]; then
  result_skip 15 "audit_fk" "audit-fk-check" "스크립트 없음 ($AUDIT_FK_SCRIPT)"
else
  AUDIT_FK_OUT=$(bash "$AUDIT_FK_SCRIPT" 2>&1) || true
  AUDIT_FK_EXIT=$?
  AUDIT_FK_FAIL=$(echo "$AUDIT_FK_OUT" | grep -oP 'FAIL: \K[0-9]+' | tail -1 || echo "0")
  AUDIT_FK_WARN=$(echo "$AUDIT_FK_OUT" | grep -oP 'WARN: \K[0-9]+' | tail -1 || echo "0")
  AUDIT_FK_VERDICT=$(echo "$AUDIT_FK_OUT" | grep -oP '판정: \K\S+' | tail -1 || echo "UNKNOWN")

  if [ "$AUDIT_FK_EXIT" -ne 0 ] || [ "${AUDIT_FK_FAIL:-0}" -gt 0 ]; then
    result_fail 15 "audit_fk" "audit-fk-check" "FAIL ${AUDIT_FK_FAIL}건 — FK 선조회 위반 패턴"
    # FAIL 상세 출력
    echo "$AUDIT_FK_OUT" | grep -E '^\s+\[FAIL\]' | while IFS= read -r l; do out "  $l"; done
  elif [ "${AUDIT_FK_WARN:-0}" -gt 0 ]; then
    result_warn 15 "audit_fk" "audit-fk-check" "WARN ${AUDIT_FK_WARN}건 (${AUDIT_FK_VERDICT}) — 레거시 패턴"
  else
    result_pass 15 "audit_fk" "audit-fk-check" "PASS — FK 선조회 원칙 전체 준수"
  fi
fi
out ""

# ══════════════════════════════════════════════════════
# [16] bulk E2E 회귀 테스트 최근 실행 여부
# ══════════════════════════════════════════════════════
BULK_E2E_LOG="$SCRIPT_DIR/../logs/last-bulk-e2e.txt"
if [ ! -f "$BULK_E2E_LOG" ]; then
  result_warn 16 "bulk_e2e" "bulk-e2e-freshness" "WARN — logs/last-bulk-e2e.txt 없음 (미실행)"
else
  BULK_RUN_AT=$(grep '^run_at=' "$BULK_E2E_LOG" | cut -d= -f2-)
  BULK_STATUS=$(grep '^status=' "$BULK_E2E_LOG" | cut -d= -f2-)
  if [ -z "$BULK_RUN_AT" ]; then
    result_warn 16 "bulk_e2e" "bulk-e2e-freshness" "WARN — run_at 파싱 실패"
  else
    BULK_TS=$(date -d "$BULK_RUN_AT" +%s 2>/dev/null || echo 0)
    NOW_TS=$(date +%s)
    DIFF_DAYS=$(( (NOW_TS - BULK_TS) / 86400 ))
    if [ "$BULK_STATUS" = "FAIL" ]; then
      result_fail 16 "bulk_e2e" "bulk-e2e-freshness" "FAIL — 마지막 실행 결과 FAIL (${BULK_RUN_AT})"
    elif [ "$DIFF_DAYS" -gt 7 ]; then
      result_warn 16 "bulk_e2e" "bulk-e2e-freshness" "WARN — ${DIFF_DAYS}일 전 실행 (7일 초과, ${BULK_RUN_AT})"
    else
      result_pass 16 "bulk_e2e" "bulk-e2e-freshness" "PASS — ${DIFF_DAYS}일 전 실행 PASS (${BULK_RUN_AT})"
    fi
  fi
fi
out ""


# ══════════════════════════════════════════════════════
# [17] 디스크 자동 정리 최근 실행 결과
# ══════════════════════════════════════════════════════
outc "${CYAN}[17] 디스크 자동 정리 이력${NC}"
DISK_CLEAN_LOG="$SCRIPT_DIR/../logs/last-disk-check.txt"
if [ ! -f "$DISK_CLEAN_LOG" ]; then
  result_warn 17 "disk_clean" "disk-cleanup-freshness" "WARN — logs/last-disk-check.txt 없음 (미실행)"
else
  DC_RUN_AT=$(grep '^run_at=' "$DISK_CLEAN_LOG" | cut -d= -f2-)
  DC_USAGE_BEFORE=$(grep '^usage_before=' "$DISK_CLEAN_LOG" | cut -d= -f2-)
  DC_USAGE_AFTER=$(grep '^usage_after=' "$DISK_CLEAN_LOG" | cut -d= -f2-)
  DC_CLEANUP=$(grep '^cleanup_level=' "$DISK_CLEAN_LOG" | cut -d= -f2-)
  DC_FINAL=$(grep '^final=' "$DISK_CLEAN_LOG" | cut -d= -f2-)
  DC_NOTE="${DC_USAGE_AFTER} (정리=${DC_CLEANUP}, 직전=${DC_USAGE_BEFORE}) @ ${DC_RUN_AT}"
  if [ "$DC_FINAL" = "FAIL" ]; then
    result_fail 17 "disk_clean" "disk-cleanup-freshness" "FAIL — $DC_NOTE"
  elif [ "$DC_FINAL" = "WARN" ]; then
    result_warn 17 "disk_clean" "disk-cleanup-freshness" "WARN — $DC_NOTE"
  else
    result_pass 17 "disk_clean" "disk-cleanup-freshness" "PASS — $DC_NOTE"
  fi
fi
out ""

# ══════════════════════════════════════════════════════
# FAIL 시 로그 자동 첨부 (항상, --logs면 50줄 전체)
# ══════════════════════════════════════════════════════
if [ "$DOCKER_CHECKS_AVAILABLE" = true ] && [ "$FAIL" -gt 0 ]; then
  outc "${CYAN}[FAIL 로그]${NC}"
  FULL_LOG=$(get_section "FULL_LOG_TAIL")
  if [ -n "$FULL_LOG" ] && ! echo "$FULL_LOG" | grep -q "^ERROR:log_failed"; then
    LINES=20
    $OPT_LOGS && LINES=50
    out "  --- 컨테이너 로그 (최근 ${LINES}줄) ---"
    echo "$FULL_LOG" | tail -$LINES | while IFS= read -r l; do out "  $l"; done
    out "  ---"
  fi
  out ""
fi

# ══════════════════════════════════════════════════════
# 종합 결과
# ══════════════════════════════════════════════════════
TOTAL=$((PASS + FAIL + WARN))
outc "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if   [ "$FAIL" -eq 0 ] && [ "$WARN" -eq 0 ]; then
  SUMMARY_STATUS="ALL_PASS"
  outc " 종합: ${GREEN}${BOLD}ALL PASS${NC} (${PASS}/${TOTAL}건)"
elif [ "$FAIL" -gt 0 ]; then
  SUMMARY_STATUS="FAIL"
  outc " 종합: ${RED}${BOLD}FAIL${NC} — PASS:${GREEN}${PASS}${NC} FAIL:${RED}${FAIL}${NC} WARN:${YELLOW}${WARN}${NC} / ${TOTAL}건"
else
  SUMMARY_STATUS="WARN"
  outc " 종합: ${YELLOW}${BOLD}WARN${NC} — PASS:${GREEN}${PASS}${NC} WARN:${YELLOW}${WARN}${NC} / ${TOTAL}건"
fi

# FAIL 항목 + 원인 후보
if [ "${#FAIL_ITEMS[@]}" -gt 0 ]; then
  out ""
  outc " ${RED}FAIL 항목:${NC}"
  for item in "${FAIL_ITEMS[@]}"; do outc "  ${RED}✗${NC} $item"; done
  out ""
  outc " ${RED}원인 후보 (최대 2개):${NC}"
  CAUSE_N=0
  for item in "${FAIL_ITEMS[@]}"; do
    [ $CAUSE_N -ge 2 ] && break
    CAUSE=""
    case "$item" in
      *"포트 응답"*|*"외부 health"*)  CAUSE="앱 프로세스 다운 또는 nginx 라우팅 오류" ;;
      *"DB 포트"*)                    CAUSE="DB 서버(${DB_HOST}) 다운 또는 방화벽" ;;
      *"DB SELECT 1"*)                CAUSE="DB 접속 실패 — DATABASE_URL 또는 PostgreSQL 상태 확인" ;;
      *"restart count"*)              CAUSE="docker logs ${APP_CONTAINER} --tail 100 으로 재기동 원인 확인" ;;
      *"health 상태"*)                CAUSE="앱 헬스체크 실패 — /api/health 응답 내용 확인" ;;
      *"에러로그"*)                   CAUSE="logs/${DATE_DIR}/errors_15m_${TIMESTAMP}.log 참조" ;;
      *"디스크"*)                     CAUSE="df -h / docker system prune --volumes 로 공간 확보" ;;
      *"메모리"*)                     CAUSE="docker stats 로 메모리 누수 컨테이너 확인" ;;
      *"nginx"*)                      CAUSE="nginx 컨테이너 상태 확인 (docker ps / docker logs nginx)" ;;
      *"NAS write"*)                  CAUSE="NFS 마운트 상태 확인 (mount | grep nas)" ;;
      *"latency"*)                    CAUSE="앱 응답 지연 — CPU/메모리/DB 쿼리 슬로우 확인" ;;
    esac
    [ -n "$CAUSE" ] && out "  → $CAUSE" && CAUSE_N=$((CAUSE_N+1))
  done
fi

# WARN 항목
if [ "${#WARN_ITEMS[@]}" -gt 0 ]; then
  out ""
  outc " ${YELLOW}WARN 항목:${NC}"
  for item in "${WARN_ITEMS[@]}"; do outc "  ${YELLOW}△${NC} $item"; done
fi

out ""
# 디스크 정리 최근 결과 한 줄 요약
_DISK_LOG="$SCRIPT_DIR/../logs/last-disk-check.txt"
if [ -f "$_DISK_LOG" ]; then
  _DC_AFTER=$(grep '^usage_after='   "$_DISK_LOG" | cut -d= -f2-)
  _DC_BEFORE=$(grep '^usage_before=' "$_DISK_LOG" | cut -d= -f2-)
  _DC_LEVEL=$(grep '^cleanup_level=' "$_DISK_LOG" | cut -d= -f2-)
  _DC_AT=$(grep '^run_at='          "$_DISK_LOG" | cut -d= -f2-)
  _DC_FINAL=$(grep '^final='        "$_DISK_LOG" | cut -d= -f2-)
  if [ "$_DC_FINAL" = "FAIL" ]; then
    outc " 디스크 정리: ${RED}${_DC_AFTER}${NC} (직전 ${_DC_BEFORE}, 정리=${_DC_LEVEL}) @ ${_DC_AT}"
  elif [ "$_DC_FINAL" = "WARN" ]; then
    outc " 디스크 정리: ${YELLOW}${_DC_AFTER}${NC} (직전 ${_DC_BEFORE}, 정리=${_DC_LEVEL}) @ ${_DC_AT}"
  else
    outc " 디스크 정리: ${GREEN}${_DC_AFTER}${NC} (직전 ${_DC_BEFORE}, 정리=${_DC_LEVEL}) @ ${_DC_AT}"
  fi
else
  out " 디스크 정리: last-disk-check.txt 없음"
fi
out " 로그: $REPORT"
outc "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# ══════════════════════════════════════════════════════
# 상태 파일 저장
# ══════════════════════════════════════════════════════
{
  echo "timestamp=${DATE_DIR}_${TIMESTAMP}"
  echo "status=$SUMMARY_STATUS"
  echo "pass=$PASS"
  echo "fail=$FAIL"
  echo "warn=$WARN"
  echo "total=$TOTAL"
  echo "trigger=$OPS_TRIGGER"
  echo "log=$REPORT"
} > "$BASE_LOG_DIR/last_ops_check.txt"

if [ "$FAIL" -gt 0 ]; then
  printf '%s\n' "${FAIL_ITEMS[@]}" > "$BASE_LOG_DIR/last_ops_check_failures.log"
fi

# ══════════════════════════════════════════════════════
# JSON 저장 (--json) — schema_version 2 고정 포맷
# ══════════════════════════════════════════════════════
if $OPT_JSON; then
  JSON_OUT="$LOG_DIR/ops_check_${TIMESTAMP}.json"
  # checks 배열 조립
  CHECKS_JSON=$(printf '%s\n' "${CHECK_RECORDS[@]}" | paste -sd ',' - 2>/dev/null || true)
  [ -z "$CHECKS_JSON" ] && CHECKS_JSON=""

  FAIL_JSON=""
  [ "${#FAIL_ITEMS[@]}" -gt 0 ] && \
    FAIL_JSON=$(printf '%s\n' "${FAIL_ITEMS[@]}" | while IFS= read -r l; do [ -n "$l" ] && echo "\"$(_esc_json "$l")\""; done | paste -sd ',' - 2>/dev/null || true)
  WARN_JSON=""
  [ "${#WARN_ITEMS[@]}" -gt 0 ] && \
    WARN_JSON=$(printf '%s\n' "${WARN_ITEMS[@]}" | while IFS= read -r l; do [ -n "$l" ] && echo "\"$(_esc_json "$l")\""; done | paste -sd ',' - 2>/dev/null || true)

  cat > "$JSON_OUT" <<JSON
{
  "schema_version": $SCHEMA_VERSION,
  "timestamp": "${DATE_DIR}T${TIMESTAMP}",
  "datetime_iso": "${DATETIME_ISO}",
  "host": "$(_esc_json "$SSH_HOST")",
  "trigger": "$(_esc_json "$OPS_TRIGGER")",
  "summary": {
    "status": "$SUMMARY_STATUS",
    "pass": $PASS,
    "warn": $WARN,
    "fail": $FAIL,
    "total": $TOTAL
  },
  "checks": [${CHECKS_JSON}],
  "fail_items": [${FAIL_JSON:-}],
  "warn_items": [${WARN_JSON:-}],
  "log_path": "$(_esc_json "$REPORT")"
}
JSON
  out "JSON: $JSON_OUT"
fi

# ══════════════════════════════════════════════════════
# 텔레그램 알림
# FAIL → 항상 전송
# WARN → --notify-warn 시 전송
# ══════════════════════════════════════════════════════
TG_SECRETS="${TELEGRAM_SECRETS_FILE:-$HOME/.config/ops/telegram.secrets}"
if [ -f "$TG_SECRETS" ]; then
  set -a; source "$TG_SECRETS"; set +a
fi

TG_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TG_CHAT="${TELEGRAM_CHAT_ID:-}"

tg_send_msg() {
  local text="$1"
  [ -z "$TG_TOKEN" ] || [ -z "$TG_CHAT" ] && return 0
  curl -s -X POST "https://api.telegram.org/bot${TG_TOKEN}/sendMessage" \
    -d "chat_id=$TG_CHAT" \
    -d "parse_mode=HTML" \
    --data-urlencode "text=$text" > /dev/null 2>&1 || true
}

SHOULD_NOTIFY=false
NOTIFY_ICON=""
if [ "$FAIL" -gt 0 ]; then
  SHOULD_NOTIFY=true
  NOTIFY_ICON="❌"
elif [ "$WARN" -gt 0 ] && $OPT_NOTIFY_WARN; then
  SHOULD_NOTIFY=true
  NOTIFY_ICON="⚠️"
fi

if $SHOULD_NOTIFY && [ -n "$TG_TOKEN" ]; then
  FAIL_LINES=""
  if [ "${#FAIL_ITEMS[@]}" -gt 0 ]; then
    FAIL_LINES=$(printf '%s\n' "${FAIL_ITEMS[@]}" | head -5 | sed 's/^/❌ /')
  fi
  WARN_LINES=""
  if $OPT_NOTIFY_WARN && [ "${#WARN_ITEMS[@]}" -gt 0 ]; then
    WARN_LINES=$(printf '%s\n' "${WARN_ITEMS[@]}" | head -3 | sed 's/^/⚠️ /')
  fi

  TG_MSG="${NOTIFY_ICON} <b>ops-check ${SUMMARY_STATUS}</b>
━━━━━━━━━━━━━━
PASS:${PASS} FAIL:${FAIL} WARN:${WARN} / ${TOTAL}건
트리거: ${OPS_TRIGGER}
시각: $(date '+%Y-%m-%d %H:%M:%S')
${FAIL_LINES:+
$FAIL_LINES}${WARN_LINES:+
$WARN_LINES}"

  tg_send_msg "$TG_MSG"
  out " 텔레그램: 전송 완료 ($NOTIFY_ICON $SUMMARY_STATUS)"
elif $SHOULD_NOTIFY && [ -z "$TG_TOKEN" ]; then
  out " 텔레그램: 미설정 (TELEGRAM_BOT_TOKEN 없음)"
fi

# ══════════════════════════════════════════════════════
# 종료 코드
# ══════════════════════════════════════════════════════
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
