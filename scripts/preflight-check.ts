/**
 * 파일럿 개시 전 런타임 점검 스크립트 (Steps 5-8, 10)
 *
 * 실행 조건: 앱 서버가 기동된 상태에서 실행
 * 실행: npx tsx scripts/preflight-check.ts [APP_URL]
 * 예:  npx tsx scripts/preflight-check.ts http://localhost:3000
 */

const BASE_URL = process.argv[2] ?? 'http://localhost:3000'
const CRON_SECRET = process.env.CRON_SECRET ?? ''

let passed = 0, failed = 0
const c = {
  ok:   (s: string) => `\x1b[32m✓ PASS  ${s}\x1b[0m`,
  fail: (s: string) => `\x1b[31m✗ FAIL  ${s}\x1b[0m`,
  warn: (s: string) => `\x1b[33m⚠ WARN  ${s}\x1b[0m`,
  head: (s: string) => `\x1b[1m\x1b[36m${s}\x1b[0m`,
  dim:  (s: string) => `\x1b[90m        ${s}\x1b[0m`,
}
function check(cond: boolean, label: string, detail?: string) {
  if (cond) { console.log(c.ok(label)); passed++ }
  else       { console.log(c.fail(label)); if (detail) console.log(c.dim(detail)); failed++ }
}

async function step5_dryRun() {
  console.log(c.head('\n[ Step 5 ] dryRun 검증'))

  if (!CRON_SECRET) {
    console.log(c.fail('CRON_SECRET 환경변수 미설정 — dryRun 불가'))
    failed++
    return
  }

  let res: Response
  try {
    res = await fetch(`${BASE_URL}/api/cron/auto-checkout?dryRun=true`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    })
  } catch (e) {
    console.log(c.fail('서버 연결 실패'))
    console.log(c.dim(`원인: ${e}`))
    failed++
    return
  }

  const body = await res.json().catch(() => null)
  check(res.status === 200, `HTTP 200 응답 (실제: ${res.status})`)
  check(body?.success === true, 'success=true')
  check(typeof body?.data?.totalFound === 'number', `totalFound 값 존재 (${body?.data?.totalFound ?? 'N/A'})`)
  check(typeof body?.data?.processed === 'number', `processed 값 존재 (${body?.data?.processed ?? 'N/A'})`)
  console.log(c.dim(`dryRun 응답: totalFound=${body?.data?.totalFound} processed=${body?.data?.processed} elapsedMs=${body?.data?.elapsedMs}`))
}

async function step6_cronSecurity() {
  console.log(c.head('\n[ Step 6 ] cron API 보안 검증 (무인증 / 오인증 / 정인증)'))

  if (!CRON_SECRET) {
    console.log(c.fail('CRON_SECRET 미설정 — 보안 검증 불가'))
    failed++
    return
  }

  // Case 1: 무인증
  const r1 = await fetch(`${BASE_URL}/api/cron/auto-checkout?dryRun=true`, {
    method: 'POST',
  }).catch(() => null)
  check(r1?.status === 401, `무인증 → 401 차단 (실제: ${r1?.status ?? '연결실패'})`)

  // Case 2: 오인증
  const r2 = await fetch(`${BASE_URL}/api/cron/auto-checkout?dryRun=true`, {
    method: 'POST',
    headers: { Authorization: 'Bearer wrong-secret-value' },
  }).catch(() => null)
  check(r2?.status === 401, `오인증 → 401 차단 (실제: ${r2?.status ?? '연결실패'})`)

  // Case 3: 정인증
  const r3 = await fetch(`${BASE_URL}/api/cron/auto-checkout?dryRun=true`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  }).catch(() => null)
  check(r3?.status === 200, `정인증 → 200 성공 (실제: ${r3?.status ?? '연결실패'})`)
}

async function step7_serverHealth() {
  console.log(c.head('\n[ Step 7 ] 서버 헬스 확인'))

  const r = await fetch(`${BASE_URL}/api/admin/dashboard`, {
    headers: { Cookie: '' },
  }).catch(() => null)
  // 미인증 접근은 401/redirect가 정상
  check(r !== null, `서버 응답 있음 (${r?.status ?? '연결실패'})`)
}

async function step8_dbConnect() {
  console.log(c.head('\n[ Step 8 ] DB 연결 (cron dryRun 응답으로 판정)'))
  // /api/admin/workers 는 인증 미통과 시 DB 조회 전에 401 반환 → DB 미연결 오판 가능
  // DB를 실제로 타는 cron dryRun 엔드포인트 응답으로 판정
  if (!CRON_SECRET) {
    console.log(c.fail('CRON_SECRET 없음 — DB 판정 불가'))
    failed++
    return
  }
  const r = await fetch(`${BASE_URL}/api/cron/auto-checkout?dryRun=true`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  }).catch(() => null)
  const body = await r?.json().catch(() => null)
  const isDbError = r?.status === 500 && !body?.success
  check(!isDbError, `DB 연결 정상 (HTTP ${r?.status ?? '연결실패'})`,
    isDbError ? 'DB 미기동 또는 DATABASE_URL 오류. PostgreSQL 서버를 기동하세요.' : undefined)
  if (body?.data) {
    console.log(c.dim(`dryRun: totalFound=${body.data.totalFound} processed=${body.data.processed}`))
  }
}

async function main() {
  console.log(c.head('═══════════════════════════════════════'))
  console.log(c.head('  파일럿 런타임 점검 (preflight-check)'))
  console.log(c.head(`  대상: ${BASE_URL}`))
  console.log(c.head('═══════════════════════════════════════'))

  await step7_serverHealth()
  await step8_dbConnect()
  await step5_dryRun()
  await step6_cronSecurity()

  console.log('\n' + c.head('═══════════════════════════════════════'))
  console.log(`  결과: ${passed}개 통과 / ${failed}개 실패`)
  if (failed === 0) {
    console.log('\x1b[32m  런타임 점검 모두 통과 — 정적 점검 보고서와 합산하여 최종 판정\x1b[0m')
  } else {
    console.log('\x1b[31m  런타임 점검 실패 항목 있음 — 파일럿 개시 보류\x1b[0m')
  }
  console.log(c.head('═══════════════════════════════════════'))

  process.exit(failed > 0 ? 1 : 0)
}

main()
