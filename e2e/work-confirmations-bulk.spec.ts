/**
 * work-confirmations 대량 승인/반려 E2E 검증
 *
 * 레이아웃 구조:
 *   - sm(640px) 미만: MobileCard (sm:hidden) — label > input[checkbox]
 *   - sm(640px) 이상: <table> (hidden sm:block) — tbody td > input[checkbox]
 *
 * 검증 항목:
 *   1. DRAFT 항목에만 체크박스 노출 (테이블 뷰)
 *   2. CONFIRMED / EXCLUDED 행에는 체크박스 없음
 *   3. 2건 선택 → 대량 승인 성공 → 선택 해제 + 목록 재조회
 *   4. 1건 선택 → 대량 반려 성공 → 선택 해제 + 목록 재조회
 *   5. bulkProcessing 중 버튼 disabled
 *   6. 선택 해제 버튼 즉시 툴바 제거
 *   7. 모바일 viewport — 카드 뷰 체크박스 + 대량 승인/반려
 *
 * 실행:
 *   npx playwright test e2e/work-confirmations-bulk.spec.ts --config=e2e/playwright.config.ts --project=chromium
 */
import { test, expect, type Page, type Route } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const BASE = process.env.BASE_URL || 'https://attendance.haehan-ai.kr'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'jay@haehan-ai.kr'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234'
const SCREENSHOT_DIR = path.join(__dirname, '..', 'logs', 'screenshots', 'work-confirmations-bulk')
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })

// ── 인증 ──
let _tokenCache: string | null = null
const TOKEN_FILE = path.join(__dirname, '..', 'logs', '.admin-token.txt')

async function fetchAdminToken(): Promise<string> {
  if (process.env.ADMIN_JWT) return process.env.ADMIN_JWT
  if (_tokenCache) return _tokenCache
  // 파일 캐시 — 토큰 자체의 exp 기반이라 mtime 체크 없이 그냥 읽음
  if (fs.existsSync(TOKEN_FILE)) {
    const raw = fs.readFileSync(TOKEN_FILE, 'utf-8').trim()
    if (raw) {
      // JWT exp 체크
      try {
        const payload = JSON.parse(Buffer.from(raw.split('.')[1], 'base64').toString())
        if (payload.exp * 1000 > Date.now()) {
          _tokenCache = raw
          return _tokenCache
        }
      } catch { /* 파싱 실패 시 새로 발급 */ }
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
  try {
    token = await fetchAdminToken()
  } catch (e) {
    test.skip(true, `admin 인증 실패: ${(e as Error).message}`)
    return
  }
  const domain = new URL(BASE).hostname
  await page.context().addCookies([{
    name: 'admin_token',
    value: token,
    domain,
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax' as const,
  }])
}

// ── 목 데이터 ──
const MOCK_MONTH_KEY = '2026-04'

function makeMockItem(overrides: {
  id: string
  confirmationStatus: string
  workDate?: string
  workerName: string
}) {
  return {
    id: overrides.id,
    workDate: overrides.workDate ?? `${MOCK_MONTH_KEY}-01`,
    confirmationStatus: overrides.confirmationStatus,
    confirmedWorkType: 'FULL_DAY',
    confirmedWorkUnits: 1,
    confirmedBaseAmount: 200000,
    confirmedAllowanceAmount: 0,
    confirmedTotalAmount: 200000,
    incomeTypeSnapshot: 'DAILY_WAGE',
    employmentTypeSnapshot: 'DAILY',
    notes: null,
    worker: { id: 'w1', name: overrides.workerName, jobTitle: '보통인부', employmentType: 'DAILY', incomeType: 'DAILY_WAGE' },
    site: { id: 's1', name: '테스트현장' },
    attendanceDay: { firstCheckInAt: null, lastCheckOutAt: null, presenceStatus: 'NORMAL', manualAdjustedYn: false },
    updatedAt: new Date().toISOString(),
  }
}

const MOCK_DRAFT_1   = makeMockItem({ id: 'id-d1', confirmationStatus: 'DRAFT',     workerName: '근로자A', workDate: `${MOCK_MONTH_KEY}-01` })
const MOCK_DRAFT_2   = makeMockItem({ id: 'id-d2', confirmationStatus: 'DRAFT',     workerName: '근로자B', workDate: `${MOCK_MONTH_KEY}-02` })
const MOCK_CONFIRMED = makeMockItem({ id: 'id-c1', confirmationStatus: 'CONFIRMED', workerName: '근로자C', workDate: `${MOCK_MONTH_KEY}-03` })
const MOCK_EXCLUDED  = makeMockItem({ id: 'id-e1', confirmationStatus: 'EXCLUDED',  workerName: '근로자D', workDate: `${MOCK_MONTH_KEY}-04` })

function mockListResponse(items: ReturnType<typeof makeMockItem>[]) {
  return {
    success: true,
    data: {
      items,
      summary: {
        total: items.length,
        draft:     items.filter(i => i.confirmationStatus === 'DRAFT').length,
        confirmed: items.filter(i => i.confirmationStatus === 'CONFIRMED').length,
        excluded:  items.filter(i => i.confirmationStatus === 'EXCLUDED').length,
        totalAmount: 200000,
      },
      monthKey: MOCK_MONTH_KEY,
    },
  }
}

async function interceptBulk(page: Page, delay = 0) {
  await page.route('**/api/admin/work-confirmations/bulk', async (route: Route) => {
    if (delay) await new Promise(r => setTimeout(r, delay))
    const body = JSON.parse(route.request().postData() || '{}')
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { succeeded: body.ids?.length ?? 1, failed: 0, failedItems: [] } }),
    })
  })
}

