/**
 * 출퇴근관리 MISSING_CHECKOUT 대량 퇴근 보정 E2E 검증
 *
 * 검증:
 *   1. MISSING_CHECKOUT 행에만 체크박스 노출
 *   2. COMPLETED 행에는 체크박스 없음
 *   3. 2건 선택 → 대량 퇴근 보정 → 선택 해제 + 재조회
 *   4. bulkSaving 중 버튼 disabled
 *   5. 선택 해제 버튼으로 툴바 즉시 제거
 *   6. 모바일: 카드 체크박스 + 대량 퇴근 보정
 *
 * 실행:
 *   npx playwright test e2e/attendance-bulk.spec.ts --config=e2e/playwright.config.ts --project=chromium
 */
import { test, expect, type Page, type Route } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const BASE = process.env.BASE_URL || 'https://attendance.haehan-ai.kr'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'jay@haehan-ai.kr'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234'

const SCREENSHOT_DIR = path.join(__dirname, '..', 'logs', 'screenshots', 'attendance-bulk')
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

function makeAtt(overrides: { id: string; status: string; workerName: string }) {
  return {
    id: overrides.id,
    workerId: 'w1',
    workerName: overrides.workerName,
    workerPhone: '010-0000-0000',
    company: '테스트업체',
    jobTitle: '형틀목수',
    siteId: 's1',
    siteName: '테스트현장',
    checkOutSiteName: null,
    workDate: TODAY,
    checkInAt: `${TODAY}T08:00:00.000Z`,
    checkOutAt: overrides.status === 'MISSING_CHECKOUT' ? null : `${TODAY}T17:00:00.000Z`,
    status: overrides.status,
    checkInDistance: 10,
    checkOutDistance: null,
    checkInWithinRadius: true,
    checkOutWithinRadius: null,
    checkInLat: 37.5, checkInLng: 127.0,
    checkOutLat: null, checkOutLng: null,
    isDirectCheckIn: false,
    exceptionReason: null,
    adminNote: null,
    isAutoCheckout: false,
    hasSiteMove: false,
    moveCount: 0,
    movePath: null,
    moveEvents: [],
    workedMinutesRaw: overrides.status === 'MISSING_CHECKOUT' ? null : 480,
    workedMinutesFinal: overrides.status === 'MISSING_CHECKOUT' ? null : 480,
    manualAdjustedYn: false,
    manualAdjustedReason: null,
    dayWage: 150000,
    monthWage: 3000000,
    totalWage: 3000000,
    hasCheckInPhoto: false,
    hasCheckOutPhoto: false,
  }
}

const ATT_MISSING_1  = makeAtt({ id: 'att-m1', status: 'MISSING_CHECKOUT', workerName: '근로자A' })
const ATT_MISSING_2  = makeAtt({ id: 'att-m2', status: 'MISSING_CHECKOUT', workerName: '근로자B' })
const ATT_COMPLETED  = makeAtt({ id: 'att-c1', status: 'COMPLETED',        workerName: '근로자C' })

function mockListResp(items: ReturnType<typeof makeAtt>[]) {
  return {
    success: true,
    data: {
      items,
      total: items.length,
      page: 1,
      pageSize: 500,
      totalPages: 1,
      summary: {
        total: items.length,
        working: 0,
        completed: items.filter(i => i.status === 'COMPLETED').length,
        missing: items.filter(i => i.status === 'MISSING_CHECKOUT').length,
        exception: 0,
        needsAction: items.filter(i => i.status === 'MISSING_CHECKOUT').length,
        todayWage: 450000,
        unassigned: 0,
        notCheckedIn: 0,
        siteMismatch: 0,
      },
      siteOptions: [{ id: 's1', name: '테스트현장' }],
    },
  }
}

async function interceptBulk(page: Page, delay = 0) {
  await page.route('**/api/admin/attendance/bulk', async (route: Route) => {
    if (delay) await new Promise(r => setTimeout(r, delay))
    const body = JSON.parse(route.request().postData() || '{}')
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { succeeded: body.ids?.length ?? 1, failed: 0, failedItems: [] } }),
    })
  })
}

async function interceptWorkers(page: Page) {
  await page.route('**/api/admin/workers**', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { items: [] } }) })
  })
  // canMutate 경쟁조건 방지: auth/me 즉시 응답으로 role=ADMIN 확정
  await page.route('**/api/admin/auth/me', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { role: 'ADMIN', sub: 'admin-user', name: 'Admin' } }) })
  })
}

