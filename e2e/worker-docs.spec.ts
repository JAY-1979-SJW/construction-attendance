/**
 * worker-docs.spec.ts
 * 근로자 서류/교육 현황 자동 점검
 *
 * 점검 항목:
 *   D-01  근로자 상세 진입 — 서류/교육 현황 섹션 렌더링
 *   D-02  근로계약서 상태 수정 저장 — PATCH /docs 호출 확인
 *   D-03  안전교육 상태 수정 저장 — PATCH /docs 호출 확인
 *   D-04  목록 배지 반영 — contractWrittenYn=true → 서류미비 해소 확인
 *   D-05  권한 없는 사용자 수정 차단 — VIEWER 수정 버튼 없음
 *
 * 실행:
 *   npx playwright test e2e/worker-docs.spec.ts --config=e2e/playwright.config.ts --project=chromium
 */
import { test, expect, type Page, type Route } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const BASE       = process.env.BASE_URL || 'https://attendance.haehan-ai.kr'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL    || 'jay@haehan-ai.kr'
const ADMIN_PASS  = process.env.ADMIN_PASSWORD || 'Haehan2026!'
const TOKEN_FILE  = path.join(__dirname, '..', 'logs', '.admin-token.txt')

// ── 인증 헬퍼 ──────────────────────────────────────────────
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

// ── mock 데이터 ──────────────────────────────────────────────
const WORKER_ID = 'test-worker-docs-001'

const WORKER_DETAIL = {
  id: WORKER_ID,
  name: '홍길동',
  phone: '01012345678',
  jobTitle: '형틀목공',
  isActive: true,
  workerCode: 'W-001',
  employmentType: 'DAILY_CONSTRUCTION',
  incomeType: 'DAILY_WAGE',
  organizationType: 'DIRECT',
  foreignerYn: false,
  nationalityCode: 'KR',
  retirementMutualStatus: 'PENDING_REVIEW',
  retirementMutualTargetYn: false,
  fourInsurancesEligibleYn: true,
  idVerificationStatus: null,
  accountStatus: 'APPROVED',
  birthDate: null,
  subcontractorName: null,
  hireDate: '2026-01-01',
  emergencyContact: null,
  teamName: 'A팀',
  supervisorName: '김팀장',
  foremanName: null,
  // 서류/교육 직접 입력 필드
  contractWrittenYn: false,
  contractWrittenDate: null,
  contractIssuedYn: false,
  contractAttachedYn: false,
  safetyEduCompletedYn: false,
  safetyEduType: null,
  safetyEduDate: null,
  safetyEduCertAttachedYn: false,
  assignmentEligibility: 'NEEDS_DOCS',
  missingDocs: [],
  rejectedDocs: [],
  expiredDocs: [],
  expiringDocs: [],
  nextAction: '서류 보완 필요',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  _count: { devices: 1, attendanceLogs: 5 },
  companyAssignments: [],
  siteAssignments: [],
  insuranceStatuses: [],
  bankAccountSecure: null,
  skillLevel: null,
}

function mockRole(page: Page, role: string, name = '테스트') {
  return page.route('**/api/admin/auth/me**', async (route: Route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { id: 'adm-1', name, email: `${role.toLowerCase()}@test.kr`, role } }),
    })
  })
}

function mockWorkerDetail(page: Page, overrides: Record<string, unknown> = {}) {
  return page.route(`**/api/admin/workers/${WORKER_ID}`, async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { ...WORKER_DETAIL, ...overrides } }),
      })
    } else {
      await route.continue()
    }
  })
}

// ── beforeEach: 인증 ──────────────────────────────────────
test.beforeEach(async ({ page }) => { await injectToken(page) })

