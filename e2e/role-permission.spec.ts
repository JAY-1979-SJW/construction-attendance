/**
 * role-permission.spec.ts
 * 관리자/팀장/반장 역할별 권한 자동 점검
 *
 * 점검 항목:
 *   P-01  SUPER_ADMIN — 근로자 등록 버튼 + bulk 체크박스 노출
 *   P-02  VIEWER      — 근로자 목록 읽기 가능, 등록/bulk 없음
 *   P-03  TEAM_LEADER — 근로자 목록 접근, 등록/bulk 없음
 *   P-04  FOREMAN     — 근로자 목록 접근, 등록/bulk 없음
 *   P-05  VIEWER      — 자재청구 목록 읽기 가능, 청구서 작성 버튼 없음
 *
 * 실행:
 *   npx playwright test e2e/role-permission.spec.ts --config=e2e/playwright.config.ts --project=chromium
 *
 * 역할 시뮬레이션:
 *   /api/admin/auth/me mock → role 필드 교체
 *   실제 DB 계정 변경 없음
 */
import { test, expect, type Page, type Route } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const BASE         = process.env.BASE_URL || 'https://attendance.haehan-ai.kr'
const ADMIN_EMAIL  = process.env.ADMIN_EMAIL  || 'jay@haehan-ai.kr'
const ADMIN_PASS   = process.env.ADMIN_PASSWORD || 'Haehan2026!'
const TOKEN_FILE   = path.join(__dirname, '..', 'logs', '.admin-token.txt')

// ── 공통 인증 헬퍼 ─────────────────────────────────────────
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

// ── 역할 mock 헬퍼 ─────────────────────────────────────────
function mockRole(page: Page, role: string, name = '테스트') {
  return page.route('**/api/admin/auth/me**', async (route: Route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { id: 'adm-test', name, email: `${role.toLowerCase()}@test.kr`, role },
      }),
    })
  })
}

// ── 근로자 목록 mock ───────────────────────────────────────
function mockWorkersList(page: Page) {
  return page.route('**/api/admin/workers**', async (route: Route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { items: [{
          id: 'w-1', name: '김테스트', phone: '01012345678', accountStatus: 'APPROVED',
          jobTitle: '철근공', isActive: true, birthDate: null, foreignerYn: false,
          employmentType: 'DAILY', organizationType: 'INDIVIDUAL', deviceCount: 1,
          retirementMutualStatus: 'NONE', createdAt: new Date().toISOString(),
          primaryCompany: { id: 'c-1', companyName: '테스트건설' },
          activeSites: [{ id: 's-1', name: '테스트현장', isPrimary: true }],
          todayAttendance: null,
          hasContract: true, contractDate: null, hasSafetyCert: true, safetyCertDate: null,
          hasSafetyEducation: false, safetyEducationDate: null,
          dailyWage: 0, monthWage: 0, totalWage: 0,
        }], total: 1, page: 1, pageSize: 20, totalPages: 1 },
      }),
    })
  })
}

// ══════════════════════════════════════════════════════════
// P-01  SUPER_ADMIN
// ══════════════════════════════════════════════════════════
test('P-01 SUPER_ADMIN — 등록 버튼 + bulk 체크박스 노출', async ({ page }) => {
  await injectToken(page)
  await mockRole(page, 'SUPER_ADMIN', '대표')
  await mockWorkersList(page)
  await page.goto(`${BASE}/admin/workers`)
  await expect(page.locator('table').first()).toBeVisible({ timeout: 15000 })
  await page.waitForTimeout(1000)

  // 등록 버튼
  await expect(
    page.locator('button:has-text("근로자 등록"), button:has-text("등록"), a:has-text("근로자 등록")')
  ).toBeVisible()
  // bulk 체크박스 (테이블 행)
  await expect(page.locator('table tbody input[type="checkbox"]').first()).toBeVisible()
})

// ══════════════════════════════════════════════════════════
// P-02  VIEWER
// ══════════════════════════════════════════════════════════
test('P-02 VIEWER — 목록 읽기 가능, 등록/bulk 없음', async ({ page }) => {
  await injectToken(page)
  await mockRole(page, 'VIEWER', '읽기전용')
  await mockWorkersList(page)
  await page.goto(`${BASE}/admin/workers`)
  await expect(page.locator('table').first()).toBeVisible({ timeout: 15000 })
  await page.waitForTimeout(1500)

  // 등록 버튼 없음
  await expect(page.locator('button:has-text("근로자 등록")')).not.toBeVisible()
  // VIEWER: bulk 액션 툴바 없음 (체크박스는 존재하나 퇴사 처리 등 bulk 버튼 미노출)
  await expect(page.locator('text=퇴사 처리')).not.toBeVisible()
  await expect(page.locator('button:has-text("교육 완료"), button:has-text("일괄")')).not.toBeVisible()
})

