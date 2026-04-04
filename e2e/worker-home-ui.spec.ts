/**
 * 근로자 홈 UI 자동점검 — worker-home-ui.spec.ts
 *
 * 검증 항목:
 *  1. 하단 4탭(홈·서류·작업·노임)만 노출, TBM/작업지시/완료보고 탭 없음
 *  2. 각 탭 클릭 시 올바른 경로로 이동
 *  3. 홈에서 TBM / 작업지시 / 완료보고 바로가기 링크 제거 확인
 *  4. 문제신고 카드 토글 → 5종 유형 버튼 모두 노출
 *  5. /work 페이지 작업기록 탭 폼 필드 존재 확인
 *  6. /work 페이지 자재신청 탭 전환 및 폼 필드 존재 확인
 *  7. 작업기록 폼 최소 입력 제출 흐름 (API mock)
 *  8. 자재신청 폼 최소 입력 제출 흐름 (API mock)
 *  9. 출근 조건 미충족 시 출근 버튼 비활성화
 * 10. 모바일 viewport(390px) 기준 가로 스크롤 없음
 *
 * 테스트 워커: 01077770001 / Test2026!! (E2E전용, APPROVED)
 *
 * 실행:
 *   npx playwright test e2e/worker-home-ui.spec.ts \
 *     --config=e2e/playwright.config.ts --project=worker-home-ui
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

// ── 환경 ───────────────────────────────────────────────────────
const BASE         = process.env.BASE_URL        || 'https://attendance.haehan-ai.kr'
const WORKER_PHONE = process.env.E2E_WORKER_PHONE || '01077770001'
const WORKER_PASS  = process.env.E2E_WORKER_PASS  || 'Test2026!!'
const TOKEN_FILE   = path.join(__dirname, '..', 'logs', '.worker-e2e-token.txt')
const VP390        = { width: 390, height: 844 }

// ── Mock 헬퍼 ──────────────────────────────────────────────────
const ok   = (data: unknown) => ({ success: true,  data })
const TODAY = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10)

const WORKER_ME_DATA = {
  id: 'e2e-worker', name: 'E2E테스트', company: '(주)해한건설',
  jobTitle: '미설정', accountStatus: 'APPROVED',
  devices: [{ id: 'd-1' }],
}

const TODAY_WORKING = ok({
  id: 'a-1', siteId: 's-1', currentSiteId: 's-1',
  siteName: '테스트현장', currentSiteName: '테스트현장',
  siteAddress: '서울시 강남구 테스트로 1',
  workDate: TODAY,
  checkInAt: `${TODAY}T09:00:00+09:00`,
  checkOutAt: null, status: 'WORKING',
  checkInDistance: 5, checkOutDistance: null,
  moveEvents: [],
})

const TODAY_NULL = ok(null)

const AVAILABLE_SITES = {
  success: true,
  sites: [{
    siteId: 's-1', siteName: '테스트현장', companyId: 'c-1',
    companyName: '(주)해한건설', tradeType: null, isPrimary: true,
    allowedRadiusMeters: 100, distanceMeters: 5, withinRadius: true,
  }],
}

const ELIGIBLE_ALL_PASS = {
  success: true, eligible: true,
  conditions: [
    { key: 'account',   label: '계정 상태',  passed: true,  message: '승인됨' },
    { key: 'device',    label: '기기 승인',  passed: true,  message: '승인된 기기' },
    { key: 'site',      label: '현장 배정',  passed: true,  message: '테스트현장 배정됨' },
    { key: 'docs',      label: '필수 서류',  passed: true,  message: '5/5 완료' },
    { key: 'gps',       label: 'GPS 위치',   passed: true,  message: '반경 내 (5m)' },
    { key: 'time',      label: '출근 시간',  passed: true,  message: '시간 제한 없음' },
    { key: 'duplicate', label: '중복 출근',  passed: true,  message: '출근 가능' },
  ],
}

const ELIGIBLE_DOCS_FAIL = {
  success: true, eligible: false,
  conditions: [
    { key: 'account',   label: '계정 상태',  passed: true,  message: '승인됨' },
    { key: 'device',    label: '기기 승인',  passed: true,  message: '승인된 기기' },
    { key: 'site',      label: '현장 배정',  passed: true,  message: '테스트현장 배정됨' },
    { key: 'docs',      label: '필수 서류',  passed: false, message: '미제출 2건' },
    { key: 'gps',       label: 'GPS 위치',   passed: true,  message: '반경 내 (5m)' },
    { key: 'time',      label: '출근 시간',  passed: true,  message: '시간 제한 없음' },
    { key: 'duplicate', label: '중복 출근',  passed: true,  message: '출근 가능' },
  ],
}

// ── 실제 워커 토큰 발급 ────────────────────────────────────────
let _workerTokenCache: string | null = null

async function fetchWorkerToken(): Promise<string> {
  if (_workerTokenCache) return _workerTokenCache

  // 파일 캐시 확인
  if (fs.existsSync(TOKEN_FILE)) {
    const raw = fs.readFileSync(TOKEN_FILE, 'utf-8').trim()
    if (raw) {
      try {
        const parts = raw.split('.')
        if (parts.length === 3) {
          const p = JSON.parse(Buffer.from(parts[1] + '==', 'base64').toString())
          if (p.exp * 1000 > Date.now() + 60000) {
            _workerTokenCache = raw
            return raw
          }
        }
      } catch { /* fall through */ }
    }
  }

  // 실제 로그인
  const res = await fetch(`${BASE}/api/auth/worker-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: WORKER_PHONE, password: WORKER_PASS }),
  })
  const cookies = res.headers.get('set-cookie') ?? ''
  const m = cookies.match(/worker_token=([^;]+)/)
  if (!m) throw new Error(`워커 로그인 실패: ${res.status}`)

  _workerTokenCache = m[1]
  fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true })
  fs.writeFileSync(TOKEN_FILE, _workerTokenCache)
  return _workerTokenCache
}

// ── 워커 세션 주입 ─────────────────────────────────────────────
async function injectWorker(ctx: BrowserContext) {
  let token: string
  try {
    token = await fetchWorkerToken()
  } catch (e) {
    test.skip(true, `워커 인증 실패: ${(e as Error).message}`)
    return
  }
  const host = new URL(BASE).hostname
  await ctx.addCookies([{
    name: 'worker_token', value: token,
    domain: host, path: '/',
    httpOnly: true, secure: true, sameSite: 'Lax',
  }])
}

// ── 공통 API mock 등록 ─────────────────────────────────────────
async function mockWorkerAPIs(page: Page, opts: {
  todayData?: unknown
  eligibility?: unknown
} = {}) {
  const todayPayload = opts.todayData   ?? TODAY_NULL
  const eligPayload  = opts.eligibility ?? ELIGIBLE_ALL_PASS

  // /api/auth/me — 실제 서버에 위임 (실제 워커 토큰 사용)
  await page.route(`${BASE}/api/attendance/today`, r =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(todayPayload) }))

  await page.route(`${BASE}/api/attendance/available-sites**`, r =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(AVAILABLE_SITES) }))

  await page.route(`${BASE}/api/attendance/eligibility**`, r =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(eligPayload) }))

  await page.route(`${BASE}/api/attendance/presence/my-pending`, r =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(ok({ item: null })) }))

  await page.route(`${BASE}/api/attendance/history**`, r =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(ok({ items: [], total: 0 })) }))
}

// ── 가로 스크롤 검사 ───────────────────────────────────────────
async function checkNoHScroll(page: Page) {
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth
  )
  expect(overflow, '가로 스크롤 발생').toBe(false)
}

// ── 페이지 로딩 대기 ───────────────────────────────────────────
async function waitForWorkerPage(page: Page) {
  // 로그인 리디렉션 없이 네비 로딩 확인
  await page.waitForFunction(
    () => !window.location.pathname.startsWith('/login') &&
          !window.location.pathname.startsWith('/m/login') &&
          !window.location.pathname.startsWith('/register'),
    { timeout: 8000 }
  ).catch(() => {})
  await page.waitForSelector('nav.fixed.bottom-0', { timeout: 10000 })
}

// ════════════════════════════════════════════════════════════════
//  TEST SUITE 1: 홈 화면 (attendance)
// ════════════════════════════════════════════════════════════════

test.describe('근로자 홈 — 4탭 네비 / 출근화면', () => {

  test('1. 하단 4탭만 노출 — TBM/작업지시/완료보고 탭 없음', async ({ browser }) => {
    const ctx  = await browser.newContext({ viewport: VP390 })
    const page = await ctx.newPage()
    await injectWorker(ctx)
    await mockWorkerAPIs(page)

    await page.goto(`${BASE}/attendance`)
    await waitForWorkerPage(page)

    const nav = page.locator('nav.fixed.bottom-0')
    // 4탭 존재
    await expect(nav.getByText('홈')).toBeVisible()
    await expect(nav.getByText('서류')).toBeVisible()
    await expect(nav.getByText('작업')).toBeVisible()
    await expect(nav.getByText('노임')).toBeVisible()
    // 정확히 4개
    await expect(nav.locator('button')).toHaveCount(4)
    // 제거된 탭 없음
    await expect(nav.getByText('TBM')).toHaveCount(0)
    await expect(nav.getByText('작업지시')).toHaveCount(0)
    await expect(nav.getByText('완료보고')).toHaveCount(0)
    await expect(nav.getByText('출퇴근')).toHaveCount(0)

    await ctx.close()
  })

  test('2. 각 탭 클릭 시 올바른 경로로 이동', async ({ browser }) => {
    const ctx  = await browser.newContext({ viewport: VP390 })
    const page = await ctx.newPage()
    await injectWorker(ctx)
    await mockWorkerAPIs(page)

    // 서류 탭 mock
    await page.route(`${BASE}/api/my/documents`, r =>
      r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(ok({ package: null, documents: [] })) }))
    // 노임 탭 mock
    await page.route(`${BASE}/api/attendance/monthly**`, r =>
      r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(ok({ days: [], summary: {} })) }))
    await page.route(`${BASE}/api/wage/my-payslip**`, r =>
      r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(ok({ days: [], summary: {} })) }))

    await page.goto(`${BASE}/attendance`)
    await waitForWorkerPage(page)
    const nav = page.locator('nav.fixed.bottom-0')

    // 서류 탭 → /my/onboarding
    await nav.getByText('서류').click()
    await expect(page).toHaveURL(/\/my\/onboarding/, { timeout: 5000 })

    // 작업 탭 → /work
    await nav.getByText('작업').click()
    await expect(page).toHaveURL(/\/work/, { timeout: 5000 })

    // 노임 탭 → /wage
    await nav.getByText('노임').click()
    await expect(page).toHaveURL(/\/wage/, { timeout: 5000 })

    // 홈 탭 → /attendance
    await nav.getByText('홈').click()
    await expect(page).toHaveURL(/\/attendance/, { timeout: 5000 })

    await ctx.close()
  })

  test('3. 홈에서 TBM / 작업지시 / 완료보고 바로가기 링크 없음 (근무 중 상태)', async ({ browser }) => {
    const ctx  = await browser.newContext({ viewport: VP390 })
    const page = await ctx.newPage()
    await injectWorker(ctx)
    await mockWorkerAPIs(page, { todayData: TODAY_WORKING })

    await page.goto(`${BASE}/attendance`)
    await waitForWorkerPage(page)

    await expect(page.locator('a[href="/tbm"]')).toHaveCount(0)
    await expect(page.locator('a[href="/work-orders"]')).toHaveCount(0)
    await expect(page.locator('a[href="/work-complete"]')).toHaveCount(0)
    // 작업기록 바로가기는 있어야 함
    await expect(page.locator('a[href="/work"]')).toBeVisible()

    await ctx.close()
  })

  test('4. 문제신고 카드 토글 → 5종 유형 버튼 모두 노출', async ({ browser }) => {
    const ctx  = await browser.newContext({ viewport: VP390 })
    const page = await ctx.newPage()
    await injectWorker(ctx)
    await mockWorkerAPIs(page)

    await page.goto(`${BASE}/attendance`)
    await waitForWorkerPage(page)

    // 문제신고 카드 클릭 (토글 열기)
    await page.getByText('문제신고').click()

    // 5종 버튼 확인
    await expect(page.getByRole('button', { name: '출근누락' })).toBeVisible()
    await expect(page.getByRole('button', { name: '퇴근누락' })).toBeVisible()
    await expect(page.getByRole('button', { name: '위치이탈' })).toBeVisible()
    await expect(page.getByRole('button', { name: '안전·건강이상' })).toBeVisible()
    await expect(page.getByRole('button', { name: '사고/아차사고' })).toBeVisible()

    await ctx.close()
  })

  test('9. 출근 조건 미충족 시 출근 버튼 비활성화', async ({ browser }) => {
    const ctx  = await browser.newContext({ viewport: VP390 })
    const page = await ctx.newPage()
    await injectWorker(ctx)
    await mockWorkerAPIs(page, { eligibility: ELIGIBLE_DOCS_FAIL })

    await page.goto(`${BASE}/attendance`)
    await waitForWorkerPage(page)
    await page.waitForTimeout(1500) // eligibility 로딩 대기

    // "조건 미충족" 텍스트 버튼 또는 disabled 버튼
    const matchBtn = page.getByRole('button', { name: /출근하기|조건 미충족/ })
    await expect(matchBtn.first()).toBeVisible()
    const isDisabled = await matchBtn.first().isDisabled().catch(() => false)
    const btnText    = await matchBtn.first().textContent().catch(() => '')
    expect(
      isDisabled || (btnText ?? '').includes('조건 미충족'),
      '출근 버튼이 비활성화 또는 "조건 미충족" 텍스트여야 함'
    ).toBe(true)

    await ctx.close()
  })

  test('10-A. 홈 화면 390px 가로 스크롤 없음', async ({ browser }) => {
    const ctx  = await browser.newContext({ viewport: VP390 })
    const page = await ctx.newPage()
    await injectWorker(ctx)
    await mockWorkerAPIs(page)

    await page.goto(`${BASE}/attendance`)
    await waitForWorkerPage(page)
    await checkNoHScroll(page)

    await ctx.close()
  })
})

// ════════════════════════════════════════════════════════════════
//  TEST SUITE 2: /work 페이지 (미들웨어 비보호 — mock만으로 가능)
// ════════════════════════════════════════════════════════════════

test.describe('근로자 /work 페이지 — 작업기록 / 자재신청', () => {

  async function openWork(browser: Parameters<typeof browser.newContext>[0] extends infer T ? T : never, b: typeof browser) {
    const ctx  = await b.newContext({ viewport: VP390 })
    const page = await ctx.newPage()
    await injectWorker(ctx)
    await page.route(`${BASE}/api/attendance/today`, r =>
      r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(TODAY_WORKING) }))
    return { ctx, page }
  }

  test('5. 작업기록 탭 — 폼 필드 존재 (사진·작업내용·문제사항·전달사항)', async ({ browser }) => {
    const { ctx, page } = await openWork(undefined as never, browser)
    await page.goto(`${BASE}/work`)
    await page.waitForSelector('nav.fixed.bottom-0', { timeout: 10000 })

    await expect(page.getByRole('button', { name: '작업기록' })).toBeVisible()
    await expect(page.getByPlaceholder('한 줄로 입력')).toBeVisible()
    await expect(page.getByPlaceholder('이상 있을 때만 입력')).toBeVisible()
    await expect(page.getByPlaceholder('전달할 내용 한 줄')).toBeVisible()
    await expect(page.locator('button').filter({ hasText: '+' })).toBeVisible()

    await ctx.close()
  })

  test('6. 자재신청 탭 전환 — 폼 필드 존재 (품목·메모·수량·긴급)', async ({ browser }) => {
    const { ctx, page } = await openWork(undefined as never, browser)
    await page.goto(`${BASE}/work`)
    await page.waitForSelector('nav.fixed.bottom-0', { timeout: 10000 })

    await page.getByRole('button', { name: '자재신청' }).click()

    await expect(page.getByPlaceholder('필요한 자재 이름')).toBeVisible()
    await expect(page.getByPlaceholder('규격, 색상 등 간단히')).toBeVisible()
    await expect(page.getByRole('spinbutton')).toBeVisible()
    await expect(page.getByRole('button', { name: /긴급/ })).toBeVisible()

    await ctx.close()
  })

  test('7. 작업기록 최소 입력 제출 → 성공 메시지', async ({ browser }) => {
    const { ctx, page } = await openWork(undefined as never, browser)

    await page.route(`${BASE}/api/worker/daily-reports`, r => {
      if (r.request().method() === 'POST') {
        return r.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify(ok({ id: 'dr-1', siteId: 's-1' })) })
      }
      return r.continue()
    })
    await page.route(`${BASE}/api/worker/daily-reports/photos/upload`, r =>
      r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(ok({ id: 'p-1' })) }))

    await page.goto(`${BASE}/work`)
    await page.waitForSelector('nav.fixed.bottom-0', { timeout: 10000 })

    await page.getByPlaceholder('한 줄로 입력').fill('외벽 타일 시공')
    await page.getByRole('button', { name: '작업기록 저장' }).click()

    await expect(page.getByText('작업기록이 저장되었습니다.')).toBeVisible({ timeout: 6000 })

    await ctx.close()
  })

  test('8. 자재신청 최소 입력 제출 → 성공 메시지', async ({ browser }) => {
    const { ctx, page } = await openWork(undefined as never, browser)

    await page.route(`${BASE}/api/worker/materials/requests`, r => {
      if (r.request().method() === 'POST') {
        return r.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify(ok({ id: 'mr-1', requestNo: 'MAT-001' })) })
      }
      return r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(ok([])) })
    })

    await page.goto(`${BASE}/work`)
    await page.waitForSelector('nav.fixed.bottom-0', { timeout: 10000 })

    await page.getByRole('button', { name: '자재신청' }).click()
    await page.getByPlaceholder('필요한 자재 이름').fill('안전모 L사이즈')
    // 자재신청 제출 버튼은 탭 버튼과 같은 label이므로 last() 사용
    const submitBtn = page.getByRole('button', { name: '자재신청' }).last()
    await submitBtn.click()

    await expect(page.getByText('자재신청이 접수되었습니다.')).toBeVisible({ timeout: 6000 })

    await ctx.close()
  })

  test('10-B. /work 페이지 390px 가로 스크롤 없음', async ({ browser }) => {
    const { ctx, page } = await openWork(undefined as never, browser)
    await page.goto(`${BASE}/work`)
    await page.waitForSelector('nav.fixed.bottom-0', { timeout: 10000 })
    await checkNoHScroll(page)

    await page.getByRole('button', { name: '자재신청' }).click()
    await checkNoHScroll(page)

    await ctx.close()
  })
})