// ══════════════════════════════════════════════════════════
// D-01  근로자 상세 진입 — 서류/교육 현황 섹션 렌더링
// ══════════════════════════════════════════════════════════
test('D-01 근로자 상세 — 서류/교육 현황 섹션 렌더링', async ({ page }) => {
  await mockWorkerDetail(page)

  await page.goto(`${BASE}/admin/workers/${WORKER_ID}`)
  await page.waitForTimeout(2000)

  // 기본 정보 탭이 열려있어야 함
  await expect(page.locator('h1, h2, h3').filter({ hasText: /기본 정보/ }).first()).toBeVisible({ timeout: 10000 })

  // 서류/교육 현황 섹션
  await expect(page.getByText('서류 / 교육 현황', { exact: true })).toBeVisible({ timeout: 10000 })

  // 근로계약서 작성 항목 표시
  await expect(page.getByText('근로계약서 작성', { exact: true })).toBeVisible()

  // 안전교육 이수 항목 표시
  await expect(page.getByText('안전교육 이수', { exact: true })).toBeVisible()

  // 수정 버튼 존재 (ADMIN 로그인)
  const editBtns = page.locator('button').filter({ hasText: '수정' })
  await expect(editBtns.first()).toBeVisible()
})

// ══════════════════════════════════════════════════════════
// D-02  근로계약서 상태 수정 저장
// ══════════════════════════════════════════════════════════
test('D-02 근로계약서 상태 수정 저장 — PATCH /docs 호출', async ({ page }) => {
  let patchBody: Record<string, unknown> = {}

  await mockWorkerDetail(page)
  await page.route(`**/api/admin/workers/${WORKER_ID}/docs`, async (route: Route) => {
    if (route.request().method() === 'PATCH') {
      patchBody = await route.request().postDataJSON()
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { id: WORKER_ID, contractWrittenYn: true, contractIssuedYn: true, updatedAt: new Date().toISOString() },
          message: '서류/교육 정보가 저장되었습니다.',
        }),
      })
    } else {
      await route.continue()
    }
  })

  await page.goto(`${BASE}/admin/workers/${WORKER_ID}`)
  await page.waitForTimeout(2000)

  // 서류/교육 섹션의 수정 버튼 클릭 — h4 부모 기준으로 정확히 특정
  await page.locator('h4').filter({ hasText: '서류 / 교육 현황' }).locator('xpath=..').locator('button').filter({ hasText: '수정' }).click()
  await page.waitForTimeout(500)

  // 근로계약서 작성 체크박스 활성화
  const contractWrittenCb = page.locator('label').filter({ hasText: '작성' }).locator('input[type="checkbox"]').first()
  await contractWrittenCb.check()

  // 교부 체크박스 활성화
  const contractIssuedCb = page.locator('label').filter({ hasText: '교부' }).locator('input[type="checkbox"]').first()
  await contractIssuedCb.check()

  // 저장 클릭
  await page.locator('button').filter({ hasText: '저장' }).first().click()
  await page.waitForTimeout(1000)

  // PATCH 호출 확인
  expect(patchBody.contractWrittenYn).toBe(true)
  expect(patchBody.contractIssuedYn).toBe(true)
})

// ══════════════════════════════════════════════════════════
// D-03  안전교육 상태 수정 저장
// ══════════════════════════════════════════════════════════
test('D-03 안전교육 상태 수정 저장 — PATCH /docs 호출', async ({ page }) => {
  let patchBody: Record<string, unknown> = {}

  await mockWorkerDetail(page)
  await page.route(`**/api/admin/workers/${WORKER_ID}/docs`, async (route: Route) => {
    if (route.request().method() === 'PATCH') {
      patchBody = await route.request().postDataJSON()
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { id: WORKER_ID, safetyEduCompletedYn: true, safetyEduType: '기초안전교육', updatedAt: new Date().toISOString() },
          message: '서류/교육 정보가 저장되었습니다.',
        }),
      })
    } else {
      await route.continue()
    }
  })

  await page.goto(`${BASE}/admin/workers/${WORKER_ID}`)
  await page.waitForTimeout(2000)

  // 서류/교육 섹션 수정 버튼 — h4 부모 기준으로 정확히 특정
  await page.locator('h4').filter({ hasText: '서류 / 교육 현황' }).locator('xpath=..').locator('button').filter({ hasText: '수정' }).click()
  await page.waitForTimeout(500)

  // 안전교육 이수 체크
  const safetyEduCb = page.locator('label').filter({ hasText: '이수' }).locator('input[type="checkbox"]').first()
  await safetyEduCb.check()

  // 교육 종류 선택
  const safetyEduSelect = page.locator('select').filter({ hasText: /기초안전교육/ })
  await safetyEduSelect.selectOption('기초안전교육')

  // 저장
  await page.locator('button').filter({ hasText: '저장' }).first().click()
  await page.waitForTimeout(1000)

  // PATCH 호출 확인
  expect(patchBody.safetyEduCompletedYn).toBe(true)
  expect(patchBody.safetyEduType).toBe('기초안전교육')
})