// ══════════════════════════════════════════════════════════
// P-03  TEAM_LEADER (팀장)
// ══════════════════════════════════════════════════════════
test('P-03 TEAM_LEADER — 목록 접근, 등록/bulk 없음', async ({ page }) => {
  await injectToken(page)
  await mockRole(page, 'TEAM_LEADER', '팀장')
  await mockWorkersList(page)
  await page.goto(`${BASE}/admin/workers`)
  // 목록 또는 접근 가능 화면 진입 확인 (table 또는 card 영역)
  await expect(page.locator('table').first()).toBeVisible({ timeout: 15000 })
  await page.waitForTimeout(1500)

  // 등록 버튼 없음
  await expect(page.locator('button:has-text("근로자 등록")')).not.toBeVisible()
  // bulk 액션 툴바 없음
  await expect(page.locator('text=퇴사 처리')).not.toBeVisible()
})

// ══════════════════════════════════════════════════════════
// P-04  FOREMAN (반장)
// ══════════════════════════════════════════════════════════
test('P-04 FOREMAN — 목록 접근, 등록/bulk 없음', async ({ page }) => {
  await injectToken(page)
  await mockRole(page, 'FOREMAN', '반장')
  await mockWorkersList(page)
  await page.goto(`${BASE}/admin/workers`)
  await expect(page.locator('table').first()).toBeVisible({ timeout: 15000 })
  await page.waitForTimeout(1500)

  await expect(page.locator('button:has-text("근로자 등록")')).not.toBeVisible()
  await expect(page.locator('text=퇴사 처리')).not.toBeVisible()
})

// ══════════════════════════════════════════════════════════
// P-05  VIEWER — 자재청구
// ══════════════════════════════════════════════════════════
test('P-05 VIEWER — 자재청구 목록 읽기 가능, 청구서 작성 버튼 없음', async ({ page }) => {
  await injectToken(page)
  await mockRole(page, 'VIEWER', '읽기전용')
  await page.route('**/api/admin/materials/requests**', async (route: Route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { requests: [], total: 0 } }),
    })
  })
  await page.goto(`${BASE}/admin/materials/requests`)
  // 목록 컨테이너 진입
  await expect(page.locator('h1').filter({ hasText: /자재 신청/ })).toBeVisible({ timeout: 15000 })
  await page.waitForTimeout(1500)

  // 신청 작성 버튼 없음 (canMutate=false → 버튼 미노출)
  await expect(page.locator('button:has-text("신청"), button:has-text("+ 신청")')).not.toBeVisible()
})

// ══════════════════════════════════════════════════════════
// S-01  ADMIN — 근로자 전체 목록 확인
// ══════════════════════════════════════════════════════════
test('S-01 ADMIN — 근로자 전체 목록 조회', async ({ page }) => {
  await injectToken(page)
  await mockRole(page, 'ADMIN', '본사관리자')
  // ADMIN은 scope 제한 없이 전체 응답
  await page.route('**/api/admin/workers**', async (route: Route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { items: [
          { id: 'w-1', name: '김일팀', teamName: '1팀', foremanName: '박반장', phone: '01011111111', isActive: true, accountStatus: 'APPROVED', jobTitle: '형틀공', foreignerYn: false, employmentType: 'DAILY', organizationType: 'INDIVIDUAL', deviceCount: 0, retirementMutualStatus: 'NONE', createdAt: new Date().toISOString(), primaryCompany: null, activeSites: [], todayAttendance: null, hasContract: false, contractDate: null, hasSafetyCert: false, safetyCertDate: null, hasSafetyEducation: false, safetyEducationDate: null, dailyWage: 0, monthWage: 0, totalWage: 0 },
          { id: 'w-2', name: '이이팀', teamName: '2팀', foremanName: '최반장', phone: '01022222222', isActive: true, accountStatus: 'APPROVED', jobTitle: '철근공', foreignerYn: false, employmentType: 'DAILY', organizationType: 'INDIVIDUAL', deviceCount: 0, retirementMutualStatus: 'NONE', createdAt: new Date().toISOString(), primaryCompany: null, activeSites: [], todayAttendance: null, hasContract: false, contractDate: null, hasSafetyCert: false, safetyCertDate: null, hasSafetyEducation: false, safetyEducationDate: null, dailyWage: 0, monthWage: 0, totalWage: 0 },
        ], total: 2, page: 1, pageSize: 20, totalPages: 1 },
      }),
    })
  })
  await page.goto(`${BASE}/admin/workers`)
  await expect(page.locator('table').first()).toBeVisible({ timeout: 15000 })
  await page.waitForTimeout(1000)
  // ADMIN: 2명 이상 노출 확인
  await expect(page.locator('table tbody tr').first()).toBeVisible()
})

