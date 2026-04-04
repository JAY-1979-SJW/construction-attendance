/**
 * 기기 등록/변경 요청 PENDING 대량 승인/반려 E2E 검증
 *
 * 검증:
 *   1. PENDING 행에만 체크박스 노출
 *   2. 전체 선택/해제 (thead 체크박스)
 *   3. 2건 선택 → 대량 승인 → 선택 해제 + 재조회
 *   4. 2건 선택 → 대량 반려 모달 → 사유 입력 → 반려 → 선택 해제 + 재조회
 *   5. bulkSaving 중 버튼 disabled
 *   6. 선택 해제 버튼으로 툴바 즉시 제거
 *   7. 모바일: 카드 체크박스 + 대량 승인/반려
 *
 * 실행:
 *   npx playwright test e2e/device-requests-bulk.spec.ts --config=e2e/playwright.config.ts --project=chromium
 */
import { test, expect, type Page, type Route } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const BASE = process.env.BASE_URL || 'https://attendance.haehan-ai.kr'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'jay@haehan-ai.kr'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234'

const SCREENSHOT_DIR = path.join(__dirname, '..', 'logs', 'screenshots', 'device-requests-bulk')
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
function makeReq(overrides: { id: string; status: string; workerName: string; oldDeviceToken?: string | null }) {
  return {
    id: overrides.id,
    workerName: overrides.workerName,
    workerPhone: '01012345678',
    company: '테스트업체',
    oldDeviceToken: overrides.oldDeviceToken ?? null,
    newDeviceName: 'Galaxy S24',
    reason: '기기 분실',
    status: overrides.status,
    requestedAt: new Date().toISOString(),
    processedAt: null,
  }
}

const REQ_PENDING_1 = makeReq({ id: 'dr-p1', status: 'PENDING', workerName: '근로자A' })
const REQ_PENDING_2 = makeReq({ id: 'dr-p2', status: 'PENDING', workerName: '근로자B', oldDeviceToken: 'old-token-2' })
const REQ_APPROVED  = makeReq({ id: 'dr-a1', status: 'APPROVED', workerName: '근로자C' })

function mockListResp(items: ReturnType<typeof makeReq>[]) {
  return { success: true, data: { items, total: items.length, page: 1, pageSize: 20, totalPages: 1 } }
}

async function interceptBulk(page: Page, delay = 0) {
  await page.route('**/api/admin/device-requests/bulk', async (route: Route) => {
    if (delay) await new Promise(r => setTimeout(r, delay))
    const body = JSON.parse(route.request().postData() || '{}')
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { succeeded: body.ids?.length ?? 1, failed: 0, failedItems: [] } }),
    })
  })
}

async function goToPage(page: Page, status = 'PENDING') {
  await page.route(`**/api/admin/device-requests?status=${status}`, async (route: Route) => {
    const items = status === 'PENDING' ? [REQ_PENDING_1, REQ_PENDING_2] : [REQ_APPROVED]
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockListResp(items)) })
  })
  await page.goto(`${BASE}/admin/device-requests`)
  await page.waitForLoadState('networkidle')
}

// ─────────────────────────────────────────────────────────
// 데스크탑 (1280px — 테이블 뷰)
// ─────────────────────────────────────────────────────────
test.describe('device-requests 대량 승인/반려 [데스크탑]', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAdmin(page)
    page.on('dialog', dialog => dialog.accept())
  })

  const tableBodyCBs = (page: Page) => page.locator('table tbody input[type="checkbox"]')

  test('PENDING 행에만 체크박스 노출', async ({ page }) => {
    await goToPage(page)
    await expect(tableBodyCBs(page)).toHaveCount(2)
  })

  test('전체 선택 (thead 체크박스)', async ({ page }) => {
    await goToPage(page)
    await page.locator('table thead input[type="checkbox"]').check()
    await expect(page.locator('text=2건 선택됨')).toBeVisible()
    await page.locator('table thead input[type="checkbox"]').uncheck()
    await expect(page.locator('text=건 선택됨')).not.toBeVisible()
  })

  test('2건 선택 → 대량 승인 → 선택 해제 + 재조회', async ({ page }) => {
    await interceptBulk(page)
    let call = 0
    await page.route('**/api/admin/device-requests?status=PENDING', async (route: Route) => {
      call++
      const items = call <= 1 ? [REQ_PENDING_1, REQ_PENDING_2] : []
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockListResp(items)) })
    })
    await page.goto(`${BASE}/admin/device-requests`)
    await page.waitForLoadState('networkidle')

    await tableBodyCBs(page).nth(0).check()
    await tableBodyCBs(page).nth(1).check()
    await expect(page.locator('text=2건 선택됨')).toBeVisible()

    await page.click('button:has-text("대량 승인")')
    await expect(page.locator('text=대량 승인 완료')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=건 선택됨')).not.toBeVisible()
  })

  test('2건 선택 → 대량 반려 모달 → 사유 입력 → 반려', async ({ page }) => {
    await interceptBulk(page)
    let call = 0
    await page.route('**/api/admin/device-requests?status=PENDING', async (route: Route) => {
      call++
      const items = call <= 1 ? [REQ_PENDING_1, REQ_PENDING_2] : []
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockListResp(items)) })
    })
    await page.goto(`${BASE}/admin/device-requests`)
    await page.waitForLoadState('networkidle')

    await tableBodyCBs(page).nth(0).check()
    await tableBodyCBs(page).nth(1).check()

    await page.click('button:has-text("대량 반려")')
    await expect(page.locator(`text=대량 반려 (2건)`)).toBeVisible()

    await page.fill('textarea[placeholder="공통 반려 사유를 입력하세요."]', '자격 미달')
    await page.locator('textarea[placeholder="공통 반려 사유를 입력하세요."]').locator('..').locator('button:has-text("반려")').click()
    await expect(page.locator('text=대량 반려 완료')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=건 선택됨')).not.toBeVisible()
  })

  test('bulkSaving 중 버튼 disabled', async ({ page }) => {
    await interceptBulk(page, 800)
    await page.route('**/api/admin/device-requests?status=PENDING', async (route: Route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockListResp([REQ_PENDING_1, REQ_PENDING_2])) })
    })
    await page.goto(`${BASE}/admin/device-requests`)
    await page.waitForLoadState('networkidle')

    await tableBodyCBs(page).nth(0).check()
    await page.click('button:has-text("대량 승인")')

    await expect(page.locator('button:has-text("처리 중...")').first()).toBeDisabled()
    await expect(page.locator('text=대량 승인 완료')).toBeVisible({ timeout: 5000 })
  })

  test('선택 해제 버튼으로 툴바 즉시 제거', async ({ page }) => {
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
test.describe('device-requests 대량 승인/반려 [모바일]', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test.beforeEach(async ({ page }) => {
    await ensureAdmin(page)
    page.on('dialog', dialog => dialog.accept())
  })

  const cardCBs = (page: Page) =>
    page.locator('label').filter({ hasText: '선택' }).locator('input[type="checkbox"]')

  test('모바일: PENDING 카드에만 체크박스 + 대량 승인', async ({ page }) => {
    await interceptBulk(page)
    let call = 0
    await page.route('**/api/admin/device-requests?status=PENDING', async (route: Route) => {
      call++
      const items = call <= 1 ? [REQ_PENDING_1, REQ_PENDING_2] : []
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockListResp(items)) })
    })
    await page.goto(`${BASE}/admin/device-requests`)
    await page.waitForLoadState('networkidle')

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
