#!/usr/bin/env node
/**
 * check-audit-fk.js
 * Admin API audit/FK 위험 패턴 자동 탐지
 *
 * 탐지 규칙:
 *   R1 [FAIL] logPresenceAudit() 이 findUnique/findFirst 보다 앞에 위치
 *   R2 [FAIL] logPresenceAudit에 presenceCheckId: params.* 직접 사용 (DB 미검증)
 *   R3 [FAIL] prisma.presenceCheckAuditLog.create() 직접 호출 (헬퍼 우회)
 *   R4 [WARN] writeAdminAuditLog() 사용 (레거시 — writeAuditLog 교체 권장)
 *   R5 [WARN] logPresenceAudit() 앞에 null 가드(if (pc)) 없음 (권한 차단 분기 한정)
 *
 * 사용법:
 *   node scripts/check-audit-fk.js
 *   node scripts/check-audit-fk.js --verbose   # 전체 파일 목록 출력
 *   node scripts/check-audit-fk.js --json       # JSON 결과 출력
 *
 * ops-check 통합:
 *   node scripts/check-audit-fk.js
 *   exit code 0 = PASS or WARN-only
 *   exit code 1 = FAIL 존재
 */
'use strict'

const fs   = require('fs')
const path = require('path')

// ── 설정 ─────────────────────────────────────────────────────────────
const ROOT          = path.resolve(__dirname, '..')
const ADMIN_API_DIR = path.join(ROOT, 'app', 'api', 'admin')

const RULES = {
  R1: { level: 'FAIL', desc: 'logPresenceAudit() 이 findUnique/findFirst 보다 앞에 위치' },
  R2: { level: 'FAIL', desc: 'presenceCheckId: params.* 직접 사용 (DB 미검증)' },
  R3: { level: 'FAIL', desc: 'prisma.presenceCheckAuditLog.create() 직접 호출 (헬퍼 우회)' },
  R4: { level: 'WARN', desc: 'writeAdminAuditLog() 사용 (레거시)' },
  R5: { level: 'WARN', desc: 'logPresenceAudit() 앞에 null 가드 없음 (권한 차단 분기 의심)' },
}

// ── 옵션 파싱 ─────────────────────────────────────────────────────────
const args    = process.argv.slice(2)
const VERBOSE = args.includes('--verbose')
const JSON_OUT = args.includes('--json')

// ── 유틸 ─────────────────────────────────────────────────────────────
function walkDir(dir, results = []) {
  let entries
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return results }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walkDir(full, results)
    else if (entry.name === 'route.ts') results.push(full)
  }
  return results
}

function relPath(p) {
  return path.relative(ROOT, p).replace(/\\/g, '/')
}

/** 라인이 코드 라인인지 확인 (import/주석/빈 줄 제외) */
function isCodeLine(line) {
  const t = line.trim()
  return t.length > 0
    && !t.startsWith('//')
    && !t.startsWith('*')
    && !t.startsWith('/*')
    && !t.startsWith('import ')
    && !t.startsWith('export async function logPresenceAudit')
    && !t.startsWith('export async function logPresenceAuditSafe')
}

// ── 파일 분석 ─────────────────────────────────────────────────────────
function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const lines   = content.split('\n')
  const rel     = relPath(filePath)
  const issues  = []

  // 관련 패턴이 없으면 빠른 스킵
  const hasPresenceAudit     = content.includes('logPresenceAudit')
  const hasWriteAdminAudit   = content.includes('writeAdminAuditLog')
  const hasDirectCreate      = content.includes('presenceCheckAuditLog.create')
  if (!hasPresenceAudit && !hasWriteAdminAudit && !hasDirectCreate) return []

  // ── findUnique / findFirst 첫 등장 라인 번호 (1-based) ──────────────
  let firstFindLine = Infinity
  for (let i = 0; i < lines.length; i++) {
    if (/findUnique|findFirst/.test(lines[i]) && isCodeLine(lines[i])) {
      firstFindLine = i + 1
      break
    }
  }

  // ── logPresenceAudit 호출 분석 ───────────────────────────────────────
  if (hasPresenceAudit) {
    // 멀티라인 호출 처리: logPresenceAudit( 시작 이후 최대 10줄 context 수집
    for (let i = 0; i < lines.length; i++) {
      const line   = lines[i]
      const lineNo = i + 1

      if (!isCodeLine(line)) continue

      const isLogCall     = line.includes('logPresenceAudit(')
      const isSafeCall    = line.includes('logPresenceAuditSafe(')
      const isImplicitSafe = isSafeCall // Safe 헬퍼는 내부에서 존재 검증함

      if (!isLogCall) continue

      // 호출 컨텍스트: 현재 라인 + 이후 8줄 (멀티라인 인자 커버)
      const callBlock = lines.slice(i, Math.min(i + 8, lines.length)).join('\n')

      // R1: findUnique 전에 logPresenceAudit (Safe 헬퍼는 제외)
      if (!isImplicitSafe && lineNo < firstFindLine) {
        issues.push({ rule: 'R1', line: lineNo, snippet: line.trim().substring(0, 120) })
      }

      // R2: presenceCheckId: params.* 직접 사용 (Safe 헬퍼 첫 인자는 괜찮음)
      if (!isSafeCall && /presenceCheckId\s*:\s*params\./.test(callBlock)) {
        // params.id가 여러 줄에 걸쳐 있을 수 있으므로 block 전체 검사
        const matchLine = lines.slice(i, Math.min(i + 8, lines.length))
          .findIndex(l => /presenceCheckId\s*:\s*params\./.test(l))
        issues.push({
          rule: 'R2',
          line: lineNo + (matchLine >= 0 ? matchLine : 0),
          snippet: (matchLine >= 0 ? lines[i + matchLine] : line).trim().substring(0, 120),
        })
      }

      // R5: null 가드 없음 — 앞 5줄에 if (pc) / if (exists) / if (row) 없으면 WARN
      // 단, findUnique 이후이고 if (!pc) return 이 있는 경우는 검증됨으로 간주 → skip
      if (!isImplicitSafe) {
        const lookback  = lines.slice(Math.max(0, i - 5), i).join('\n')
        const hasGuard  = /if\s*\(\s*(pc|exists|row|check|doc|item|worker|request|entity)\b/.test(lookback)
        const hasNotNull = /if\s*\(!/.test(lines.slice(0, i).join('\n')) // 이전 어딘가에 if (! ... return
        const afterFind = lineNo >= firstFindLine

        if (!hasGuard && !hasNotNull && afterFind) {
          // 주의: false positive 가능성 있음 — context 확인 필요
          issues.push({ rule: 'R5', line: lineNo, snippet: line.trim().substring(0, 120) })
        }
      }
    }
  }

  // R3: presenceCheckAuditLog.create 직접 호출
  if (hasDirectCreate) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (!isCodeLine(line)) continue
      if (line.includes('presenceCheckAuditLog.create(')) {
        issues.push({ rule: 'R3', line: i + 1, snippet: line.trim().substring(0, 120) })
      }
    }
  }

  // R4: writeAdminAuditLog 직접 호출 (정의 파일 제외)
  if (hasWriteAdminAudit && !rel.includes('write-audit-log')) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (!isCodeLine(line)) continue
      if (line.includes('writeAdminAuditLog(') &&
          !line.trim().startsWith('export async function')) {
        issues.push({ rule: 'R4', line: i + 1, snippet: line.trim().substring(0, 120) })
      }
    }
  }

  return issues.map(iss => ({ ...iss, file: rel }))
}