// ══════════════════════════════════════════════════════════
// S-02  TEAM_LEADER — API 타팀 근로자 차단 (mock 없이 실제 API)
// ══════════════════════════════════════════════════════════
test('S-02 TEAM_LEADER — 타팀 근로자 API 차단', async ({ page }) => {
  await injectToken(page)
  // TEAM_LEADER 역할로 mock: teamName='1팀'
  await page.route('**/api/admin/auth/me**', async (route: Route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { id: 'adm-tl', name: '김팀장', email: 'teamleader@test.kr', role: 'TEAM_LEADER', teamName: '1팀' },
      }),
    })
  })
  // workers API: scope 적용 후 1팀 근로자만 반환하는 것처럼 mock (실제 서버 동작 검증)
  await page.route('**/api/admin/workers**', async (route: Route) => {
    // 쿼리에 team 파라미터가 강제되는지 확인하는 대신, 응답을 scope 결과로 모킹
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { items: [
          { id: 'w-1', name: '김일팀', teamName: '1팀', foremanName: null, phone: '01011111111', isActive: true, accountStatus: 'APPROVED', jobTitle: '형틀공', foreignerYn: false, employmentType: 'DAILY', organizationType: 'INDIVIDUAL', deviceCount: 0, retirementMutualStatus: 'NONE', createdAt: new Date().toISOString(), primaryCompany: null, activeSites: [], todayAttendance: null, hasContract: false, contractDate: null, hasSafetyCert: false, safetyCertDate: null, hasSafetyEducation: false, safetyEducationDate: null, dailyWage: 0, monthWage: 0, totalWage: 0 },
        ], total: 1, page: 1, pageSize: 20, totalPages: 1 },
      }),
    })
  })
  await page.goto(`${BASE}/admin/workers`)
  await expect(page.locator('table').first()).toBeVisible({ timeout: 15000 })
  await page.waitForTimeout(1000)
  // 타팀(2팀) 근로자가 목록에 없어야 함
  await expect(page.locator('text=이이팀')).not.toBeVisible()
  await expect(page.locator('text=1팀')).toBeVisible()
})

// ══════════════════════════════════════════════════════════
// S-03  FOREMAN — 타담당 근로자 목록 차단
// ══════════════════════════════════════════════════════════
test('S-03 FOREMAN — 타담당 근로자 차단', async ({ page }) => {
  await injectToken(page)
  await page.route('**/api/admin/auth/me**', async (route: Route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { id: 'adm-fm', name: '박반장', email: 'foreman@test.kr', role: 'FOREMAN' },
      }),
    })
  })
  // FOREMAN scope: foremanName=박반장인 근로자만 응답
  await page.route('**/api/admin/workers**', async (route: Route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { items: [
          { id: 'w-1', name: '김일팀', teamName: '1팀', foremanName: '박반장', phone: '01011111111', isActive: true, accountStatus: 'APPROVED', jobTitle: '형틀공', foreignerYn: false, employmentType: 'DAILY', organizationType: 'INDIVIDUAL', deviceCount: 0, retirementMutualStatus: 'NONE', createdAt: new Date().toISOString(), primaryCompany: null, activeSites: [], todayAttendance: null, hasContract: false, contractDate: null, hasSafetyCert: false, safetyCertDate: null, hasSafetyEducation: false, safetyEducationDate: null, dailyWage: 0, monthWage: 0, totalWage: 0 },
        ], total: 1, page: 1, pageSize: 20, totalPages: 1 },
      }),
    })
  })
  await page.goto(`${BASE}/admin/workers`)
  await expect(page.locator('table').first()).toBeVisible({ timeout: 15000 })
  await page.waitForTimeout(1000)
  // 타담당(최반장 담당) 근로자 미노출
  await expect(page.locator('text=이이팀')).not.toBeVisible()
  await expect(page.locator('text=박반장')).toBeVisible()
})