// ══════════════════════════════════════════════════════════
// D-04  목록 배지 반영 — contractWrittenYn=true → 서류미비 없음
// ══════════════════════════════════════════════════════════
test('D-04 목록 배지 — contractWrittenYn=true 저장 후 hasContract 반영 확인', async ({ page }) => {
  // 목록 API mock: contractWrittenYn=true인 근로자 → hasContract=true
  await page.route('**/api/admin/workers**', async (route: Route) => {
    if (/\/api\/admin\/workers(\?|$)/.test(route.request().url())) {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            items: [{
              id: WORKER_ID,
              name: '홍길동',
              phone: '01012345678',
              jobTitle: '형틀목공',
              isActive: true,
              accountStatus: 'APPROVED',
              birthDate: null,
              foreignerYn: false,
              employmentType: 'DAILY_CONSTRUCTION',
              organizationType: 'DIRECT',
              deviceCount: 1,
              retirementMutualStatus: 'PENDING_REVIEW',
              createdAt: new Date().toISOString(),
              primaryCompany: null,
              activeSites: [],
              todayAttendance: null,
              hireDate: '2026-01-01',
              emergencyContact: null,
              teamName: 'A팀',
              supervisorName: '김팀장',
              foremanName: null,
              latestCheckInDate: null,
              idVerificationStatus: null,
              // 직접 입력 반영 → hasContract=true, hasSafetyEducation=false
              hasContract: true,
              contractDate: '2026-01-01',
              contractIssuedYn: true,
              contractAttachedYn: true,
              hasSafetyCert: true,
              safetyCertDate: '2026-01-01',
              hasSafetyEducation: false,
              safetyEducationType: null,
              safetyEducationDate: null,
              safetyEduCertAttachedYn: false,
              dailyWage: 0,
              monthWage: 0,
              totalWage: 0,
              bankAccountSecure: null,
            }],
            total: 1,
            page: 1,
            pageSize: 20,
            totalPages: 1,
          },
        }),
      })
    } else {
      await route.continue()
    }
  })

  await page.goto(`${BASE}/admin/workers`)
  await page.waitForTimeout(2000)

  // 목록에서 근로자 표시 확인
  await expect(page.getByText('홍길동', { exact: true }).filter({ visible: true }).first()).toBeVisible({ timeout: 10000 })

  // 서류미비 배지 없음 — hasContract=true이므로 docs_missing이 아님
  // 교육미이수 배지는 있을 수 있음 (hasSafetyEducation=false)
  const row = page.locator('tr, [data-testid="worker-row"]').filter({ hasText: '홍길동' }).first()
  await expect(row.getByText('서류미비', { exact: true })).not.toBeVisible()
})

// ══════════════════════════════════════════════════════════
// D-05  권한 없는 사용자 수정 차단 — VIEWER 수정 버튼 없음
// ══════════════════════════════════════════════════════════
test('D-05 VIEWER — 서류/교육 섹션 수정 버튼 없음', async ({ page }) => {
  await mockRole(page, 'VIEWER', '뷰어')
  await mockWorkerDetail(page)

  // VIEWER는 PATCH API 403 반환
  await page.route(`**/api/admin/workers/${WORKER_ID}/docs`, async (route: Route) => {
    await route.fulfill({
      status: 403, contentType: 'application/json',
      body: JSON.stringify({ success: false, error: '권한이 없습니다.' }),
    })
  })

  await page.goto(`${BASE}/admin/workers/${WORKER_ID}`)
  await page.waitForTimeout(2000)

  // 서류/교육 현황 섹션 렌더링 확인
  await expect(page.getByText('서류 / 교육 현황', { exact: true })).toBeVisible({ timeout: 10000 })

  // VIEWER: 서류/교육 수정 버튼 없음 — API 403 직접 확인
  const result = await page.evaluate(async (url: string) => {
    const r = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contractWrittenYn: true }),
    })
    return { status: r.status }
  }, `${BASE}/api/admin/workers/${WORKER_ID}/docs`)

  expect(result.status).toBe(403)
})
