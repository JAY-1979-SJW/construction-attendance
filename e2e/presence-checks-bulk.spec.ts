/**
 * presence-checks REVIEW_REQUIRED 대량 승인/이탈확정 E2E 검증
 *
 * 레이아웃:
 *   - sm 미만: MobileCard (label > checkbox) — 모바일 뷰
 *   - sm 이상: <table> (tbody td > checkbox) — 데스크탑 뷰
 *
 * 검증:
 *   1. REVIEW_REQUIRED 행에만 체크박스 노출
 *   2. COMPLETED 행에는 체크박스 없음
 *   3. 2건 선택 → 대량 승인 → 선택 해제 + 재조회
 *   4. 1건 선택 → 대량 이탈확정 → 선택 해제 + 재조회
 *   5. bulkProcessing 중 버튼 disabled
 *   6. 선택 해제 버튼으로 툴바 즉시 제거
 *   7. 모바일: 카드 체크박스 + 대량 승인
 *
 * 실행:
 *   npx playwright test e2e/presence-checks-bulk.spec.ts --config=e2e/playwright.config.ts --project=chromium
 */
import { test, expect, type Page, type Route } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const BASE = process.env.BASE_URL || 'https://attendance.haehan-ai.kr'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'jay@haehan-ai.kr'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234'

const SCREENSHOT_DIR = path.join(__dirname, '..', 'logs', 'screenshots', 'presence-checks-bulk')
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

function makePC(overrides: { id: string; status: string; workerName: string }) {
  return {
    id: overrides.id,
    workerId: 'w1',
    workerName: overrides.workerName,
    workerCompany: '테스트업체',
    siteId: 's1',
    siteName: '테스트현장',
    slot: 'AM' as const,
    checkDate: TODAY,
    scheduledAt: `${TODAY}T08:00:00.000Z`,
    expiresAt: `${TODAY}T08:30:00.000Z`,
    status: overrides.status,
    respondedAt: null,
    distanceMeters: 30,
    accuracyMeters: 10,
    needsReview: overrides.status === 'REVIEW_REQUIRED',
    reviewReason: overrides.status === 'REVIEW_REQUIRED' ? 'OUT_OF_GEOFENCE' : null,
    adminNote: null,
    reviewedBy: null,
    reviewedAt: null,
    reissueCount: 0,
  }
}

const PC_REVIEW_1  = makePC({ id: 'pc-r1', status: 'REVIEW_REQUIRED', workerName: '근로자A' })
const PC_REVIEW_2  = makePC({ id: 'pc-r2', status: 'REVIEW_REQUIRED', workerName: '근로자B' })
const PC_COMPLETED = makePC({ id: 'pc-c1', status: 'COMPLETED',       workerName: '근로자C' })

function mockListResp(items: ReturnType<typeof makePC>[]) {
  const review = items.filter(i => i.status === 'REVIEW_REQUIRED').length
  return {
    success: true,
    data: {
      items,
      summary: {
        total: items.length, completed: items.filter(i => i.status === 'COMPLETED').length,
        pending: 0, noResponse: 0, outOfFence: 0, review, needsReview: review,
      },
    },
  }
}