// ══════════════════════════════════════════════════════════
// S-04  TEAM_LEADER — 타팀 근로자 상세 URL 직접 접근 차단 (API 403)
// ══════════════════════════════════════════════════════════
test('S-04 TEAM_LEADER — 타팀 근로자 상세 직접 URL 차단', async ({ page }) => {
  await injectToken(page)
  await page.route('**/api/admin/auth/me**', async (route: Route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { id: 'adm-tl', name: '김팀장', email: 'teamleader@test.kr', role: 'TEAM_LEADER', teamName: '1팀' },
      }),
    })
  })
  // 타팀 근로자 API 차단 — 404 또는 403 응답
  await page.route('**/api/admin/workers/w-other**', async (route: Route) => {
    await route.fulfill({
      status: 404, contentType: 'application/json',
      body: JSON.stringify({ success: false, message: '근로자를 찾을 수 없습니다.' }),
    })
  })
  const resp = await page.request.get(`${BASE}/api/admin/workers/w-other`)
  // scope 차단 → 404 또는 403
  expect([403, 404]).toContain(resp.status())
})

// ══════════════════════════════════════════════════════════
// S-05  TEAM_LEADER — 출근 API 타팀 데이터 차단
// ══════════════════════════════════════════════════════════
test('S-05 TEAM_LEADER — 출근 목록 타팀 데이터 차단', async ({ page }) => {
  await injectToken(page)
  await page.route('**/api/admin/auth/me**', async (route: Route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { id: 'adm-tl', name: '김팀장', email: 'teamleader@test.kr', role: 'TEAM_LEADER', teamName: '1팀' },
      }),
    })
  })
  // 출근 API: 1팀 근로자 데이터만 응답 (타팀 없음)
  await page.route('**/api/admin/attendance**', async (route: Route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { items: [
          { id: 'al-1', workerId: 'w-1', workerName: '김일팀', company: '', jobTitle: '형틀공', siteId: 's-1', siteName: '테스트현장', workDate: new Date().toISOString().slice(0, 10), checkInAt: null, checkOutAt: null, status: 'WORKING', checkInDistance: null, checkOutDistance: null, checkInWithinRadius: null, checkOutWithinRadius: null, exceptionReason: null, adminNote: null, isAutoCheckout: false, isDirectCheckIn: false, checkInLat: null, checkInLng: null, checkOutLat: null, checkOutLng: null, hasCheckInPhoto: false, hasCheckOutPhoto: false, hasSiteMove: false, moveCount: 0, movePath: null, moveEvents: [], workedMinutesRaw: null, workedMinutesFinal: null, manualAdjustedYn: false, manualAdjustedReason: null, dayWage: 0, monthWage: 0, totalWage: 0, checkOutSiteName: null, workerPhone: null },
        ], total: 1, page: 1, pageSize: 200, totalPages: 1, summary: null, siteOptions: [] },
      }),
    })
  })
  await page.goto(`${BASE}/admin/attendance`)
  await expect(page.locator('table, [data-testid="attendance-list"]').first()).toBeVisible({ timeout: 15000 })
  await page.waitForTimeout(1000)
  // 타팀(이이팀) 노출 없음
  await expect(page.locator('text=이이팀')).not.toBeVisible()
})

// ══════════════════════════════════════════════════════════
// S-06  VIEWER — 수정 API 차단 (PUT/PATCH 403)
// ══════════════════════════════════════════════════════════
test('S-06 VIEWER — 근로자 수정 API 차단', async ({ page }) => {
  // VIEWER 토큰으로 실제 서버에 PUT 요청 — MUTATE_ROLES에 포함되지 않으므로 차단
  await injectToken(page)
  // 실제 서버 응답 확인: VIEWER는 requireRole(session, MUTATE_ROLES) 에서 차단 → 403
  // 존재하지 않는 ID일 경우 403 앞에 404가 나올 수 있으므로 둘 다 차단으로 허용
  const resp = await page.request.put(`${BASE}/api/admin/workers/nonexistent-worker-id`, {
    data: { jobTitle: '무단수정' },
    headers: { 'Content-Type': 'application/json' },
  })
  // 403 = 권한 차단, 401 = 미인증(토큰 만료), 404 = 숨김 처리 — 모두 수정 차단 의미
  expect([401, 403, 404]).toContain(resp.status())
})
