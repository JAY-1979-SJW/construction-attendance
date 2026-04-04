#!/usr/bin/env bash
# classify-server-apps.sh — 서버 앱 자동 분류 (완전분리/일부혼용/심각한혼용)
set -euo pipefail

OUT_DIR="/home/ubuntu/app/logs/audit"
mkdir -p "$OUT_DIR"
STAMP=$(date '+%Y%m%d_%H%M%S')
TXT="$OUT_DIR/classify_${STAMP}.txt"
JSON="$OUT_DIR/classify_${STAMP}.json"

log() { echo "$@" | tee -a "$TXT"; }
SEP="════════════════════════════════════════"

# ── 앱 정의: "앱명|기준경로|도메인|컨테이너prefix" ────────────────
APPS=(
  "attendance|/home/ubuntu/app/attendance|attendance.haehan-ai.kr|attendance"
  "g2b_bid|/home/ubuntu/app/g2b-fire-bid|api.haehan-ai.kr|backend,bid-app,g2b"
  "esc|/home/ubuntu/app/esc-app|esc.haehan-ai.kr|esc-"
  "gongmu|/home/ubuntu/app/haehan-platform|gongmu.haehan-ai.kr|gongmu-"
  "cad|/home/ubuntu/app/cad-quantity|cad.haehan-ai.kr|cad-"
  "nextcloud|/home/ubuntu/app/nextcloud|cloud.haehan-ai.kr|nextcloud-"
  "frontend|/home/ubuntu/app/frontend-main|haehan-ai.kr|frontend-"
)

# ── 자동 판정 함수 ─────────────────────────────────────────────────
classify_app() {
  local name="$1" base_path="$2" domain="$3" prefix="$4"
  local score=0
  local reasons=""
  local actions=""
  local sep=""

  add_reason() { reasons="${reasons}${sep}${1}"; sep="|"; }
  add_action() { actions="${actions}${sep}${1}"; sep="|"; }

  # [1] 경로 중복 검사
  local alt_count=0
  case "$name" in
    g2b_bid)
      [[ -d /home/ubuntu/app/repo ]] && { alt_count=$((alt_count+1)); add_reason "경로중복:/app/repo"; add_action "repo/ 경로 제거 또는 통합"; }
      [[ -d /home/ubuntu/app/g2b  ]] && { alt_count=$((alt_count+1)); add_reason "경로중복:/app/g2b";  } ;;
    esc)
      [[ -d /home/ubuntu/app/esc  ]] && { alt_count=$((alt_count+1)); add_reason "경로중복:/app/esc";  add_action "/app/esc compose/env 통합"; } ;;
    attendance)
      [[ -d /home/ubuntu/app/attendance-new ]] && { alt_count=$((alt_count+1)); add_reason "경로중복:attendance-new"; add_action "attendance-new 디렉토리 삭제"; } ;;
    frontend)
      [[ -d /home/ubuntu/app/frontend ]] && { alt_count=$((alt_count+1)); add_reason "경로중복:frontend/"; } ;;
  esac
  score=$((score + alt_count * 3))

  # [2] compose 수
  local compose_count
  compose_count=$(find "$base_path" -maxdepth 4 -name "docker-compose*.yml" 2>/dev/null | wc -l)
  if (( compose_count == 0 )); then
    score=$((score + 3)); add_reason "compose없음"; add_action "docker-compose.yml 생성"
  elif (( compose_count > 1 )); then
    score=$((score + 2)); add_reason "compose중복:${compose_count}개"; add_action "compose를 1개로 통합"
  fi

  # [3] .env 수
  local env_count
  env_count=$(find "$base_path" -maxdepth 2 -name ".env" 2>/dev/null | wc -l)
  if (( env_count == 0 )); then
    score=$((score + 2)); add_reason "env없음"; add_action ".env 파일 생성"
  elif (( env_count > 1 )); then
    score=$((score + 2)); add_reason "env중복:${env_count}개"; add_action ".env를 1개로 통합"
  fi

  # [4] deploy 스크립트 수
  local deploy_count
  deploy_count=$(find "$base_path" -maxdepth 4 -name "deploy*.sh" 2>/dev/null | wc -l)
  if (( deploy_count == 0 )); then
    score=$((score + 1)); add_reason "deploy없음"; add_action "deploy.sh 작성"
  elif (( deploy_count > 3 )); then
    score=$((score + 2)); add_reason "deploy분산:${deploy_count}개"; add_action "deploy 스크립트 1개로 정리"
  fi

  # [5] 루트 compose 의존
  if [[ -f /home/ubuntu/app/docker-compose.yml ]]; then
    local first_prefix="${prefix%%,*}"
    if grep -q "$first_prefix" /home/ubuntu/app/docker-compose.yml 2>/dev/null; then
      score=$((score + 3)); add_reason "루트compose의존"
      add_action "루트 docker-compose.yml에서 분리"
    fi
  fi

  # [6] 공용 네트워크 사용
  local first_prefix="${prefix%%,*}"
  local sample_container
  sample_container=$(docker ps --format "{{.Names}}" 2>/dev/null \
    | grep -E "^${first_prefix}" | head -1 || true)
  if [[ -n "$sample_container" ]]; then
    local nets
    nets=$(docker inspect "$sample_container" \
      --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' 2>/dev/null || true)
    if echo "$nets" | grep -qE "app_web|docker_default"; then
      score=$((score + 1)); add_reason "공용네트워크(app_web)"
      add_action "전용 네트워크 생성 후 app_web 분리"
    fi
  fi

  # [7] 루트 레벨 deploy 스크립트 참조
  if ls /home/ubuntu/app/scripts/deploy-"${name}"*.sh 2>/dev/null | grep -q .; then
    score=$((score + 1)); add_reason "루트scripts참조"
    add_action "루트 scripts/ 스크립트를 앱 내부로 이동"
  fi

  # [8] 이미지 태그 없음
  if [[ -n "$sample_container" ]]; then
    local img
    img=$(docker ps --format "{{.Names}} {{.Image}}" 2>/dev/null \
      | grep "^${sample_container} " | awk '{print $2}' || true)
    if echo "$img" | grep -qE "^[a-f0-9]{12}$"; then
      score=$((score + 2)); add_reason "이미지태그없음"
      add_action "이미지에 명시적 태그 부여"
    fi
  fi

  # [9] ops-bot 이중화 (attendance 한정)
  if [[ "$name" == "attendance" ]]; then
    if [[ -d /home/ubuntu/app/ops-bot ]] && [[ -d /home/ubuntu/app/attendance/ops-bot ]]; then
      score=$((score + 1)); add_reason "ops-bot이중화"
      add_action "ops-bot 하나로 통합"
    fi
  fi

  # ── 판정 ────────────────────────────────────────────────────────
  local verdict priority
  if   (( score >= 6 )); then verdict="심각한혼용"; priority=1
  elif (( score >= 2 )); then verdict="일부혼용";   priority=2
  else                        verdict="완전분리";   priority=3
  fi

  # ── health ───────────────────────────────────────────────────────
  local health_status
  health_status=$(curl -sk --max-time 3 "https://${domain}/api/health" 2>/dev/null \
    | grep -o '"status":"[^"]*"' | head -1 || echo '"status":"unknown"')

  echo "${name}__${verdict}__${score}__${reasons}__${actions}__${priority}__${health_status}"
}