async function goToPage(page: Page) {
  await page.goto(`${BASE}/admin/attendance`)
  await page.waitForLoadState('networkidle')
}

// ─────────────────────────────────────────────────────────
// 데스크탑 (기본 1280px — 테이블 뷰)
// ─────────────────────────────────────────────────────────
test.describe('attendance 대량 퇴근 보정 [데스크탑]', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAdmin(page)
    page.on('dialog', dialog => dialog.accept())
    await interceptWorkers(page)
  })

  const tableBodyCBs = (page: Page) => page.locator('table tbody input[type="checkbox"]')

  test('MISSING_CHECKOUT 행에만 체크박스, COMPLETED 행에는 없음', async ({ page }) => {
    await page.route('**/api/admin/attendance?**', async (route: Route) => {
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(mockListResp([ATT_MISSING_1, ATT_MISSING_2, ATT_COMPLETED])) })
    })
    await goToPage(page)

    await expect(tableBodyCBs(page)).toHaveCount(2)
    await expect(page.locator('table tbody tr:has-text("근로자C") input[type="checkbox"]')).toHaveCount(0)
  })

  test('2건 선택 → 대량 퇴근 보정 → 선택 해제 + 재조회', async ({ page }) => {
    await interceptBulk(page)
    let call = 0
    await page.route('**/api/admin/attendance?**', async (route: Route) => {
      call++
      const items = call <= 1 ? [ATT_MISSING_1, ATT_MISSING_2, ATT_COMPLETED] : [ATT_COMPLETED]
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(mockListResp(items)) })
    })
    await goToPage(page)

    await tableBodyCBs(page).nth(0).check()
    await tableBodyCBs(page).nth(1).check()
    await expect(page.locator('text=2건 선택됨')).toBeVisible()

    await page.click('button:has-text("대량 퇴근 보정")')
    await expect(page.locator('text=대량 퇴근 보정 완료')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=건 선택됨')).not.toBeVisible()
    await expect(tableBodyCBs(page)).toHaveCount(0)
  })

  test('bulkSaving 중 버튼 disabled', async ({ page }) => {
    await interceptBulk(page, 800)
    await page.route('**/api/admin/attendance?**', async (route: Route) => {
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(mockListResp([ATT_MISSING_1, ATT_MISSING_2])) })
    })
    await goToPage(page)

    await tableBodyCBs(page).nth(0).check()
    await page.click('button:has-text("대량 퇴근 보정")')

    const processingBtn = page.locator('button:has-text("처리 중...")')
    await expect(processingBtn.first()).toBeDisabled()
    await expect(page.locator('text=대량 퇴근 보정 완료')).toBeVisible({ timeout: 5000 })
  })

  test('선택 해제 버튼으로 툴바 즉시 제거', async ({ page }) => {
    await page.route('**/api/admin/attendance?**', async (route: Route) => {
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(mockListResp([ATT_MISSING_1])) })
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
test.describe('attendance 대량 퇴근 보정 [모바일]', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test.beforeEach(async ({ page }) => {
    await ensureAdmin(page)
    page.on('dialog', dialog => dialog.accept())
    await interceptWorkers(page)
  })

  const cardCBs = (page: Page) =>
    page.locator('label').filter({ hasText: '선택' }).locator('input[type="checkbox"]')

  test('모바일: MISSING_CHECKOUT 카드에만 체크박스 + 대량 퇴근 보정', async ({ page }) => {
    await interceptBulk(page)
    let call = 0
    await page.route('**/api/admin/attendance?**', async (route: Route) => {
      call++
      const items = call <= 1 ? [ATT_MISSING_1, ATT_MISSING_2, ATT_COMPLETED] : [ATT_COMPLETED]
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(mockListResp(items)) })
    })
    await goToPage(page)

    await expect(cardCBs(page)).toHaveCount(2)

    await cardCBs(page).nth(0).check()
    await cardCBs(page).nth(1).check()
    await expect(page.locator('text=2건 선택됨')).toBeVisible()
    await page.click('button:has-text("대량 퇴근 보정")')
    await expect(page.locator('text=대량 퇴근 보정 완료')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=건 선택됨')).not.toBeVisible()
    await expect(cardCBs(page)).toHaveCount(0)
  })
})
