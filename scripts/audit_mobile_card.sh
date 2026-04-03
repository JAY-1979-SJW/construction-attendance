#!/usr/bin/env bash
# ──────────────────────────────────────────────
# audit_mobile_card.sh — 모바일 카드형 UI 정적 분석
#
# 기능:
#   1. table/dl/dt 잔존 탐지
#   2. MobileCardList 미적용 페이지 탐지
#   3. 카드 스타일 불일치 탐지
#   4. 문제 파일 목록 출력
#   5. 자동 치환 후보 생성 (실행 안 함)
#
# 사용법: bash scripts/audit_mobile_card.sh
# ──────────────────────────────────────────────
set -uo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOBILE_DIR="$PROJECT_DIR/app/(mobile)"
PUBLIC_DIR="$PROJECT_DIR/app/m"
LOG_DIR="$PROJECT_DIR/logs"
mkdir -p "$LOG_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT="$LOG_DIR/audit_mobile_card_${TIMESTAMP}.txt"
PATCH_FILE="$LOG_DIR/auto_fix_candidates_${TIMESTAMP}.txt"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

FAIL_COUNT=0
WARN_COUNT=0
PASS_COUNT=0
FAIL_FILES=""
WARN_FILES=""

out() { echo "$1" | tee -a "$REPORT"; }
outc() { echo -e "$1" | tee -a "$REPORT"; }

outc "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
outc "${CYAN} 모바일 카드형 UI 정적 분석${NC}"
out " 시각: $(date '+%Y-%m-%d %H:%M:%S')"
outc "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
out ""

# ════════════════════════════════════════════════
# 1. table/dl/dt 잔존 탐지
# ════════════════════════════════════════════════
outc "${CYAN}[1] table/dl/dt 잔존 탐지${NC}"

TABLE_HITS=""
for dir in "$MOBILE_DIR" "$PUBLIC_DIR"; do
  if [ -d "$dir" ]; then
    while IFS= read -r file; do
      hits=$(grep -nP '<table\b|<thead|<tbody|<tr\b|<th\b|<td\b|<dl\b|<dt\b|<dd\b|<Table\b' "$file" 2>/dev/null || true)
      if [ -n "$hits" ]; then
        TABLE_HITS="${TABLE_HITS}\n${file}\n${hits}\n"
        FAIL_COUNT=$((FAIL_COUNT + 1))
        FAIL_FILES="${FAIL_FILES}${file}\n"
      fi
    done < <(find "$dir" -name "*.tsx" -o -name "*.ts" | sort)
  fi
done

if [ -z "$TABLE_HITS" ]; then
  outc "  ${GREEN}[PASS]${NC} table/dl/dt 잔존 없음"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  outc "  ${RED}[FAIL]${NC} table/dl/dt 발견:"
  echo -e "$TABLE_HITS" | tee -a "$REPORT"
fi

out ""

# ════════════════════════════════════════════════
# 2. MobileCardList 미적용 탐지 (인증 모바일만)
# ════════════════════════════════════════════════
outc "${CYAN}[2] MobileCardList 미적용 페이지${NC}"

MOBILE_PAGES_USING=0
MOBILE_PAGES_TOTAL=0
MISSING_MCL=""

if [ -d "$MOBILE_DIR" ]; then
  while IFS= read -r file; do
    MOBILE_PAGES_TOTAL=$((MOBILE_PAGES_TOTAL + 1))
    if grep -q "MobileCardList\|MobileCard" "$file" 2>/dev/null; then
      MOBILE_PAGES_USING=$((MOBILE_PAGES_USING + 1))
    else
      relpath="${file#$PROJECT_DIR/}"
      MISSING_MCL="${MISSING_MCL}  - ${relpath}\n"
    fi
  done < <(find "$MOBILE_DIR" -name "page.tsx" | sort)
fi

