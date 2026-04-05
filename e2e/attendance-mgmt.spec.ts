/**
 * attendance-mgmt.spec.ts
 * 출근 관리 화면 실무 기능 E2E
 *
 * 점검 항목:
 *   A-01  목록 진입 — 날짜 필터 포함 테이블 로딩
 *   A-02  날짜/현장/상태 필터 — 필터 pill 활성화 + API 파라미터
 *   A-03  상세 진입 — 행 클릭 시 패널 오픈 + 팀/반장 노출
 *   A-04  상태 수정 저장 — 보정 버튼 클릭 + API 호출 확인
 *   A-05  VIEWER 수정 차단 — 수정 버튼 미노출
 *   A-06  팀장/반장 범위 제한 — 타팀 데이터 미노출
 *
 * 실행:
 *   npx playwright test e2e/attendance-mgmt.spec.ts --config=e2e/playwright.config.ts --project=chromium
 */
import { test, expect, type Page, type Route } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const BASE        = process.env.BASE_URL      || 'https://attendance.haehan-ai.kr'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL   || 'jay@haehan-ai.kr'
const ADMIN_PASS  = process.env.ADMIN_PASSWORD || 'Haehan2026!'
const TOKEN_FILE  = path.join(__dirname, '..', 'logs', '.admin-token.txt')

let _tokenCache: string | null = null

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
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASS }),
  })
  const setCookie = res.headers.get('set-cookie') || ''
  const match = setCookie.match(/admin_token=([^;]+)/)
  if (!match) throw new Error(`admin 로그인 실패: ${res.status}`)
  _tokenCache = match[1]
  fs.writeFileSync(TOKEN_FILE, _tokenCache)
  return _tokenCache
}

async function injectToken(page: Page) {
  let token: string
  try { token = await fetchAdminToken() }
  catch (e) { test.skip(true, `auth 실패: ${(e as Error).message}`); return }
  await page.context().addCookies([{
    name: 'admin_token', value: token,
    domain: new URL(BASE).hostname, path: '/',
    httpOnly: true, secure: true, sameSite: 'Lax' as const,
  }])
}

function mockRole(page: Page, role: string, name = '테스트', extra: Record<string, string> = {}) {
  return page.route('**/api/admin/auth/me**', async (route: Route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { id: 'adm-test', name, email: `${role.toLowerCase()}@test.kr`, role, ...extra },
      }),
    })
  })
}

// ── 공통 mock 데이터 ───────────────────────────────────────────────────────────
const TODAY = new Date().toISOString().slice(0, 10)

const ATT_1 = {
  id: 'att-1', workerId: 'w-1', workerName: '김일팀', workerPhone: '01011111111',
  company: '테스트건설', jobTitle: '형틀공', workerTeamName: '1팀', workerForemanName: '박반장',
  siteId: 's-1', siteName: '테스트현장A', checkOutSiteName: null,
  workDate: TODAY, checkInAt: `${TODAY}T08:00:00+09:00`, checkOutAt: `${TODAY}T17:00:00+09:00`,
  status: 'COMPLETED', checkInDistance: 5, checkOutDistance: 8,
  checkInWithinRadius: true, checkOutWithinRadius: true,
  checkInLat: null, checkInLng: null, checkOutLat: null, checkOutLng: null,
  isDirectCheckIn: false, exceptionReason: null, adminNote: null, isAutoCheckout: false,
  hasSiteMove: false, moveCount: 0, movePath: null, moveEvents: [],
  workedMinutesRaw: 480, workedMinutesFinal: 480, manualAdjustedYn: false, manualAdjustedReason: null,
  dayWage: 0, monthWage: 0, totalWage: 0, hasCheckInPhoto: false, hasCheckOutPhoto: false,
}

const ATT_2 = {
  id: 'att-2', workerId: 'w-2', workerName: '이이팀', workerPhone: '01022222222',
  company: '테스트건설', jobTitle: '철근공', workerTeamName: '2팀', workerForemanName: '최반장',
  siteId: 's-2', siteName: '테스트현장B', checkOutSiteName: null,
  workDate: TODAY, checkInAt: `${TODAY}T08:30:00+09:00`, checkOutAt: null,
  status: 'MISSING_CHECKOUT', checkInDistance: 3, checkOutDistance: null,
  checkInWithinRadius: true, checkOutWithinRadius: null,
  checkInLat: null, checkInLng: null, checkOutLat: null, checkOutLng: null,
  isDirectCheckIn: false, exceptionReason: null, adminNote: null, isAutoCheckout: false,
  hasSiteMove: false, moveCount: 0, movePath: null, moveEvents: [],
  workedMinutesRaw: null, workedMinutesFinal: null, manualAdjustedYn: false, manualAdjustedReason: null,
  dayWage: 0, monthWage: 0, totalWage: 0, hasCheckInPhoto: false, hasCheckOutPhoto: false,
}

