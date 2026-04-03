#!/usr/bin/env bash
# ──────────────────────────────────────────────
# auto_fix_safe.sh — 안전한 범위 자동 수정
#
# 허용: 포맷, import, 클래스명 치환, 정적 규칙 위반
# 금지: DB, 인증, 권한, 결제, 삭제성 리팩토링, input/modal 변경
#
# 사용법:
#   bash scripts/auto_fix_safe.sh              # 탐지 + 수정 + 보고
#   bash scripts/auto_fix_safe.sh --dry-run    # 탐지만 (수정 안 함)
# ──────────────────────────────────────────────
set -uo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOBILE_DIR="$PROJECT_DIR/app/(mobile)"
PUBLIC_DIR="$PROJECT_DIR/app/m"
LOG_DIR="$PROJECT_DIR/logs"
mkdir -p "$LOG_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT="$LOG_DIR/auto_fix_${TIMESTAMP}.txt"

DRY_RUN=false
[ "${1:-}" = "--dry-run" ] || [ "${1:-}" = "-n" ] && DRY_RUN=true

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

FIXED=0
SKIPPED=0
DETECTED=0

out()  { echo "$1" | tee -a "$REPORT"; }
outc() { echo -e "$1" | tee -a "$REPORT"; }

outc "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
out " auto_fix_safe — $(date '+%Y-%m-%d %H:%M:%S')"
$DRY_RUN && out " 모드: DRY RUN (수정 안 함)" || out " 모드: 실행"
outc "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
out ""

# ═══════════════════════════════════════════
# 규칙 1: 카드 컨테이너 bg-white → bg-card
#   조건: bg-white + rounded-2xl + p-숫자 (카드 패턴)
#   제외: input, button, select, modal, const 문자열
# ═══════════════════════════════════════════
outc "${CYAN}[1] bg-white → bg-card (카드 컨테이너)${NC}"

for dir in "$MOBILE_DIR"; do
  [ -d "$dir" ] || continue
  while IFS= read -r file; do
    relpath="${file#$PROJECT_DIR/}"
    while IFS= read -r match; do
      [ -z "$match" ] && continue
      linenum=$(echo "$match" | cut -d: -f1)
      content=$(echo "$match" | cut -d: -f2-)

      # 제외: input, button, select, const, modal
      if echo "$content" | grep -qiE '<input|<button|<select|const |modal|onClick.*=>'; then
        continue
      fi
      # 제외: h-[50px] 등 폼 요소 패턴
      if echo "$content" | grep -qE 'h-\[50px\]|h-\[48px\]|h-\[44px\]'; then
        continue
      fi

      DETECTED=$((DETECTED + 1))

      if $DRY_RUN; then
        outc "  ${YELLOW}[탐지]${NC} $relpath:$linenum"
        out "    $content"
      else
        sed -i "${linenum}s/bg-white/bg-card/" "$file"
        FIXED=$((FIXED + 1))
        outc "  ${GREEN}[수정]${NC} $relpath:$linenum bg-white → bg-card"
      fi
    done < <(grep -nP 'bg-white\s+rounded-2xl\s+p-[0-9]' "$file" 2>/dev/null || true)
  done < <(find "$dir" -name "*.tsx" | sort)
done

[ "$DETECTED" -eq 0 ] && outc "  ${GREEN}[PASS]${NC} 치환 대상 없음"
out ""

# ═══════════════════════════════════════════
# 규칙 2: border-gray-100 → border-brand (카드 컨테이너)
#   조건: bg-card + rounded-2xl + border-gray-100
#   안전: 시각 변화 미미, 디자인 토큰 통일
# ═══════════════════════════════════════════
outc "${CYAN}[2] border-gray-100 → border-brand (카드 컨테이너)${NC}"

R2_DETECTED=0
for dir in "$MOBILE_DIR"; do
  [ -d "$dir" ] || continue
  while IFS= read -r file; do
    relpath="${file#$PROJECT_DIR/}"
    while IFS= read -r match; do
      [ -z "$match" ] && continue
      linenum=$(echo "$match" | cut -d: -f1)
      content=$(echo "$match" | cut -d: -f2-)

      # bg-card가 같은 줄에 있어야 카드 컨테이너
      if ! echo "$content" | grep -q "bg-card"; then
        continue
      fi

      R2_DETECTED=$((R2_DETECTED + 1))
      DETECTED=$((DETECTED + 1))

      if $DRY_RUN; then
        outc "  ${YELLOW}[탐지]${NC} $relpath:$linenum"
      else
        sed -i "${linenum}s/border-gray-100/border-brand/" "$file"
        FIXED=$((FIXED + 1))
        outc "  ${GREEN}[수정]${NC} $relpath:$linenum border-gray-100 → border-brand"
      fi
    done < <(grep -n "border-gray-100" "$file" 2>/dev/null || true)
  done < <(find "$dir" -name "*.tsx" | sort)
