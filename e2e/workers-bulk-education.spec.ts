/**
 * 근로자 안전교육 일괄 등록 E2E 검증
 *
 * 검증:
 *   1. APPROVED + 미교육자만 체크박스 노출 (이미 이수한 근로자 / 미승인 근로자에는 없음)
 *   2. 2건 선택 → 안전교육 일괄 등록 → 선택 해제 + 재조회
 *   3. 처리 중 버튼 disabled
 *   4. 선택 해제 버튼으로 툴바 즉시 제거
 *   5. 모바일: 카드 체크박스 + 일괄 등록
 *
 * 실행:
 *   npx playwright test e2e/workers-bulk-education.spec.ts --config=e2e/playwright.config.ts --project=chromium
 */
import { test, expect, type Page, type Route } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const BASE = process.env.BASE_URL || 'https://attendance.haehan-ai.kr'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'jay@haehan-ai.kr'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234'

const SCREENSHOT_DIR = path.join(__dirname, '..', 'logs', 'screenshots', 'workers-bulk-education')
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })

// ── 인증 ──
let _tokenCache: string | null = null
const TOKEN_FILE = path.join(__dirname, '..', 'logs', '.admin-token.txt')

async function fetchAdminToken(): Promise<string> {
  if (process.env.ADMIN_JWT) return process.env.ADMIN_JWT
  if (_tokenCache) return _tokenCache
  if (fs.existsSync(TOKEN_FILE)) {
    const raw = fs.readFileSync(TOKEN_FILE, 'utf-8').trim()
    if (raw) {
      try {
        const payload = JSON.parse(Buffer.from(raw.split('.')[1], 'base64').toString())
        if (payload.exp * 1000 > Date.now()) { _tokenCache = raw; return _tokenCache }
      } catch { /* fall through */ }
    }
  }
  const res = await fetch(`${BASE}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  })
  const setCookie = res.headers.get('set-cookie') || ''
  const match = setCookie.match(/admin_token=([^;]+)/)
  if (!match) throw new Error(`admin 로그인 실패: ${res.status}`)
  _tokenCache = match[1]
  fs.writeFileSync(TOKEN_FILE, _tokenCache)
  return _tokenCache
}

async function ensureAdmin(page: Page) {
  let token: string
  try { token = await fetchAdminToken() }
  catch (e) { test.skip(true, `admin 인증 실패: ${(e as Error).message}`); return }
  await page.context().addCookies([{
    name: 'admin_token', value: token,
    domain: new URL(BASE).hostname, path: '/',
    httpOnly: true, secure: true, sameSite: 'Lax' as const,
  }])
}

// ── 목 데이터 ──
const TODAY = new Date().toISOString().slice(0, 10)

function makeWorker(overrides: {
  id: string; name: string; accountStatus: string; hasSafetyEducation: boolean
}) {
  return {
    id: overrides.id,
    name: overrides.name,
    phone: '01012345678',
    jobTitle: '철근공',
    isActive: true,
    accountStatus: overrides.accountStatus,
    birthDate: '19900101',
    foreignerYn: false,
    employmentType: 'DAILY_CONSTRUCTION',
    organizationType: 'DIRECT',
    deviceCount: 0,
    retirementMutualStatus: 'NONE',
    createdAt: TODAY,
    primaryCompany: { id: 'c1', companyName: '테스트업체' },
    activeSites: [{ id: 's1', name: '테스트현장', isPrimary: true }],
    todayAttendance: null,
    hasContract: true,
    contractDate: TODAY,
    hasSafetyCert: true,
    safetyCertDate: TODAY,
    hasSafetyEducation: overrides.hasSafetyEducation,
    safetyEducationDate: overrides.hasSafetyEducation ? TODAY : null,
    dailyWage: 150000,
    monthWage: 3000000,
    totalWage: 3000000,
  }
}

const W_EDU_MISSING_1 = makeWorker({ id: 'w-e1', name: '근로자A', accountStatus: 'APPROVED', hasSafetyEducation: false })
const W_EDU_MISSING_2 = makeWorker({ id: 'w-e2', name: '근로자B', accountStatus: 'APPROVED', hasSafetyEducation: false })
const W_EDU_DONE      = makeWorker({ id: 'w-d1', name: '근로자C', accountStatus: 'APPROVED', hasSafetyEducation: true })
const W_PENDING       = makeWorker({ id: 'w-p1', name: '근로자D', accountStatus: 'PENDING',  hasSafetyEducation: false })

function mockListResp(items: ReturnType<typeof makeWorker>[]) {
  return {
    success: true,
    data: { items, total: items.length, page: 1, pageSize: 300, totalPages: 1 },
  }
}

async function interceptBulk(page: Page, delay = 0) {
  await page.route('**/api/admin/workers/bulk', async (route: Route) => {
    if (delay) await new Promise(r => setTimeout(r, delay))
    const body = JSON.parse(route.request().postData() || '{}')
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { succeeded: body.ids?.length ?? 1, failed: 0, failedItems: [] } }),
    })
  })
}

async function interceptSites(page: Page) {
  await page.route('**/api/admin/sites**', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { items: [] } }) })
  })
}

async function goToPage(page: Page) {
  await page.goto(`${BASE}/admin/workers`)
  await page.waitForLoadState('networkidle')
}

// ─────────────────────────────────────────────────────────
// 데스크탑 (기본 1280px — 테이블 뷰)
// ─────────────────────────────────────────────────────────
test.describe('workers 안전교육 일괄 등록 [데스크탑]', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAdmin(page)
    page.on('dialog', dialog => dialog.accept())
    await interceptSites(page)
  })

  // 교육 선택용 체크박스: "안전교육" 컬럼 안에 있는 checkbox
  const eduCBs = (page: Page) =>
    page.locator('table tbody input[type="checkbox"][class*="accent-\\[\\#2563EB\\]"]')

  test('APPROVED+미교육자만 교육 체크박스, 이미이수/미승인에는 없음', async ({ page }) => {
    await page.route('**/api/admin/workers?**', async (route: Route) => {
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(mockListResp([W_EDU_MISSING_1, W_EDU_MISSING_2, W_EDU_DONE, W_PENDING])) })
    })
    await goToPage(page)

    // APPROVED + 미교육 2건만 체크박스
    await expect(eduCBs(page)).toHaveCount(2)
    // 이수 완료 행에는 체크박스 없음
    await expect(page.locator(`table tbody tr:has-text("근로자C") input[type="checkbox"][class*="accent-\\[\\#2563EB\\]"]`)).toHaveCount(0)
    // PENDING 근로자에는 체크박스 없음
    await expect(page.locator(`table tbody tr:has-text("근로자D") input[type="checkbox"][class*="accent-\\[\\#2563EB\\]"]`)).toHaveCount(0)
  })

  test('2건 선택 → 일괄 등록 → 선택 해제 + 재조회', async ({ page }) => {
    await interceptBulk(page)
    let call = 0
    await page.route('**/api/admin/workers?**', async (route: Route) => {
      call++
      const items = call <= 1
        ? [W_EDU_MISSING_1, W_EDU_MISSING_2, W_EDU_DONE]
        : [makeWorker({ ...W_EDU_MISSING_1, hasSafetyEducation: true }),
           makeWorker({ ...W_EDU_MISSING_2, hasSafetyEducation: true }),
           W_EDU_DONE]
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(mockListResp(items)) })
    })
    await goToPage(page)

    await eduCBs(page).nth(0).check()
    await eduCBs(page).nth(1).check()
    await expect(page.locator('text=2건 선택됨')).toBeVisible()

    await page.click('button:has-text("안전교육 일괄 등록")')
    await expect(page.locator('text=안전교육 일괄 등록 완료')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=건 선택됨')).not.toBeVisible()
    await expect(eduCBs(page)).toHaveCount(0)
  })

  test('eduSaving 중 버튼 disabled', async ({ page }) => {
    await interceptBulk(page, 800)
    await page.route('**/api/admin/workers?**', async (route: Route) => {
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(mockListResp([W_EDU_MISSING_1, W_EDU_MISSING_2])) })
    })
    await goToPage(page)

    await eduCBs(page).nth(0).check()
    await page.click('button:has-text("안전교육 일괄 등록")')

    const processingBtn = page.locator('button:has-text("처리 중...")')
    await expect(processingBtn.first()).toBeDisabled()
    await expect(page.locator('text=안전교육 일괄 등록 완료')).toBeVisible({ timeout: 5000 })
  })

  test('선택 해제 버튼으로 툴바 즉시 제거', async ({ page }) => {
    await page.route('**/api/admin/workers?**', async (route: Route) => {
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(mockListResp([W_EDU_MISSING_1])) })
    })
    await goToPage(page)

    await eduCBs(page).nth(0).check()
    await expect(page.locator('text=1건 선택됨')).toBeVisible()
    await page.click('button:has-text("선택 해제")')
    await expect(page.locator('text=건 선택됨')).not.toBeVisible()
  })
})

// ─────────────────────────────────────────────────────────
// 모바일 (390px — 카드 뷰)
// ─────────────────────────────────────────────────────────
test.describe('workers 안전교육 일괄 등록 [모바일]', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test.beforeEach(async ({ page }) => {
    await ensureAdmin(page)
    page.on('dialog', dialog => dialog.accept())
    await interceptSites(page)
  })

  const cardEduCBs = (page: Page) =>
    page.locator('label').filter({ hasText: '안전교육 선택' }).locator('input[type="checkbox"]')

  test('모바일: APPROVED+미교육 카드에만 체크박스 + 일괄 등록', async ({ page }) => {
    await interceptBulk(page)
    let call = 0
    await page.route('**/api/admin/workers?**', async (route: Route) => {
      call++
      const items = call <= 1
        ? [W_EDU_MISSING_1, W_EDU_MISSING_2, W_EDU_DONE]
        : [makeWorker({ ...W_EDU_MISSING_1, hasSafetyEducation: true }),
           makeWorker({ ...W_EDU_MISSING_2, hasSafetyEducation: true }),
           W_EDU_DONE]
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(mockListResp(items)) })
    })
    await goToPage(page)

    await expect(cardEduCBs(page)).toHaveCount(2)

    await cardEduCBs(page).nth(0).check()
    await cardEduCBs(page).nth(1).check()
    await expect(page.locator('text=2건 선택됨')).toBeVisible()
    await page.click('button:has-text("안전교육 일괄 등록")')
    await expect(page.locator('text=안전교육 일괄 등록 완료')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=건 선택됨')).not.toBeVisible()
    await expect(cardEduCBs(page)).toHaveCount(0)
  })
})