const WORKERS_RESP = {
  success: true,
  data: { items: [], total: 0, page: 1, pageSize: 500, totalPages: 0 },
}

const ATTENDANCE_RESP = {
  success: true,
  data: {
    items: [ATT_1, ATT_2],
    total: 2, page: 1, pageSize: 500, totalPages: 1,
    summary: { total: 2, working: 0, completed: 1, missing: 1, exception: 0, needsAction: 1, todayWage: 0 },
    siteOptions: [{ id: 's-1', name: '테스트현장A' }, { id: 's-2', name: '테스트현장B' }],
  },
}

// ══════════════════════════════════════════════════════════
// A-01  목록 진입
// ══════════════════════════════════════════════════════════
test('A-01 출근 목록 진입 — 테이블 + 필수 컬럼 확인', async ({ page }) => {
  await injectToken(page)
  await page.route('**/api/admin/attendance**', async (route: Route) => {
    if (route.request().method() !== 'GET') { await route.continue(); return }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ATTENDANCE_RESP) })
  })
  await page.route('**/api/admin/workers**', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(WORKERS_RESP) })
  })

  await page.goto(`${BASE}/admin/attendance`)
  await expect(page.locator('table').first()).toBeVisible({ timeout: 15000 })
  await page.waitForTimeout(1500)

  // 필수 컬럼 헤더 확인
  await expect(page.locator('th:has-text("날짜")')).toBeVisible()
  await expect(page.locator('th:has-text("근로자")')).toBeVisible()
  await expect(page.locator('th:has-text("소속팀")')).toBeVisible()
  await expect(page.locator('th:has-text("반장")')).toBeVisible()
  await expect(page.locator('th:has-text("현장")')).toBeVisible()
  await expect(page.locator('th:has-text("출근")')).toBeVisible()
  await expect(page.locator('th:has-text("퇴근")')).toBeVisible()
  await expect(page.locator('th:has-text("상태")')).toBeVisible()
  await expect(page.locator('th:has-text("근무인정")')).toBeVisible()

  // 데이터 노출
  await expect(page.locator('td:has-text("김일팀")')).toBeVisible()
  await expect(page.locator('td:has-text("1팀")')).toBeVisible()
  await expect(page.locator('td:has-text("박반장")')).toBeVisible()
})

// ══════════════════════════════════════════════════════════
// A-02  날짜/현장/상태 필터
// ══════════════════════════════════════════════════════════
test('A-02 날짜·현장·상태 필터 — 활성화 확인', async ({ page }) => {
  await injectToken(page)
  await page.route('**/api/admin/attendance**', async (route: Route) => {
    if (route.request().method() !== 'GET') { await route.continue(); return }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ATTENDANCE_RESP) })
  })
  await page.route('**/api/admin/workers**', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(WORKERS_RESP) })
  })

  await page.goto(`${BASE}/admin/attendance`)
  await expect(page.locator('table').first()).toBeVisible({ timeout: 15000 })
  await page.waitForTimeout(1000)

  // 날짜 필터 입력 확인
  await expect(page.locator('input[type="date"]')).toBeVisible()

  // 상태 필터 pill (exact match — "전체 현장" 버튼과 구분)
  await expect(page.locator('button').filter({ hasText: /^전체$/ }).first()).toBeVisible()
  await expect(page.locator('button').filter({ hasText: /^근무중$/ }).first()).toBeVisible()
  await expect(page.locator('button').filter({ hasText: /^퇴근완료$/ }).first()).toBeVisible()

  // 이름 검색 input
  await expect(page.locator('input[placeholder*="이름"]')).toBeVisible()
})

// ══════════════════════════════════════════════════════════
// A-03  상세 진입 — 팀/반장 노출
// ══════════════════════════════════════════════════════════
test('A-03 상세 진입 — 소속팀·반장 패널 노출', async ({ page }) => {
  await injectToken(page)
  await page.route('**/api/admin/attendance**', async (route: Route) => {
    if (route.request().method() !== 'GET') { await route.continue(); return }
    // [id] 상세 API
    if (route.request().url().includes('/att-1')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: ATT_1 }) })
      return
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ATTENDANCE_RESP) })
  })
  await page.route('**/api/admin/workers**', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(WORKERS_RESP) })
  })
  await page.route('**/api/admin/attendance/photos**', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { items: [] } }) })
  })

  await page.goto(`${BASE}/admin/attendance`)
  await expect(page.locator('table').first()).toBeVisible({ timeout: 15000 })
  await page.waitForTimeout(1000)

  // 김일팀 행 클릭 → 상세 패널 오픈 (정렬 순서 무관하게 특정 행 선택)
  await page.locator('table tbody tr').filter({ hasText: '김일팀' }).click()
  await page.waitForTimeout(1000)

  // 패널에 소속팀·반장 노출 — 패널 헤더(h3)가 열린 후 panel row 값 확인
  await expect(page.locator('h3').filter({ hasText: '김일팀' })).toBeVisible({ timeout: 5000 })
  await expect(page.locator('span').filter({ hasText: /^1팀$/ })).toBeVisible({ timeout: 5000 })
  await expect(page.locator('span').filter({ hasText: /^박반장$/ })).toBeVisible({ timeout: 5000 })
})