async function interceptBulk(page: Page, delay = 0) {
  await page.route('**/api/admin/presence-checks/bulk', async (route: Route) => {
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
  await page.goto(`${BASE}/admin/presence-checks`)
  await page.waitForLoadState('networkidle')
}

// ─────────────────────────────────────────────────────────
// 데스크탑 (기본 1280px — 테이블 뷰)
// ─────────────────────────────────────────────────────────
test.describe('presence-checks 대량 처리 [데스크탑]', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAdmin(page)
    page.on('dialog', dialog => dialog.accept())
    await interceptSites(page)
  })

  const tableBodyCBs = (page: Page) => page.locator('table tbody input[type="checkbox"]')

  test('REVIEW_REQUIRED 행에만 체크박스, COMPLETED 행에는 없음', async ({ page }) => {
    await page.route('**/api/admin/presence-checks?**', async (route: Route) => {
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(mockListResp([PC_REVIEW_1, PC_REVIEW_2, PC_COMPLETED])) })
    })
    await goToPage(page)

    await expect(tableBodyCBs(page)).toHaveCount(2)
    await expect(page.locator('table tbody tr:has-text("근로자C") input[type="checkbox"]')).toHaveCount(0)
  })

  test('2건 선택 → 대량 승인 → 선택 해제 + 재조회', async ({ page }) => {
    await interceptBulk(page)
    let call = 0
    await page.route('**/api/admin/presence-checks?**', async (route: Route) => {
      call++
      const items = call <= 1 ? [PC_REVIEW_1, PC_REVIEW_2, PC_COMPLETED] : [PC_COMPLETED]
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(mockListResp(items)) })
    })
    await goToPage(page)

    await tableBodyCBs(page).nth(0).check()
    await tableBodyCBs(page).nth(1).check()
    await expect(page.locator('text=2건 선택됨')).toBeVisible()

    await page.click('button:has-text("대량 승인")')
    await expect(page.locator('text=대량 승인 완료')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=건 선택됨')).not.toBeVisible()
    await expect(tableBodyCBs(page)).toHaveCount(0)
  })

  test('1건 선택 → 대량 이탈확정 → 선택 해제 + 재조회', async ({ page }) => {
    await interceptBulk(page)
    let call = 0
    await page.route('**/api/admin/presence-checks?**', async (route: Route) => {
      call++
      const items = call <= 1 ? [PC_REVIEW_1, PC_COMPLETED] : [PC_COMPLETED]
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(mockListResp(items)) })
    })
    await goToPage(page)

    await tableBodyCBs(page).nth(0).check()
    await expect(page.locator('text=1건 선택됨')).toBeVisible()

    await page.click('button:has-text("대량 이탈확정")')
    await expect(page.locator('text=대량 이탈 확정 완료')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=건 선택됨')).not.toBeVisible()
    await expect(tableBodyCBs(page)).toHaveCount(0)
  })

  test('bulkProcessing 중 두 버튼 disabled', async ({ page }) => {
    await interceptBulk(page, 800)
    await page.route('**/api/admin/presence-checks?**', async (route: Route) => {
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(mockListResp([PC_REVIEW_1, PC_REVIEW_2])) })
    })
    await goToPage(page)

    await tableBodyCBs(page).nth(0).check()
    await page.click('button:has-text("대량 승인")')

    const processingBtns = page.locator('button:has-text("처리 중...")')
    await expect(processingBtns.first()).toBeDisabled()
    await expect(processingBtns).toHaveCount(2)
    await expect(page.locator('text=대량 승인 완료')).toBeVisible({ timeout: 5000 })
  })

  test('선택 해제 버튼으로 툴바 즉시 제거', async ({ page }) => {
    await page.route('**/api/admin/presence-checks?**', async (route: Route) => {
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(mockListResp([PC_REVIEW_1])) })
    })
    await goToPage(page)

    await tableBodyCBs(page).nth(0).check()
    await expect(page.locator('text=1건 선택됨')).toBeVisible()
    await page.click('button:has-text("선택 해제")')
    await expect(page.locator('text=건 선택됨')).not.toBeVisible()
  })
})

// ─────────────────────────────────────────────────────────
// 모바일 (390px — 카드 뷰)
// ─────────────────────────────────────────────────────────
test.describe('presence-checks 대량 처리 [모바일]', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test.beforeEach(async ({ page }) => {
    await ensureAdmin(page)
    page.on('dialog', dialog => dialog.accept())
    await interceptSites(page)
  })

  const cardCBs = (page: Page) =>
    page.locator('label').filter({ hasText: '선택' }).locator('input[type="checkbox"]')

  test('모바일: REVIEW_REQUIRED 카드에만 체크박스 + 2건 대량 승인', async ({ page }) => {
    await interceptBulk(page)
    let call = 0
    await page.route('**/api/admin/presence-checks?**', async (route: Route) => {
      call++
      const items = call <= 1 ? [PC_REVIEW_1, PC_REVIEW_2, PC_COMPLETED] : [PC_COMPLETED]
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(mockListResp(items)) })
    })
    await goToPage(page)

    await expect(cardCBs(page)).toHaveCount(2)

    await cardCBs(page).nth(0).check()
    await cardCBs(page).nth(1).check()
    await expect(page.locator('text=2건 선택됨')).toBeVisible()
    await page.click('button:has-text("대량 승인")')
    await expect(page.locator('text=대량 승인 완료')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=건 선택됨')).not.toBeVisible()
    await expect(cardCBs(page)).toHaveCount(0)
  })
})