if [ "$MOBILE_PAGES_TOTAL" -eq "$MOBILE_PAGES_USING" ]; then
  outc "  ${GREEN}[PASS]${NC} 전체 ${MOBILE_PAGES_TOTAL}개 페이지 MobileCardList 사용"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  outc "  ${YELLOW}[INFO]${NC} MobileCardList 미사용: ${MOBILE_PAGES_TOTAL}개 중 $((MOBILE_PAGES_TOTAL - MOBILE_PAGES_USING))개"
  out "  (모바일 전용 페이지는 인라인 카드가 정상 — 리스트형 데이터 페이지만 검토 필요)"
  echo -e "$MISSING_MCL" | tee -a "$REPORT"
fi

out ""

# ════════════════════════════════════════════════
# 3. 카드 스타일 일관성 점검
# ════════════════════════════════════════════════
outc "${CYAN}[3] 카드 스타일 일관성 점검${NC}"

# 표준 패턴: bg-card + rounded-2xl
# 비표준: bg-white + rounded-2xl (치환 후보), rounded-xl (비카드 용도일 수 있음)
STYLE_ISSUES=""
BG_WHITE_CANDIDATES=""

for dir in "$MOBILE_DIR" "$PUBLIC_DIR"; do
  if [ -d "$dir" ]; then
    while IFS= read -r file; do
      relpath="${file#$PROJECT_DIR/}"

      # bg-white + rounded-2xl → bg-card 치환 후보
      bg_white_card=$(grep -nP 'bg-white\s.*rounded-2xl|rounded-2xl\s.*bg-white' "$file" 2>/dev/null || true)
      if [ -n "$bg_white_card" ]; then
        BG_WHITE_CANDIDATES="${BG_WHITE_CANDIDATES}\n${relpath}:\n${bg_white_card}\n"
        WARN_COUNT=$((WARN_COUNT + 1))
        WARN_FILES="${WARN_FILES}${file}\n"
      fi

      # shadow-sm 없는 카드 (리스트 카드에만 해당)
      # shadow 불일치는 참고 수준이므로 WARNING만
    done < <(find "$dir" -name "*.tsx" | sort)
  fi
done

if [ -z "$BG_WHITE_CANDIDATES" ]; then
  outc "  ${GREEN}[PASS]${NC} bg-white 카드 잔존 없음 (전부 bg-card 사용)"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  outc "  ${YELLOW}[WARN]${NC} bg-white + rounded-2xl 발견 (bg-card 치환 후보):"
  echo -e "$BG_WHITE_CANDIDATES" | tee -a "$REPORT"
fi

out ""

# ════════════════════════════════════════════════
# 4. overflow-x 방어 누락 탐지
# ════════════════════════════════════════════════
outc "${CYAN}[4] overflow-x 방어 점검${NC}"

OVERFLOW_MISSING=""
for dir in "$MOBILE_DIR" "$PUBLIC_DIR"; do
  if [ -d "$dir" ]; then
    # layout 파일에 overflow-x-hidden 있는지 확인
    while IFS= read -r layout; do
      if ! grep -q "overflow-x-hidden\|overflow-hidden\|overflow-x: hidden" "$layout" 2>/dev/null; then
        relpath="${layout#$PROJECT_DIR/}"
        OVERFLOW_MISSING="${OVERFLOW_MISSING}  - ${relpath}\n"
      fi
    done < <(find "$dir" -name "layout.tsx" | sort)
  fi
done

if [ -z "$OVERFLOW_MISSING" ]; then
  outc "  ${GREEN}[PASS]${NC} 모바일 레이아웃에 overflow-x 방어 있음"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  outc "  ${YELLOW}[WARN]${NC} overflow-x-hidden 누락 레이아웃:"
  echo -e "$OVERFLOW_MISSING" | tee -a "$REPORT"
  WARN_COUNT=$((WARN_COUNT + 1))
fi

out ""

# ════════════════════════════════════════════════
# 5. 자동 치환 후보 생성
# ════════════════════════════════════════════════
outc "${CYAN}[5] 자동 치환 후보${NC}"

