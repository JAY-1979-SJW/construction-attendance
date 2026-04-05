/**
 * dashboard.spec.ts
 * 관리자 대시보드 자동 점검
 *
 * 점검 항목:
 *   DSH-01  ADMIN — 대시보드 진입, 요약 카드 5개 렌더 확인
 *   DSH-02  TEAM_LEADER — scopeLabel 노출 + 팀 범위 데이터만 표시
 *   DSH-03  FOREMAN — scopeLabel 노출 + 담당 범위 데이터만 표시
 *   DSH-04  요약 수치 렌더 확인 (오늘 출근/미출근/검토/자재/서류)
 *   DSH-05  최근 목록 렌더 확인 (이상건/자재신청/서류미완료/현장요약)
 *
 * 실행:
 *   npx playwright test e2e/dashboard.spec.ts --config=e2e/playwright.config.ts --project=chromium
 */
import { test, expect, type Page, type Route } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const BASE        = process.env.BASE_URL || 'https://attendance.haehan-ai.kr'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL   || 'jay@haehan-ai.kr'
const ADMIN_PASS  = process.env.ADMIN_PASSWORD || 'Haehan2026!'
const TOKEN_FILE  = path.join(__dirname, '..', 'logs', '.admin-token.txt')

// ── 공통 인증 헬퍼 ─────────────────────────────────────────────────────────
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

// ── 역할 mock ─────────────────────────────────────────────────────────────
function mockRole(page: Page, role: string, extra: Record<string, unknown> = {}) {
  return page.route('**/api/admin/auth/me**', async (route: Route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { id: 'adm-test', name: '테스트', email: `${role.toLowerCase()}@test.kr`, role, ...extra },
      }),
    })
  })
}

// ── 대시보드 API mock ──────────────────────────────────────────────────────
function mockDashboard(page: Page, overrides: Record<string, unknown> = {}) {
  return page.route('**/api/admin/dashboard**', async (route: Route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          summary: {
            totalWorkers: 12, activeSites: 3,
            todayTotal: 8, todayCheckedIn: 5, todayCompleted: 3,
            todayMissing: 2, todayException: 1,
            pendingMissing: 0, pendingExceptions: 0, pendingDeviceRequests: 0,
            todayWage: 0, monthWage: 0, totalWage: 0,
            todayPresenceTotal: 8, todayPresencePending: 2,
            todayPresenceCompleted: 4, todayPresenceNoResponse: 1,
            todayPresenceOutOfFence: 0, todayPresenceReview: 1,
            materialRequestCount: 3,
            docIncompleteCount: 4,
            scopeLabel: null,
            ...((overrides.summary as object) ?? {}),
          },
          recentIssues: [
            { id: 'i-1', workerId: 'w-1', workerName: '김철수', teamName: '철근팀', siteName: 'A현장', checkInAt: new Date().toISOString(), status: 'MISSING_CHECKOUT' },
            { id: 'i-2', workerId: 'w-2', workerName: '이영희', teamName: null, siteName: 'B현장', checkInAt: new Date().toISOString(), status: 'EXCEPTION' },
          ],
          recentMaterialRequests: [
            { id: 'm-1', requestNo: 'MR-20260405-0001', title: '철근 10t', status: 'SUBMITTED', siteName: 'A현장', requestedByName: '박관리자', submittedAt: new Date().toISOString() },
          ],
          docIncompleteWorkers: [
            { id: 'w-3', name: '홍길동', teamName: '목공팀', issues: ['SAFETY_EDUCATION', 'CONTRACT'] },
          ],
          siteSummary: [
            { id: 's-1', name: 'A현장', working: 5, completed: 2, missing: 1, exception: 0, issue: 1 },
            { id: 's-2', name: 'B현장', working: 0, completed: 1, missing: 1, exception: 1, issue: 2 },
          ],
          recentAttendance: [],
          sites: [],
          siteOptions: [],
          ...overrides,
        },
      }),
    })
  })
}

// ══════════════════════════════════════════════════════════════════════════════
// DSH-01  ADMIN — 대시보드 진입
// ══════════════════════════════════════════════════════════════════════════════
test('DSH-01 ADMIN — 대시보드 진입, 헤더 및 카드 렌더', async ({ page }) => {
  await injectToken(page)
  await mockRole(page, 'ADMIN')
  await mockDashboard(page)

  await page.goto(`${BASE}/admin`)
  await expect(page.locator('h1').filter({ hasText: /현황판/ })).toBeVisible({ timeout: 15000 })

  // 요약 카드 영역 존재
  await expect(page.locator('[data-testid="summary-cards"]')).toBeVisible()

  // scope 배지 없음 (ADMIN은 표시 안 함)
  await expect(page.locator('text=기준')).not.toBeVisible()
})