# ── 메인 ──────────────────────────────────────────────────────────
log "$SEP"
log " 앱 자동 분류: $(date '+%Y-%m-%d %H:%M:%S')"
log "$SEP"
log ""

echo "[" > "$JSON"
first_json=true

printf "%-12s %-10s %5s  %-40s  %s\n" "앱명" "판정" "점수" "혼용사유" "우선순위" | tee -a "$TXT"
printf "%-12s %-10s %5s  %-40s  %s\n" "────────────" "──────────" "─────" "────────────────────────────────────────" "──────────" | tee -a "$TXT"

declare -A VERDICTS ACTIONS_MAP SCORES

for app_def in "${APPS[@]}"; do
  IFS='|' read -r aname apath adomain aprefix <<< "$app_def"
  raw=$(classify_app "$aname" "$apath" "$adomain" "$aprefix" 2>/dev/null || true)

  verdict=$(echo "$raw" | cut -d_ -f3)
  score=$(echo "$raw"   | cut -d_ -f5)
  reasons=$(echo "$raw" | cut -d_ -f7)
  actions=$(echo "$raw" | cut -d_ -f9)
  priority=$(echo "$raw"| cut -d_ -f11)
  health=$(echo "$raw"  | cut -d_ -f13)

  VERDICTS[$aname]="$verdict"
  ACTIONS_MAP[$aname]="$actions"
  SCORES[$aname]="$score"

  short_r=$(echo "$reasons" | tr '|' ',' | cut -c1-40)
  printf "%-12s %-10s %5s  %-40s  %s순위\n" \
    "$aname" "$verdict" "${score}점" "$short_r" "$priority" | tee -a "$TXT"

  # JSON
  [[ "$first_json" == false ]] && echo "," >> "$JSON"
  first_json=false
  reasons_json=$(echo "$reasons" | sed 's/"/\\"/g' | tr '|' ',')
  actions_json=$(echo "$actions" | sed 's/"/\\"/g' | tr '|' ',')
  cat >> "$JSON" <<JSONITEM
  {
    "app": "$aname",
    "path": "$apath",
    "domain": "$adomain",
    "verdict": "$verdict",
    "score": $score,
    "reasons": ["$(echo "$reasons" | sed 's/|/","/g')"],
    "top_actions": ["$(echo "$actions" | sed 's/|/","/g')"],
    "priority": $priority,
    "health": $health
  }
JSONITEM
done

echo "]" >> "$JSON"

log ""
log "$SEP"
log " 즉시 조치 목록"
log "$SEP"

for level in "심각한혼용" "일부혼용"; do
  for app_def in "${APPS[@]}"; do
    IFS='|' read -r aname _ _ _ <<< "$app_def"
    [[ "${VERDICTS[$aname]:-}" != "$level" ]] && continue
    acts="${ACTIONS_MAP[$aname]:-}"
    log ""
    if [[ "$level" == "심각한혼용" ]]; then
      log "  [$aname] ★★★ 즉시 조치 (${SCORES[$aname]}점)"
    else
      log "  [$aname] ★★  조치 권장 (${SCORES[$aname]}점)"
    fi
    IFS='|' read -ra act_arr <<< "$acts"
    for i in "${!act_arr[@]}"; do
      (( i >= 3 )) && break
      log "    $((i+1)). ${act_arr[$i]}"
    done
  done
done

log ""
log "$SEP"
log " 저장: TXT=$TXT | JSON=$JSON"
log "$SEP"
