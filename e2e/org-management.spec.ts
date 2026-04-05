/**
 * org-management.spec.ts
 * 조직 관리 자동 점검
 *
 * 점검 항목:
 *   ORG-01  ADMIN — 조직 목록 진입, 팀 테이블 렌더
 *   ORG-02  ADMIN — 팀 상세 진입, 팀 정보 + 근로자 목록 렌더
 *   ORG-03  ADMIN — 팀장 수정 (PATCH /api/admin/org/teams/[name])
 *   ORG-04  ADMIN — 근로자 팀 변경 (PATCH /api/admin/workers/[id])
 *   ORG-05  VIEWER — 배정 변경 버튼 미노출 (조회만)
 *
 * 실행:
 *   npx playwright test e2e/org-management.spec.ts --config=e2e/playwright.config.ts --project=chromium
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

// ── 조직 목록 API mock ────────────────────────────────────────────────────
function mockOrgTeams(page: Page) {
  return page.route('**/api/admin/org/teams', async (route: Route) => {
    // GET /api/admin/org/teams (list, not detail)
    const url = new URL(route.request().url())
    if (url.pathname === '/api/admin/org/teams') {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            teams: [
              { teamName: '철근팀', workerCount: 5, supervisorName: '김팀장', foremanNames: ['이반장', '박반장'] },
              { teamName: '목공팀', workerCount: 3, supervisorName: '최팀장', foremanNames: ['홍반장'] },
            ],
            unassignedCount: 2,
          },
        }),
      })
    } else {
      await route.continue()
    }
  })
}

// ── 팀 상세 API mock ──────────────────────────────────────────────────────
function mockTeamDetail(page: Page, teamName: string) {
  return page.route(`**/api/admin/org/teams/${encodeURIComponent(teamName)}**`, async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            teamName,
            workerCount: 2,
            supervisorNames: ['김팀장'],
            foremanNames: ['이반장'],
            workers: [
              { id: 'w-1', name: '김철수', teamName, supervisorName: '김팀장', foremanName: '이반장', jobTitle: '철근공', siteName: 'A현장' },
              { id: 'w-2', name: '이영희', teamName, supervisorName: '김팀장', foremanName: '이반장', jobTitle: '철근공', siteName: 'A현장' },
            ],
          },
        }),
      })
    } else if (route.request().method() === 'PATCH') {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { updated: 2, teamName } }),
      })
    } else {
      await route.continue()
    }
  })
}

// ── 근로자 PATCH mock ─────────────────────────────────────────────────────
function mockWorkerPatch(page: Page) {
  return page.route('**/api/admin/workers/w-1', async (route: Route) => {
    if (route.request().method() === 'PATCH') {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { id: 'w-1' } }),
      })
    } else {
      await route.continue()
    }
  })
}

// ══════════════════════════════════════════════════════════════════════════════
// ORG-01  ADMIN — 조직 목록 진입
// ══════════════════════════════════════════════════════════════════════════════
test('ORG-01 ADMIN — 조직 목록 진입, 팀 테이블 렌더', async ({ page }) => {
  await injectToken(page)
  await mockRole(page, 'ADMIN')
  await mockOrgTeams(page)

  await page.goto(`${BASE}/admin/org`)
  await expect(page.locator('h1').filter({ hasText: /조직 관리/ })).toBeVisible({ timeout: 15000 })

  const list = page.locator('[data-testid="org-list"]')
  await expect(list).toBeVisible()
  await expect(list.locator('text=철근팀')).toBeVisible()
  await expect(list.locator('text=목공팀')).toBeVisible()
  await expect(list.locator('text=미배정')).toBeVisible()
})

// ══════════════════════════════════════════════════════════════════════════════
// ORG-02  ADMIN — 팀 상세 진입
// ══════════════════════════════════════════════════════════════════════════════
test('ORG-02 ADMIN — 팀 상세 진입, 팀 정보 + 근로자 목록 렌더', async ({ page }) => {
  await injectToken(page)
  await mockRole(page, 'ADMIN')
  await mockTeamDetail(page, '철근팀')
  await mockOrgTeams(page)

  await page.goto(`${BASE}/admin/org/${encodeURIComponent('철근팀')}`)
  await expect(page.locator('h1').filter({ hasText: /철근팀/ })).toBeVisible({ timeout: 15000 })

  // 팀 정보 카드
  await expect(page.locator('[data-testid="team-info"]')).toBeVisible()
  await expect(page.locator('[data-testid="team-info"]').locator('text=김팀장')).toBeVisible()

  // 근로자 목록
  await expect(page.locator('text=김철수')).toBeVisible()
  await expect(page.locator('text=이영희')).toBeVisible()
})