async function goToPage(page: Page) {
  await page.goto(`${BASE}/admin/work-confirmations`)
  await page.waitForLoadState('networkidle')
}

// ─────────────────────────────────────────────────────────
// 데스크탑 테스트 (기본 viewport ~1280px → 테이블 뷰 active)
// 체크박스: table tbody td > input[type="checkbox"]
// ─────────────────────────────────────────────────────────
test.describe('work-confirmations 대량 승인/반려 [데스크탑 테이블 뷰]', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAdmin(page)
    page.on('dialog', dialog => dialog.accept())
  })

  // 공통 셀렉터 헬퍼
  const tableBodyCheckboxes = (page: Page) =>
    page.locator('table tbody input[type="checkbox"]')

  test('DRAFT 행에만 체크박스, CONFIRMED·EXCLUDED 행에는 없음', async ({ page }) => {
    await page.route('**/api/admin/work-confirmations?**', async (route: Route) => {
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(mockListResponse([MOCK_DRAFT_1, MOCK_DRAFT_2, MOCK_CONFIRMED, MOCK_EXCLUDED])) })
    })
    await goToPage(page)

    // tbody 전체 체크박스 = DRAFT 2건
    await expect(tableBodyCheckboxes(page)).toHaveCount(2)

    // 근로자C(CONFIRMED) 행 — 체크박스 없음
    await expect(page.locator('table tbody tr:has-text("근로자C") input[type="checkbox"]')).toHaveCount(0)
    // 근로자D(EXCLUDED) 행 — 체크박스 없음
    await expect(page.locator('table tbody tr:has-text("근로자D") input[type="checkbox"]')).toHaveCount(0)
  })

  test('2건 선택 후 대량 승인 → 선택 해제 + 목록 재조회', async ({ page }) => {
    await interceptBulk(page)
    let callCount = 0
    await page.route('**/api/admin/work-confirmations?**', async (route: Route) => {
      callCount++
      const items = callCount <= 1
        ? [MOCK_DRAFT_1, MOCK_DRAFT_2, MOCK_CONFIRMED]
        : [MOCK_CONFIRMED]
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(mockListResponse(items)) })
    })
    await goToPage(page)

    // 2건 선택
    await tableBodyCheckboxes(page).nth(0).check()
    await tableBodyCheckboxes(page).nth(1).check()
    await expect(page.locator('text=2건 선택됨')).toBeVisible()

    await page.click('button:has-text("대량 승인")')
    await expect(page.locator('text=대량 승인 완료')).toBeVisible({ timeout: 5000 })

    // 선택 해제 — 툴바 사라짐
    await expect(page.locator('text=건 선택됨')).not.toBeVisible()

    // 재조회 후 체크박스 0개
    await expect(tableBodyCheckboxes(page)).toHaveCount(0)
  })

  test('1건 선택 후 대량 반려 → 선택 해제 + 목록 재조회', async ({ page }) => {
    await interceptBulk(page)
    let callCount = 0
    await page.route('**/api/admin/work-confirmations?**', async (route: Route) => {
      callCount++
      const items = callCount <= 1 ? [MOCK_DRAFT_1, MOCK_CONFIRMED] : [MOCK_CONFIRMED]
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(mockListResponse(items)) })
    })
    await goToPage(page)

    await tableBodyCheckboxes(page).nth(0).check()
    await expect(page.locator('text=1건 선택됨')).toBeVisible()

    await page.click('button:has-text("대량 반려")')
    await expect(page.locator('text=대량 반려(제외) 완료')).toBeVisible({ timeout: 5000 })

    await expect(page.locator('text=건 선택됨')).not.toBeVisible()
    await expect(tableBodyCheckboxes(page)).toHaveCount(0)
  })

  test('bulkProcessing 중 두 버튼 모두 disabled', async ({ page }) => {
    await page.route('**/api/admin/work-confirmations?**', async (route: Route) => {
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(mockListResponse([MOCK_DRAFT_1, MOCK_DRAFT_2])) })
    })
    await interceptBulk(page, 800)
    await goToPage(page)

    await tableBodyCheckboxes(page).nth(0).check()
    await page.click('button:has-text("대량 승인")')

    // 처리 중 — 두 버튼 disabled
    const processingBtns = page.locator('button:has-text("처리 중...")')
    await expect(processingBtns.first()).toBeDisabled()
    await expect(processingBtns).toHaveCount(2)

    // 완료 후 정상 복귀
    await expect(page.locator('text=대량 승인 완료')).toBeVisible({ timeout: 5000 })
  })

  test('선택 해제 버튼으로 툴바 즉시 제거', async ({ page }) => {
    await page.route('**/api/admin/work-confirmations?**', async (route: Route) => {
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(mockListResponse([MOCK_DRAFT_1])) })
    })
    await goToPage(page)

    await tableBodyCheckboxes(page).nth(0).check()
    await expect(page.locator('text=1건 선택됨')).toBeVisible()

    await page.click('button:has-text("선택 해제")')
    await expect(page.locator('text=건 선택됨')).not.toBeVisible()
  })
})