echo "# 자동 치환 후보 — $(date '+%Y-%m-%d %H:%M:%S')" > "$PATCH_FILE"
echo "# 아래는 기계적으로 안전한 단순 치환만 포함" >> "$PATCH_FILE"
echo "# 실행 전 반드시 수동 확인 필요" >> "$PATCH_FILE"
echo "" >> "$PATCH_FILE"

CANDIDATE_COUNT=0

# 후보 1: bg-white rounded-2xl → bg-card rounded-2xl (카드 배경 통일)
for dir in "$MOBILE_DIR" "$PUBLIC_DIR"; do
  if [ -d "$dir" ]; then
    while IFS= read -r file; do
      relpath="${file#$PROJECT_DIR/}"
      # 카드 컨테이너에서만 (p-4, p-5 등 패딩 포함)
      matches=$(grep -nP 'bg-white\s+rounded-2xl\s+p-[0-9]' "$file" 2>/dev/null || true)
      if [ -n "$matches" ]; then
        echo "# 파일: $relpath" >> "$PATCH_FILE"
        echo "# 치환: bg-white rounded-2xl → bg-card rounded-2xl" >> "$PATCH_FILE"
        echo "# 영향: 카드 배경색 토큰 통일 (시각 변화 없음, bg-card=#FFFFFF)" >> "$PATCH_FILE"
        while IFS= read -r line; do
          linenum=$(echo "$line" | cut -d: -f1)
          echo "# L${linenum}: $(echo "$line" | cut -d: -f2-)" >> "$PATCH_FILE"
          echo "sed -i '${linenum}s/bg-white/bg-card/' \"$relpath\"" >> "$PATCH_FILE"
          CANDIDATE_COUNT=$((CANDIDATE_COUNT + 1))
        done <<< "$matches"
        echo "" >> "$PATCH_FILE"
      fi
    done < <(find "$dir" -name "*.tsx" | sort)
  fi
done

if [ "$CANDIDATE_COUNT" -eq 0 ]; then
  outc "  ${GREEN}[PASS]${NC} 자동 치환 후보 없음"
  echo "# 치환 후보 없음" >> "$PATCH_FILE"
else
  outc "  ${YELLOW}[INFO]${NC} ${CANDIDATE_COUNT}건 치환 후보 생성"
  out "  파일: $PATCH_FILE"
fi

out ""

# ════════════════════════════════════════════════
# 종합 보고
# ════════════════════════════════════════════════
outc "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
out " 종합 결과"
outc "  ${GREEN}PASS: ${PASS_COUNT}${NC}"
outc "  ${YELLOW}WARN: ${WARN_COUNT}${NC}"
outc "  ${RED}FAIL: ${FAIL_COUNT}${NC}"
out ""

if [ "$FAIL_COUNT" -gt 0 ]; then
  outc " ${RED}[FAIL 파일]${NC}"
  echo -e "$FAIL_FILES" | sort -u | while IFS= read -r f; do
    [ -n "$f" ] && out "  - ${f#$PROJECT_DIR/}"
  done
  out ""
fi

if [ "$WARN_COUNT" -gt 0 ]; then
  outc " ${YELLOW}[WARN 파일 — 수동 확인 필요]${NC}"
  echo -e "$WARN_FILES" | sort -u | while IFS= read -r f; do
    [ -n "$f" ] && out "  - ${f#$PROJECT_DIR/}"
  done
  out ""
fi

if [ "$CANDIDATE_COUNT" -gt 0 ]; then
  outc " ${YELLOW}[자동 수정 가능]${NC}"
  out "  ${CANDIDATE_COUNT}건 — $PATCH_FILE"
  out "  적용: bash $PATCH_FILE (수동 확인 후)"
fi

out ""
out " 보고서: $REPORT"
outc "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

[ "$FAIL_COUNT" -eq 0 ] && exit 0 || exit 1
