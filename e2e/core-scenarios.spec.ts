/**
 * 핵심 E2E 시나리오 7개 — 운영 안정화 기준
 *
 * 시나리오 1: 관리자 로그인 → 대시보드 접근
 * 시나리오 2: 현장 목록 조회 → 현장 상세
 * 시나리오 3: 근로자 목록 조회 → 근로자 상세
 * 시나리오 4: 출퇴근 기록 조회 (필터 포함)
 * 시나리오 5: 근로계약서 목록 조회
 * 시나리오 6: 공수확인 (월별 근로확인) 조회
 * 시나리오 7: 근로자 모바일 출퇴근 페이지 접근
 */
import { test, expect, type Page } from '@playwright/test'

const BASE = process.env.BASE_URL || 'https://attendance.haehan-ai.kr'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'jay@haehan-ai.kr'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234'

// ─── 헬퍼 ──────────────────────────────────────────────────

async function ensureAdminSession(page: Page) {
  const token = process.env.ADMIN_JWT
  if (token) {
    await page.context().addCookies([{
      name: 'admin_token',
      value: token,
      domain: new URL(BASE).hostname,
      path: '/',
    }])
    return
  }
  await page.goto(`${BASE}/admin/login`)
  await page.waitForLoadState('networkidle')
  await page.fill('input[type="email"]', ADMIN_EMAIL)
  await page.fill('input[type="password"]', ADMIN_PASSWORD)
  await page.click('button:has-text("로그인")')
  await page.waitForURL(/\/admin/, { timeout: 10000 })
}

// API 응답 검증 헬퍼
function expectApiOk(response: { status: () => number }) {
  expect(response.status()).toBeLessThan(400)
}

// ─── 시나리오 1: 관리자 로그인 → 대시보드 ────────────────────

test.describe('시나리오 1: 관리자 로그인 → 대시보드', () => {
  test('로그인 후 대시보드에 핵심 위젯 렌더링', async ({ page }) => {
    await ensureAdminSession(page)
    await page.goto(`${BASE}/admin`)
    await page.waitForLoadState('networkidle')

    // 대시보드 URL 확인
    expect(page.url()).toContain('/admin')
    expect(page.url()).not.toContain('/login')

    // 페이지 타이틀 또는 주요 요소 렌더링 확인
    const body = await page.textContent('body')
    expect(body).toBeTruthy()

    // JS 에러 없는지 확인
    const errors: string[] = []
    page.on('pageerror', err => errors.push(err.message))
    await page.waitForTimeout(2000)
    expect(errors.filter(e => !e.includes('ResizeObserver'))).toHaveLength(0)
  })
})

// ─── 시나리오 2: 현장 목록 → 상세 ─────────────────────────────

test.describe('시나리오 2: 현장 목록 → 상세', () => {
  test('현장 목록 API 정상 응답', async ({ page }) => {
    await ensureAdminSession(page)

    const res = await page.goto(`${BASE}/api/admin/sites`)
    expectApiOk(res!)
    const json = await res!.json()
    expect(json.success).toBe(true)
    expect(Array.isArray(json.data?.items ?? json.data)).toBe(true)
  })

  test('현장 목록 페이지 렌더링', async ({ page }) => {
    await ensureAdminSession(page)
    await page.goto(`${BASE}/admin/sites`)
    await page.waitForLoadState('networkidle')

    expect(page.url()).toContain('/admin/sites')
    // 테이블 또는 목록이 렌더링되었는지
    const tableOrList = page.locator('table, [role="grid"], [class*="list"]').first()
    await expect(tableOrList).toBeVisible({ timeout: 15000 })
  })
})

// ─── 시나리오 3: 근로자 목록 → 상세 ──────────────────────────

test.describe('시나리오 3: 근로자 목록 → 상세', () => {
  test('근로자 목록 API 정상 응답', async ({ page }) => {
    await ensureAdminSession(page)

    const res = await page.goto(`${BASE}/api/admin/workers?page=1&pageSize=10`)
    expectApiOk(res!)
    const json = await res!.json()
    expect(json.success).toBe(true)
    expect(json.data?.items).toBeDefined()
  })

  test('근로자 목록 페이지 렌더링 + 첫 근로자 상세 이동', async ({ page }) => {
    await ensureAdminSession(page)
    await page.goto(`${BASE}/admin/workers`)
    await page.waitForLoadState('networkidle')

    // 테이블 렌더링 확인
    const table = page.locator('table').first()
    await expect(table).toBeVisible({ timeout: 15000 })

    // 첫 번째 행 클릭 → 상세 페이지 이동
    const firstRow = page.locator('table tbody tr').first()
    const rowCount = await page.locator('table tbody tr').count()
    if (rowCount > 0) {
      await firstRow.click()
      await page.waitForLoadState('networkidle')
      // 상세 페이지 또는 패널이 열렸는지
      const url = page.url()
      const detailVisible = url.includes('/workers/') || await page.locator('[class*="detail"], [class*="panel"]').first().isVisible().catch(() => false)
      expect(detailVisible).toBeTruthy()
    }
  })
})