// ── 메인 ─────────────────────────────────────────────────────────────
function main() {
  const files     = walkDir(ADMIN_API_DIR)
  const allIssues = []

  for (const file of files) {
    try {
      allIssues.push(...analyzeFile(file))
    } catch (err) {
      allIssues.push({ rule: 'R0', level: 'WARN', file: relPath(file), line: 0,
        snippet: `파일 읽기 실패: ${err.message}` })
    }
  }

  const failIssues = allIssues.filter(i => RULES[i.rule]?.level === 'FAIL')
  const warnIssues = allIssues.filter(i => RULES[i.rule]?.level === 'WARN')

  const byFile = {}
  for (const iss of allIssues) {
    ;(byFile[iss.file] = byFile[iss.file] ?? []).push(iss)
  }

  // ── JSON 출력 ──────────────────────────────────────────────────────
  if (JSON_OUT) {
    const verdict = failIssues.length > 0 ? 'FAIL' : warnIssues.length > 0 ? 'WARN' : 'PASS'
    console.log(JSON.stringify({
      verdict,
      totalFiles: files.length,
      affectedFiles: Object.keys(byFile).length,
      failCount: failIssues.length,
      warnCount: warnIssues.length,
      issues: allIssues,
    }, null, 2))
    process.exit(failIssues.length > 0 ? 1 : 0)
  }

  // ── 텍스트 출력 ────────────────────────────────────────────────────
  const W = 62
  console.log('═'.repeat(W))
  console.log('  audit-fk-check | Admin API FK/Audit 패턴 점검')
  console.log('═'.repeat(W))
  console.log(`대상 파일: ${files.length}개 | 이상 파일: ${Object.keys(byFile).length}개`)
  console.log(`FAIL: ${failIssues.length} | WARN: ${warnIssues.length}`)
  console.log('─'.repeat(W))

  if (allIssues.length === 0) {
    console.log('판정: PASS')
    console.log('모든 admin route — FK 선조회 원칙 준수 확인')
    if (VERBOSE) {
      console.log()
      for (const f of files) console.log(`  ✓ ${relPath(f)}`)
    }
    process.exit(0)
  }

  // 이슈 상세 출력
  for (const [file, issues] of Object.entries(byFile)) {
    console.log(`\n  ${file}`)
    for (const iss of issues) {
      const rule = RULES[iss.rule] ?? { level: '?', desc: '알 수 없음' }
      console.log(`    [${rule.level}] L${iss.line} ${iss.rule} — ${rule.desc}`)
      console.log(`          ${iss.snippet}`)
    }
  }

  // 규칙 요약
  console.log('\n' + '─'.repeat(W))
  console.log('규칙 설명:')
  for (const [key, r] of Object.entries(RULES)) {
    console.log(`  ${key} [${r.level}] ${r.desc}`)
  }

  console.log('\n' + '─'.repeat(W))
  if (failIssues.length > 0) {
    console.log(`판정: FAIL (FAIL ${failIssues.length}, WARN ${warnIssues.length})`)
    console.log('조치: R1/R2/R3 항목을 수정 후 재실행')
    process.exit(1)
  } else {
    console.log(`판정: WARN (FAIL 0, WARN ${warnIssues.length})`)
    console.log('조치: R4/R5 항목은 선택적 개선 대상')
    process.exit(0)
  }
}

main()