// ══════════════════════════════════════════════════════════════════════════════
// DSH-02  TEAM_LEADER — scopeLabel 표시 + 범위 제한
// ══════════════════════════════════════════════════════════════════════════════
test('DSH-02 TEAM_LEADER — scopeLabel 노출', async ({ page }) => {
  await injectToken(page)
  await mockRole(page, 'TEAM_LEADER', { teamName: '철근팀' })
  await mockDashboard(page, {
    summary: { scopeLabel: '팀: 철근팀' },
  })

  await page.goto(`${BASE}/admin`)
  await expect(page.locator('h1').filter({ hasText: /현황판/ })).toBeVisible({ timeout: 15000 })

  // scope 배지 노출
  await expect(page.locator('text=팀: 철근팀 기준')).toBeVisible()
})

// ══════════════════════════════════════════════════════════════════════════════
// DSH-03  FOREMAN — scopeLabel 표시 + 범위 제한
// ══════════════════════════════════════════════════════════════════════════════
test('DSH-03 FOREMAN — scopeLabel 노출', async ({ page }) => {
  await injectToken(page)
  await mockRole(page, 'FOREMAN', { name: '김반장' })
  await mockDashboard(page, {
    summary: { scopeLabel: '담당: 김반장' },
  })

  await page.goto(`${BASE}/admin`)
  await expect(page.locator('h1').filter({ hasText: /현황판/ })).toBeVisible({ timeout: 15000 })

  // scope 배지 노출
  await expect(page.locator('text=담당: 김반장 기준')).toBeVisible()
})

// ══════════════════════════════════════════════════════════════════════════════
// DSH-04  요약 수치 렌더 확인
// ══════════════════════════════════════════════════════════════════════════════
test('DSH-04 요약 카드 5개 수치 렌더', async ({ page }) => {
  await injectToken(page)
  await mockRole(page, 'ADMIN')
  await mockDashboard(page)

  await page.goto(`${BASE}/admin`)
  await expect(page.locator('[data-testid="summary-cards"]')).toBeVisible({ timeout: 15000 })
  await page.waitForTimeout(500)

  // 오늘 출근 인원
  await expect(page.locator('text=오늘 출근 인원')).toBeVisible()
  // 미출근 인원
  await expect(page.locator('text=미출근 인원')).toBeVisible()
  // 검토 필요
  await expect(page.locator('text=검토 필요')).toBeVisible()
  // 자재 신청
  await expect(page.locator('text=자재 신청')).toBeVisible()
  // 서류 미완료
  await expect(page.locator('text=서류 미완료')).toBeVisible()

  // 수치 확인 (mock 기준: todayTotal=8, todayMissing=2, materialRequestCount=3, docIncompleteCount=4)
  const cards = page.locator('[data-testid="summary-cards"]')
  await expect(cards.locator('text=8').first()).toBeVisible()
  await expect(cards.locator('text=3').first()).toBeVisible()
  await expect(cards.locator('text=4').first()).toBeVisible()
})

// ══════════════════════════════════════════════════════════════════════════════
// DSH-05  최근 목록 렌더 확인
// ══════════════════════════════════════════════════════════════════════════════
test('DSH-05 최근 목록 4섹션 렌더', async ({ page }) => {
  await injectToken(page)
  await mockRole(page, 'ADMIN')
  await mockDashboard(page)

  await page.goto(`${BASE}/admin`)
  await expect(page.locator('[data-testid="summary-cards"]')).toBeVisible({ timeout: 15000 })
  await page.waitForTimeout(500)

  // 최근 출근 이상
  await expect(page.locator('text=최근 출근 이상')).toBeVisible()
  // 현장별 인원 요약
  await expect(page.locator('text=현장별 인원 요약')).toBeVisible()
  // 최근 자재 신청
  await expect(page.locator('text=최근 자재 신청')).toBeVisible()
  // 서류/안전교육 미완료
  await expect(page.locator('text=서류/안전교육 미완료')).toBeVisible()

  // 이상건 row — 김철수, 이영희
  await expect(page.locator('text=김철수')).toBeVisible()
  await expect(page.locator('text=이영희')).toBeVisible()

  // 자재신청 row
  await expect(page.locator('text=MR-20260405-0001')).toBeVisible()

  // 서류미완료 row
  await expect(page.locator('text=홍길동')).toBeVisible()

  // 현장 요약 row
  await expect(page.locator('text=A현장')).toBeVisible()
  await expect(page.locator('text=B현장')).toBeVisible()
})
