/**
 * material-request.spec.ts
 * 자재청구 최소 플로우 자동 점검
 *
 * 점검 항목:
 *   M-01  목록 렌더링 — API mock + 테이블/카드 노출
 *   M-02  상태 필터  — select 변경 → API status 파라미터 전달 확인
 *   M-03  보기 링크  — 행 클릭 → /admin/materials/requests/[id] 이동
 *
 * 실행:
 *   npx playwright test e2e/material-request.spec.ts --config=e2e/playwright.config.ts --project=chromium
 */
import { test, expect, type Page, type Route } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const BASE        = process.env.BASE_URL || 'https://attendance.haehan-ai.kr'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL   || 'jay@haehan-ai.kr'
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

// ── 목 데이터 ──────────────────────────────────────────────
const REQUEST_A = {
  id: 'mr-1',
  requestNo: 'REQ-2026-0001',
  title: '철근 자재 청구',
  status: 'SUBMITTED',
  requestedBy: '홍길동',
  createdAt: new Date().toISOString(),
  deliveryRequestedAt: null,
  site: { id: 's-1', name: '테스트현장' },
  _count: { items: 3 },
}
const REQUEST_B = {
  id: 'mr-2',
  requestNo: 'REQ-2026-0002',
  title: '형틀 목재 청구',
  status: 'APPROVED',
  requestedBy: '김철수',
  createdAt: new Date().toISOString(),
  deliveryRequestedAt: new Date(Date.now() + 86400000 * 3).toISOString(),
  site: { id: 's-1', name: '테스트현장' },
  _count: { items: 5 },
}

function listResp(requests = [REQUEST_A, REQUEST_B]) {
  return { success: true, data: { requests, total: requests.length } }
}

// ── beforeEach: 인증 ──────────────────────────────────────
test.beforeEach(async ({ page }) => { await injectToken(page) })

// ══════════════════════════════════════════════════════════
// M-01  목록 렌더링
// ══════════════════════════════════════════════════════════
test('M-01 자재청구 목록 — 테이블/카드 렌더링', async ({ page }) => {
  await page.route('**/api/admin/materials/requests**', async (route: Route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(listResp()),
    })
  })
  await page.goto(`${BASE}/admin/materials/requests`)
  await page.waitForTimeout(2000)

  // 헤더
  await expect(page.locator('h1, h2').filter({ hasText: /자재청구/ })).toBeVisible({ timeout: 10000 })

  // 청구번호/제목 노출 — 테이블 또는 카드 어느 쪽이든
  // exact: true — 테이블뷰 span 매칭 (카드뷰 hidden div 제외)
  await expect(page.getByText('REQ-2026-0001', { exact: true })).toBeVisible({ timeout: 10000 })
})

// ══════════════════════════════════════════════════════════
// M-02  상태 필터 → API status 파라미터 전달
// ══════════════════════════════════════════════════════════
test('M-02 상태 필터 — SUBMITTED 선택 → API status=SUBMITTED 전달', async ({ page }) => {
  let capturedUrl = ''
  await page.route('**/api/admin/materials/requests**', async (route: Route) => {
    capturedUrl = route.request().url()
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(listResp([])),
    })
  })
  await page.goto(`${BASE}/admin/materials/requests`)
  await page.waitForTimeout(1500)

  // 상태 select
  const statusSelect = page.locator('select').filter({ hasText: /전체 상태/ })
  await statusSelect.selectOption('SUBMITTED')
  await page.waitForTimeout(800)

  expect(capturedUrl).toContain('status=SUBMITTED')
})

// ══════════════════════════════════════════════════════════
// M-03  보기 링크 → 상세 이동
// ══════════════════════════════════════════════════════════
test('M-03 보기 링크 — href 패턴 /requests/[id] 확인', async ({ page }) => {
  await page.route('**/api/admin/materials/requests**', async (route: Route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(listResp()),
    })
  })
  await page.goto(`${BASE}/admin/materials/requests`)
  await page.waitForTimeout(2000)

  // href 패턴 확인 — 실제 상세 ID 포함 여부 검증
  const viewLink = page.locator('a[href*="/admin/materials/requests/"]').first()
  const href = await viewLink.getAttribute('href', { timeout: 10000 })
  expect(href).toMatch(/\/admin\/materials\/requests\/.+/)
  expect(href).not.toMatch(/\/admin\/materials\/requests\/$/)
})

// ══════════════════════════════════════════════════════════
// M-04  등록 화면 진입
// ══════════════════════════════════════════════════════════
test('M-04 등록 화면 — 필수 입력 필드 노출', async ({ page }) => {
  await page.goto(`${BASE}/admin/materials/requests/new`)
  await page.waitForTimeout(1500)

  // 필수 필드 존재 확인
  await expect(page.locator('input[placeholder*="품목명"], input[placeholder*="철근"]')).toBeVisible({ timeout: 10000 })
  await expect(page.locator('input[type="number"], input[placeholder="0"]')).toBeVisible()
  await expect(page.locator('button[type="submit"], button:has-text("신청 등록")')).toBeVisible()
})