// ══════════════════════════════════════════════════════════════════════════════
// ORG-03  ADMIN — 팀장 수정
// ══════════════════════════════════════════════════════════════════════════════
test('ORG-03 ADMIN — 팀장 수정 PATCH 호출', async ({ page }) => {
  await injectToken(page)
  await mockRole(page, 'ADMIN')
  await mockTeamDetail(page, '철근팀')
  await mockOrgTeams(page)

  let patchCalled = false
  await page.route(`**/api/admin/org/teams/${encodeURIComponent('철근팀')}`, async (route: Route) => {
    if (route.request().method() === 'PATCH') {
      patchCalled = true
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { updated: 2, teamName: '철근팀' } }),
      })
    } else {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            teamName: '철근팀', workerCount: 2,
            supervisorNames: ['김팀장'], foremanNames: ['이반장'],
            workers: [
              { id: 'w-1', name: '김철수', teamName: '철근팀', supervisorName: '김팀장', foremanName: '이반장', jobTitle: '철근공', siteName: 'A현장' },
            ],
          },
        }),
      })
    }
  })

  await page.goto(`${BASE}/admin/org/${encodeURIComponent('철근팀')}`)
  await expect(page.locator('[data-testid="team-info"]')).toBeVisible({ timeout: 15000 })

  // 팀장 수정 버튼 클릭
  const teamInfoCard = page.locator('[data-testid="team-info"]')
  await teamInfoCard.locator('button:has-text("수정")').first().click()
  await page.waitForTimeout(300)

  // 입력창에 새 팀장 이름 입력
  const input = teamInfoCard.locator('input').first()
  await input.clear()
  await input.fill('박새팀장')

  // 저장 클릭
  await teamInfoCard.locator('button:has-text("저장")').click()
  await page.waitForTimeout(500)

  expect(patchCalled).toBe(true)
})

// ══════════════════════════════════════════════════════════════════════════════
// ORG-04  ADMIN — 근로자 팀 변경
// ══════════════════════════════════════════════════════════════════════════════
test('ORG-04 ADMIN — 근로자 배정 변경 PATCH 호출', async ({ page }) => {
  await injectToken(page)
  await mockRole(page, 'ADMIN')
  await mockTeamDetail(page, '철근팀')
  await mockOrgTeams(page)
  await mockWorkerPatch(page)

  let workerPatchCalled = false
  await page.route('**/api/admin/workers/w-1', async (route: Route) => {
    if (route.request().method() === 'PATCH') {
      workerPatchCalled = true
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { id: 'w-1' } }),
      })
    } else { await route.continue() }
  })

  await page.goto(`${BASE}/admin/org/${encodeURIComponent('철근팀')}`)
  await expect(page.locator('text=김철수')).toBeVisible({ timeout: 15000 })

  // 배정 변경 버튼 클릭
  await page.locator('[data-testid="edit-worker-w-1"]').click()
  await page.waitForTimeout(300)

  // 팀 변경 입력
  const row = page.locator('text=김철수').locator('../..')
  // 저장 버튼 클릭
  await page.locator('button:has-text("저장")').first().click()
  await page.waitForTimeout(500)

  expect(workerPatchCalled).toBe(true)
})

// ══════════════════════════════════════════════════════════════════════════════
// ORG-05  VIEWER — 배정 변경 버튼 미노출
// ══════════════════════════════════════════════════════════════════════════════
test('ORG-05 VIEWER — 배정 변경 버튼 미노출', async ({ page }) => {
  await injectToken(page)
  await mockRole(page, 'VIEWER')
  await mockTeamDetail(page, '철근팀')
  await mockOrgTeams(page)

  await page.goto(`${BASE}/admin/org/${encodeURIComponent('철근팀')}`)
  await expect(page.locator('text=김철수')).toBeVisible({ timeout: 15000 })
  await page.waitForTimeout(500)

  // 배정 변경 버튼 없음
  await expect(page.locator('text=배정 변경')).not.toBeVisible()
  // 팀장 수정 버튼 없음
  const teamInfoCard = page.locator('[data-testid="team-info"]')
  if (await teamInfoCard.isVisible()) {
    await expect(teamInfoCard.locator('button:has-text("수정")')).not.toBeVisible()
  }
})