done

[ "$R2_DETECTED" -eq 0 ] && outc "  ${GREEN}[PASS]${NC} 치환 대상 없음"
out ""

# ═══════════════════════════════════════════
# 규칙 3: 미사용 import 탐지 (수정은 dry-run만)
#   import 구문이 있지만 해당 심볼이 파일에서 한 번만 등장(import 줄 자체)
#   자동 삭제는 위험 → 탐지만 수행
# ═══════════════════════════════════════════
outc "${CYAN}[3] 미사용 import 탐지 (보고만)${NC}"

UNUSED_IMPORTS=0
for dir in "$MOBILE_DIR" "$PUBLIC_DIR"; do
  [ -d "$dir" ] || continue
  while IFS= read -r file; do
    relpath="${file#$PROJECT_DIR/}"
    # named import만 검사: import { Foo, Bar } from '...'
    while IFS= read -r importline; do
      [ -z "$importline" ] && continue
      # { } 안의 심볼 추출
      symbols=$(echo "$importline" | grep -oP '(?<=\{)[^}]+' | tr ',' '\n' | sed 's/^ *//;s/ *$//' | grep -v '^$' | grep -v ' as ')
      for sym in $symbols; do
        # 파일 내 등장 횟수 (import 줄 포함)
        count=$(grep -c "\b${sym}\b" "$file" 2>/dev/null | tr -d '[:space:]')
        count=${count:-0}
        if [ "$count" -le 1 ]; then
          UNUSED_IMPORTS=$((UNUSED_IMPORTS + 1))
          outc "  ${YELLOW}[탐지]${NC} $relpath: 미사용 가능 import '$sym'"
        fi
      done
    done < <(grep -n "^import " "$file" 2>/dev/null | grep '{' || true)
  done < <(find "$dir" -name "*.tsx" -o -name "*.ts" | sort)
done

if [ "$UNUSED_IMPORTS" -eq 0 ]; then
  outc "  ${GREEN}[PASS]${NC} 미사용 import 없음"
else
  outc "  ${YELLOW}[INFO]${NC} ${UNUSED_IMPORTS}건 탐지 — 수동 확인 필요"
  SKIPPED=$((SKIPPED + UNUSED_IMPORTS))
fi
out ""

# ═══════════════════════════════════════════
# 규칙 4: console.log 잔존 탐지 (보고만)
# ═══════════════════════════════════════════
outc "${CYAN}[4] console.log 잔존 탐지 (보고만)${NC}"

CONSOLE_COUNT=0
for dir in "$MOBILE_DIR" "$PUBLIC_DIR"; do
  [ -d "$dir" ] || continue
  while IFS= read -r file; do
    relpath="${file#$PROJECT_DIR/}"
    count=$(grep -c "console\.log" "$file" 2>/dev/null | tr -d '[:space:]')
    count=${count:-0}
    if [ "$count" -gt 0 ]; then
      CONSOLE_COUNT=$((CONSOLE_COUNT + count))
      outc "  ${YELLOW}[탐지]${NC} $relpath: console.log ${count}건"
    fi
  done < <(find "$dir" -name "*.tsx" -o -name "*.ts" | sort)
done

if [ "$CONSOLE_COUNT" -eq 0 ]; then
  outc "  ${GREEN}[PASS]${NC} console.log 없음"
else
  outc "  ${YELLOW}[INFO]${NC} ${CONSOLE_COUNT}건 — 수동 확인 필요"
  SKIPPED=$((SKIPPED + CONSOLE_COUNT))
fi
out ""

# ═══════════════════════════════════════════
# 종합
# ═══════════════════════════════════════════
outc "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
out " 종합"
if $DRY_RUN; then
  outc "  탐지(수정 가능): ${GREEN}${DETECTED}${NC}건"
  outc "  탐지(수동 필요): ${YELLOW}${SKIPPED}${NC}건"
  out "  수정: 0건 (dry-run)"
else
  outc "  자동 수정: ${GREEN}${FIXED}${NC}건"
  outc "  수동 필요: ${YELLOW}${SKIPPED}${NC}건"
fi
out ""
out " 보고서: $REPORT"
outc "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# 수정 발생 시 git diff 요약
if [ "$FIXED" -gt 0 ]; then
  out ""
  out " git diff 요약:"
  git diff --stat 2>/dev/null | tee -a "$REPORT" || true
fi

exit 0