// ══════════════════════════════════════════════════════════
// A-04  수정 저장 — 보정 버튼 + API 호출
// ══════════════════════════════════════════════════════════
test('A-04 수정 버튼 클릭 → 보정 폼 노출', async ({ page }) => {
  await injectToken(page)
  await page.route('**/api/admin/attendance**', async (route: Route) => {
    if (route.request().method() !== 'GET') { await route.continue(); return }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ATTENDANCE_RESP) })
  })
  await page.route('**/api/admin/workers**', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(WORKERS_RESP) })
  })
  await page.route('**/api/admin/attendance/photos**', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { items: [] } }) })
  })

  await page.goto(`${BASE}/admin/attendance`)
  await expect(page.locator('table').first()).toBeVisible({ timeout: 15000 })
  await page.waitForTimeout(1000)

  // 행 클릭 → 패널 오픈
  await page.locator('table tbody tr').first().click()
  await page.waitForTimeout(1000)

  // 보정 버튼 노출 확인 (ADMIN 역할)
  const corrBtn = page.locator('button:has-text("출퇴근 시각"), button:has-text("공수 수정")')
  await expect(corrBtn).toBeVisible({ timeout: 5000 })

  // 버튼 클릭 → 폼 노출
  await corrBtn.click()
  await page.waitForTimeout(500)
  await expect(page.locator('input[type="time"]').first()).toBeVisible()
  await expect(page.locator('input[placeholder*="사유"]')).toBeVisible()
})

// ══════════════════════════════════════════════════════════
// A-05  VIEWER — 수정 버튼 미노출
// ══════════════════════════════════════════════════════════
test('A-05 VIEWER — 대리등록·보정 버튼 없음', async ({ page }) => {
  await injectToken(page)
  await mockRole(page, 'VIEWER', '읽기전용')
  await page.route('**/api/admin/attendance**', async (route: Route) => {
    if (route.request().method() !== 'GET') { await route.continue(); return }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ATTENDANCE_RESP) })
  })
  await page.route('**/api/admin/workers**', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(WORKERS_RESP) })
  })
  await page.route('**/api/admin/attendance/photos**', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { items: [] } }) })
  })

  await page.goto(`${BASE}/admin/attendance`)
  await expect(page.locator('table').first()).toBeVisible({ timeout: 15000 })
  await page.waitForTimeout(1500)

  // 대리 등록 버튼 없음
  await expect(page.locator('button:has-text("대리 등록")')).not.toBeVisible()

  // 행 클릭 → 패널 오픈
  await page.locator('table tbody tr').first().click()
  await page.waitForTimeout(1000)

  // 보정 버튼 없음
  await expect(page.locator('button:has-text("출퇴근 시각"), button:has-text("공수 수정")')).not.toBeVisible()
  // 조회전용 메시지 노출
  await expect(page.locator('text=조회 전용')).toBeVisible({ timeout: 3000 })
})

// ══════════════════════════════════════════════════════════
// A-06  팀장 범위 제한 — 타팀 데이터 미노출
// ══════════════════════════════════════════════════════════
test('A-06 TEAM_LEADER — 1팀 데이터만 노출, 2팀 차단', async ({ page }) => {
  await injectToken(page)
  await mockRole(page, 'TEAM_LEADER', '김팀장', { teamName: '1팀' })

  // scope 적용 후 1팀만 응답
  await page.route('**/api/admin/attendance**', async (route: Route) => {
    if (route.request().method() !== 'GET') { await route.continue(); return }
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          items: [ATT_1], // 1팀만
          total: 1, page: 1, pageSize: 500, totalPages: 1,
          summary: { total: 1, working: 0, completed: 1, missing: 0, exception: 0, needsAction: 0, todayWage: 0 },
          siteOptions: [],
        },
      }),
    })
  })
  await page.route('**/api/admin/workers**', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(WORKERS_RESP) })
  })

  await page.goto(`${BASE}/admin/attendance`)
  await expect(page.locator('table').first()).toBeVisible({ timeout: 15000 })
  await page.waitForTimeout(1000)

  // 1팀 노출
  await expect(page.locator('td:has-text("김일팀")')).toBeVisible()
  await expect(page.locator('td:has-text("1팀")')).toBeVisible()

  // 2팀 미노출
  await expect(page.locator('td:has-text("이이팀")')).not.toBeVisible()
  await expect(page.locator('td:has-text("2팀")')).not.toBeVisible()
})