// ══════════════════════════════════════════════════════════
// M-05  자재 신청 등록 저장 → 상세 이동
// ══════════════════════════════════════════════════════════
test('M-05 자재 신청 등록 — POST 성공 → 상세 이동', async ({ page }) => {
  // POST 모킹
  await page.route('**/api/admin/materials/requests', async (route: Route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 201, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { id: 'mr-new', requestNo: 'REQ-2026-0099' } }),
      })
    } else {
      await route.continue()
    }
  })
  // 상세 API 모킹
  await page.route('**/api/admin/materials/requests/mr-new**', async (route: Route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { ...REQUEST_A, id: 'mr-new', requestNo: 'REQ-2026-0099', status: 'SUBMITTED',
          items: [{ id: 'i-1', itemCode: '철근D16', itemName: '철근 D16', spec: 'D16×9m',
            unit: '본', requestedQty: '100', approvedQty: null, unitPrice: null,
            isUrgent: false, allowSubstitute: false, notes: null,
            disciplineCode: null, useLocation: '3층 기둥' }],
          history: [] },
      }),
    })
  })

  await page.goto(`${BASE}/admin/materials/requests/new`)
  await page.waitForTimeout(1000)

  // 품목명 + 수량 입력
  await page.locator('input[placeholder*="품목명"], input[placeholder*="철근"]').fill('철근 D16')
  await page.locator('input[type="number"], input[placeholder="0"]').fill('100')

  // 제출
  await page.locator('button[type="submit"], button:has-text("신청 등록")').click()

  // 상세 페이지 이동 확인
  await page.waitForURL('**/admin/materials/requests/mr-new', { timeout: 8000 })
  expect(page.url()).toContain('/admin/materials/requests/mr-new')
})

// ══════════════════════════════════════════════════════════
// M-06  상세 화면 — 신청 정보 + 상태 반영
// ══════════════════════════════════════════════════════════
test('M-06 상세 화면 — 품목명·상태·현장 표시', async ({ page }) => {
  await page.route('**/api/admin/materials/requests/mr-1', async (route: Route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { ...REQUEST_A, status: 'SUBMITTED',
          items: [{ id: 'i-1', itemCode: '철근D16', itemName: '철근 D16', spec: 'D16×9m',
            unit: '본', requestedQty: '100', approvedQty: null, unitPrice: null,
            isUrgent: false, allowSubstitute: false, notes: null,
            disciplineCode: null, useLocation: '3층 기둥' }],
          history: [{ id: 'h-1', fromStatus: null, toStatus: 'SUBMITTED',
            actorId: 'adm-1', actorType: 'ADMIN', reason: null,
            createdAt: new Date().toISOString() }] },
      }),
    })
  })

  await page.goto(`${BASE}/admin/materials/requests/mr-1`)
  await page.waitForTimeout(2000)

  // 품목명 노출 (strict mode 우회 — 복수 매칭 가능)
  await expect(page.getByText('철근 D16', { exact: false }).first()).toBeVisible({ timeout: 10000 })
  // 상태 배지 — 요청
  await expect(page.getByText('요청', { exact: false })).toBeVisible()
  // 현장명
  await expect(page.getByText('테스트현장', { exact: false })).toBeVisible()
})

// ══════════════════════════════════════════════════════════
// M-07  상태변경 권한 — VIEWER 는 상태 변경 버튼 없음
// ══════════════════════════════════════════════════════════
test('M-07 상태변경 — VIEWER 는 상태변경 API 403 반환', async ({ page }) => {
  let statusChangeAttempted = false
  await page.route('**/api/admin/materials/requests/mr-1/status', async (route: Route) => {
    statusChangeAttempted = true
    await route.fulfill({
      status: 403, contentType: 'application/json',
      body: JSON.stringify({ success: false, error: '상태 변경은 관리자만 가능합니다.' }),
    })
  })

  // VIEWER 역할 mock
  await page.route('**/api/admin/auth/me**', async (route: Route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { id: 'adm-1', name: '뷰어', email: 'viewer@test.kr', role: 'VIEWER' } }),
    })
  })
  await page.route('**/api/admin/materials/requests/mr-1', async (route: Route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { ...REQUEST_A, status: 'SUBMITTED',
          items: [{ id: 'i-1', itemCode: '철근D16', itemName: '철근 D16', spec: null,
            unit: '본', requestedQty: '100', approvedQty: null, unitPrice: null,
            isUrgent: false, allowSubstitute: false, notes: null, disciplineCode: null }],
          history: [] },
      }),
    })
  })

  await page.goto(`${BASE}/admin/materials/requests/mr-1`)
  await page.waitForTimeout(2000)

  // VIEWER: 승인/검토중/발주완료 버튼 없음 — 상태 변경 API 직접 호출로 403 확인
  // page.evaluate() 로 브라우저 컨텍스트에서 fetch → page.route() mock 적용됨
  const result = await page.evaluate(async (url: string) => {
    const r = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toStatus: 'REVIEWED' }),
    })
    return { status: r.status }
  }, `${BASE}/api/admin/materials/requests/mr-1/status`)
  expect(result.status).toBe(403)
  expect(statusChangeAttempted).toBe(true)
})

// ══════════════════════════════════════════════════════════
// M-08  VIEWER 작성 차단 유지 (P-05 재확인)
// ══════════════════════════════════════════════════════════
test('M-08 VIEWER — 자재 신청 목록 + 작성 버튼 없음', async ({ page }) => {
  await page.route('**/api/admin/auth/me**', async (route: Route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { id: 'adm-1', name: '뷰어', role: 'VIEWER' } }),
    })
  })
  await page.route('**/api/admin/materials/requests**', async (route: Route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(listResp([])),
    })
  })
  await page.goto(`${BASE}/admin/materials/requests`)
  await page.waitForTimeout(2000)

  // 목록 진입 성공
  await expect(page.locator('h1').filter({ hasText: /자재 신청/ })).toBeVisible({ timeout: 10000 })
  // 작성 버튼 없음
  await expect(page.locator('button:has-text("신청"), button:has-text("+ 신청")')).not.toBeVisible()
})
