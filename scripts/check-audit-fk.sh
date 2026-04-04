#!/usr/bin/env bash
# ══════════════════════════════════════════════════════
# check-audit-fk.sh — Admin API audit/FK 위험 패턴 자동 탐지
#
# 탐지 규칙:
#   R1 [FAIL] logPresenceAudit() 이 findUnique/findFirst 보다 앞에 위치
#   R2 [FAIL] presenceCheckId: params.* 직접 사용 (DB 미검증)
#   R3 [FAIL] prisma.presenceCheckAuditLog.create() 직접 호출
#   R4 [WARN] writeAdminAuditLog() 사용 (레거시)
#
# 사용법:
#   bash scripts/check-audit-fk.sh
#   bash scripts/check-audit-fk.sh --verbose
#
# exit code:
#   0 = PASS or WARN-only
#   1 = FAIL 존재
# ══════════════════════════════════════════════════════
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ADMIN_DIR="$ROOT/app/api/admin"

VERBOSE=false
for arg in "$@"; do
  [[ "$arg" == "--verbose" ]] && VERBOSE=true
done

# ── 카운터 ───────────────────────────────────────────
total_files=0
fail_count=0
warn_count=0
fail_files=()
warn_files=()

W=60

# ── 파일 탐색 ─────────────────────────────────────────
mapfile -d '' route_files < <(find "$ADMIN_DIR" -name "route.ts" -print0 2>/dev/null | sort -z)
total_files=${#route_files[@]}

# ── 파일별 분석 ───────────────────────────────────────
for fpath in "${route_files[@]}"; do
  rel="${fpath#$ROOT/}"
  file_fail=0
  file_warn=0
  file_issues=()

  # 관련 패턴 없으면 스킵
  if ! grep -qE 'logPresenceAudit|writeAdminAuditLog|presenceCheckAuditLog\.create' "$fpath" 2>/dev/null; then
    $VERBOSE && echo "  ✓ $rel"
    continue
  fi

  # ── R1: logPresenceAudit() 이 findUnique/findFirst 보다 앞에 위치 ──
  # Safe 헬퍼(logPresenceAuditSafe)는 제외
  first_find=$(grep -n 'findUnique\|findFirst' "$fpath" 2>/dev/null \
    | grep -v '^\s*//' | head -1 | cut -d: -f1)
  first_find=${first_find:-99999}

  while IFS=: read -r lineno content; do
    # 주석/import/definition 라인 제외
    trimmed="${content#"${content%%[![:space:]]*}"}"
    [[ "$trimmed" == //* ]] && continue
    [[ "$trimmed" == import* ]] && continue
    [[ "$trimmed" == *"export async function logPresenceAudit"* ]] && continue
    [[ "$trimmed" == *"logPresenceAuditSafe"* ]] && continue

    if (( lineno < first_find )); then
      file_issues+=("  [FAIL] L${lineno} R1 — logPresenceAudit() 이 findUnique 보다 앞에 위치")
      file_issues+=("         ${trimmed:0:100}")
      (( file_fail++ )) || true
    fi
  done < <(grep -n 'logPresenceAudit(' "$fpath" 2>/dev/null)

  # ── R2: presenceCheckId: params.* 직접 사용 ─────────────────────────
  while IFS=: read -r lineno content; do
    trimmed="${content#"${content%%[![:space:]]*}"}"
    [[ "$trimmed" == //* ]] && continue
    # logPresenceAuditSafe의 첫 인자(presenceCheckId 아님)는 해당 없음
    file_issues+=("  [FAIL] L${lineno} R2 — presenceCheckId: params.* 직접 사용 (DB 미검증)")
    file_issues+=("         ${trimmed:0:100}")
    (( file_fail++ )) || true
  done < <(grep -n 'presenceCheckId\s*:\s*params\.' "$fpath" 2>/dev/null)

  # ── R3: prisma.presenceCheckAuditLog.create() 직접 호출 ─────────────
  while IFS=: read -r lineno content; do
    trimmed="${content#"${content%%[![:space:]]*}"}"
    [[ "$trimmed" == //* ]] && continue
    file_issues+=("  [FAIL] L${lineno} R3 — presenceCheckAuditLog.create() 직접 호출 (헬퍼 우회)")
    file_issues+=("         ${trimmed:0:100}")
    (( file_fail++ )) || true
  done < <(grep -n 'presenceCheckAuditLog\.create(' "$fpath" 2>/dev/null)

  # ── R4: writeAdminAuditLog() 호출 (정의 파일 제외) ────────────────────
  if [[ "$rel" != *"write-audit-log"* ]]; then
    while IFS=: read -r lineno content; do
      trimmed="${content#"${content%%[![:space:]]*}"}"
      [[ "$trimmed" == //* ]] && continue
      [[ "$trimmed" == import* ]] && continue
      [[ "$trimmed" == *"export async function writeAdminAuditLog"* ]] && continue
      file_issues+=("  [WARN] L${lineno} R4 — writeAdminAuditLog() 사용 (레거시)")
      file_issues+=("         ${trimmed:0:100}")
      (( file_warn++ )) || true
    done < <(grep -n 'writeAdminAuditLog(' "$fpath" 2>/dev/null)
  fi

  # ── 파일 결과 집계 ─────────────────────────────────────────────────
  if (( file_fail > 0 )); then
    (( fail_count += file_fail )) || true
    fail_files+=("$rel")
    echo ""
    echo "  $rel"
    for msg in "${file_issues[@]}"; do echo "$msg"; done
  elif (( file_warn > 0 )); then
    (( warn_count += file_warn )) || true
    warn_files+=("$rel")
    echo ""
    echo "  $rel"
    for msg in "${file_issues[@]}"; do echo "$msg"; done
  else
    $VERBOSE && echo "  ✓ $rel"
  fi
done

# ── 결과 요약 ─────────────────────────────────────────
echo ""
printf '%0.s═' $(seq 1 $W); echo
echo "  audit-fk-check | Admin API FK/Audit 패턴 점검"
printf '%0.s═' $(seq 1 $W); echo
echo "대상: ${total_files}개 파일"
echo "FAIL: ${fail_count} | WARN: ${warn_count}"
printf '%0.s─' $(seq 1 $W); echo

if (( fail_count == 0 && warn_count == 0 )); then
  echo "판정: PASS"
  exit 0
elif (( fail_count == 0 )); then
  echo "판정: WARN (R4 레거시 패턴 ${warn_count}건 — 선택적 개선 대상)"
  exit 0
else
  echo "판정: FAIL (FAIL ${fail_count}, WARN ${warn_count})"
  echo ""
  echo "FAIL 파일 목록:"
  for f in "${fail_files[@]}"; do echo "  ✗ $f"; done
  echo ""
  echo "조치: R1 → findUnique 선조회 이동 | R2 → pc.id 사용 | R3 → logPresenceAudit 헬퍼 사용"
  exit 1
fi