// ─────────────────────────────────────────────────────────
// 모바일 테스트 (390px → sm:hidden 카드 뷰 active)
// 체크박스: label:has-text("선택") input[type="checkbox"]
// ─────────────────────────────────────────────────────────
test.describe('work-confirmations 대량 승인/반려 [모바일 카드 뷰]', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test.beforeEach(async ({ page }) => {
    await ensureAdmin(page)
    page.on('dialog', dialog => dialog.accept())
  })

  const cardCheckboxes = (page: Page) =>
    page.locator('label').filter({ hasText: '선택' }).locator('input[type="checkbox"]')

  test('모바일: DRAFT 카드에만 체크박스, 2건 선택 후 대량 승인', async ({ page }) => {
    await interceptBulk(page)
    let callCount = 0
    await page.route('**/api/admin/work-confirmations?**', async (route: Route) => {
      callCount++
      const items = callCount <= 1
        ? [MOCK_DRAFT_1, MOCK_DRAFT_2, MOCK_CONFIRMED]
        : [MOCK_CONFIRMED]
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(mockListResponse(items)) })
    })
    await goToPage(page)

    // 카드 뷰 체크박스 2건 (DRAFT)
    await expect(cardCheckboxes(page)).toHaveCount(2)

    await cardCheckboxes(page).nth(0).check()
    await cardCheckboxes(page).nth(1).check()
    await expect(page.locator('text=2건 선택됨')).toBeVisible()

    await page.click('button:has-text("대량 승인")')
    await expect(page.locator('text=대량 승인 완료')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=건 선택됨')).not.toBeVisible()
    await expect(cardCheckboxes(page)).toHaveCount(0)
  })

  test('모바일: 1건 선택 후 대량 반려', async ({ page }) => {
    await interceptBulk(page)
    let callCount = 0
    await page.route('**/api/admin/work-confirmations?**', async (route: Route) => {
      callCount++
      const items = callCount <= 1 ? [MOCK_DRAFT_1] : []
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(mockListResponse(items)) })
    })
    await goToPage(page)

    await cardCheckboxes(page).nth(0).check()
    await page.click('button:has-text("대량 반려")')
    await expect(page.locator('text=대량 반려(제외) 완료')).toBeVisible({ timeout: 5000 })
    await expect(cardCheckboxes(page)).toHaveCount(0)
  })
})