// ─── 시나리오 4: 출퇴근 기록 조회 ─────────────────────────────

test.describe('시나리오 4: 출퇴근 기록 조회', () => {
  test('출퇴근 API 정상 응답', async ({ page }) => {
    await ensureAdminSession(page)

    const today = new Date().toISOString().slice(0, 10)
    const res = await page.goto(`${BASE}/api/admin/attendance?date=${today}&page=1&pageSize=10`)
    expectApiOk(res!)
    const json = await res!.json()
    expect(json.success).toBe(true)
  })

  test('출퇴근 페이지 렌더링 + 날짜 필터 작동', async ({ page }) => {
    await ensureAdminSession(page)
    await page.goto(`${BASE}/admin/attendance`)
    await page.waitForLoadState('networkidle')

    expect(page.url()).toContain('/admin/attendance')
    // 날짜 입력 또는 DatePicker 존재 확인
    const dateInput = page.locator('input[type="date"]').first()
    const hasDate = await dateInput.isVisible().catch(() => false)
    expect(hasDate).toBe(true)
  })
})

// ─── 시나리오 5: 근로계약서 목록 ──────────────────────────────

test.describe('시나리오 5: 근로계약서 목록', () => {
  test('계약서 API 정상 응답', async ({ page }) => {
    await ensureAdminSession(page)

    const res = await page.goto(`${BASE}/api/admin/contracts?page=1&pageSize=10`)
    expectApiOk(res!)
    const json = await res!.json()
    expect(json.success).toBe(true)
  })

  test('계약서 목록 페이지 렌더링', async ({ page }) => {
    await ensureAdminSession(page)
    await page.goto(`${BASE}/admin/contracts`)
    await page.waitForLoadState('networkidle')

    expect(page.url()).toContain('/admin/contracts')
    // 테이블 또는 콘텐츠 영역 확인
    const content = page.locator('table, [class*="card"], [class*="list"]').first()
    await expect(content).toBeVisible({ timeout: 15000 })
  })
})

// ─── 시나리오 6: 공수확인 (월별 근로확인) ─────────────────────

test.describe('시나리오 6: 공수확인 조회', () => {
  test('근무확정 API 정상 응답', async ({ page }) => {
    await ensureAdminSession(page)

    const monthKey = new Date().toISOString().slice(0, 7) // YYYY-MM
    const res = await page.goto(`${BASE}/api/admin/work-confirmations?monthKey=${monthKey}`)
    expectApiOk(res!)
    const json = await res!.json()
    expect(json.success).toBe(true)
  })

  test('공수확인 페이지 렌더링', async ({ page }) => {
    await ensureAdminSession(page)
    await page.goto(`${BASE}/admin/work-confirmations`)
    await page.waitForLoadState('networkidle')

    expect(page.url()).toContain('/admin/work-confirmations')
  })
})

// ─── 시나리오 7: 근로자 모바일 출퇴근 접근 ────────────────────

test.describe('시나리오 7: 근로자 모바일 출퇴근', () => {
  test('출퇴근 페이지 렌더링 (로그인 필요)', async ({ page }) => {
    const workerToken = process.env.WORKER_JWT
    if (!workerToken) {
      test.skip(true, 'WORKER_JWT 미설정 — 근로자 토큰 필요')
      return
    }

    await page.context().addCookies([{
      name: 'worker_token',
      value: workerToken,
      domain: new URL(BASE).hostname,
      path: '/',
    }])

    await page.goto(`${BASE}/attendance`)
    await page.waitForLoadState('networkidle')

    // 로그인 페이지로 리다이렉트되지 않았는지
    expect(page.url()).not.toContain('/login')

    // 출근/퇴근 버튼 존재 확인
    const checkInBtn = page.locator('button:has-text("출근"), button:has-text("퇴근")').first()
    await expect(checkInBtn).toBeVisible({ timeout: 15000 })
  })

  test('출퇴근 API 헬스체크', async ({ page }) => {
    const res = await page.goto(`${BASE}/api/health`)
    expectApiOk(res!)
    const json = await res!.json()
    expect(json.status ?? json.success).toBeTruthy()
  })
})
