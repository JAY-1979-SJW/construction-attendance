/**
 * admin-material-catalog.spec.ts
 * 자재 카탈로그 핵심 흐름 E2E (material-api 3-10단계)
 *
 * 시나리오:
 *   CAT-A  첫 진입   — 배너·요약카드·카테고리 확인
 *   CAT-B  검색+자동완성 — 입력→드롭다운→선택→목록 재조회
 *   CAT-C  카테고리+페이지 이동
 *   CAT-D  상세패널 열기/닫기
 *   CAT-E  붙여넣기 조회 — parsedCount/foundCount + 상세패널
 *   CAT-F  CSV 버튼 존재/응답
 *   CAT-G  URL 복원 — 새로고침 후 상태 유지
 *
 * 실행:
 *   npx playwright test e2e/admin-material-catalog.spec.ts --config=e2e/playwright.config.ts --project=chromium
 */
import { test, expect, type Page, type Route } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const BASE        = process.env.BASE_URL    || 'https://attendance.haehan-ai.kr'
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

// ── Mock 데이터 ──────────────────────────────────────────────
const MOCK_SUMMARY = {
  success: true,
  data: {
    totalMaterials: 12345,
    totalCategories: 48,
    priceAvailableCount: 3210,
    priceUnavailableCount: 9135,
    latestBaseDate: '2026-03-24T00:00:00.000Z',
    sourceCounts: { nara: 2000, etc: 10345 },
  },
}

// material-categories-tree API 응답 형식: CategoryTreeNode { category, count, subCategories[] }
const MOCK_CATEGORIES = {
  success: true,
  data: [
    { category: '건자재', count: 100, subCategories: [{ subCategory: '시멘트류', count: 40 }, { subCategory: '골재류', count: 60 }] },
    { category: '철강',   count: 200, subCategories: [{ subCategory: '봉형강류', count: 120 }, { subCategory: '철판류', count: 80 }] },
    { category: '목재',   count: 50,  subCategories: [] },
  ],
}

const MOCK_SYNC_STATUS = {
  success: true,
  data: {
    sourceStatus: [
      { source: 'nara', status: 'DEFERRED', baseDate: '2026-03-24', priceIncluded: false },
    ],
  },
}

const MOCK_ITEMS = [
  { id: 1001, code: 'A-0001', name: '철근 D16', spec: 'D16×9m', unit: '본', category: '철강', source: 'nara', baseDate: '2026-03-24' },
  { id: 1002, code: 'A-0002', name: '시멘트 포대', spec: '40kg', unit: '포', category: '건자재', source: 'nara', baseDate: '2026-03-24' },
  { id: 1003, code: 'A-0003', name: '형틀 목재', spec: null, unit: 'EA', category: '목재', source: 'nara', baseDate: '2026-03-24' },
]

const MOCK_CATALOG = {
  success: true,
  data: { items: MOCK_ITEMS, total: 3, totalPages: 1 },
}

const MOCK_CATALOG_MULTI_PAGE = {
  success: true,
  data: { items: MOCK_ITEMS, total: 51, totalPages: 2 },
}

const MOCK_CATALOG_PAGE2 = {
  success: true,
  data: {
    items: [{ id: 2001, code: 'B-0001', name: '페인트 백색', spec: '18L', unit: 'L', category: '도장재', source: 'nara', baseDate: '2026-03-24' }],
    total: 51,
    totalPages: 2,
  },
}

const MOCK_SUGGESTS = {
  success: true,
  data: [
    { id: 1001, code: 'A-0001', name: '철근 D16', category: '철강', spec: 'D16×9m' },
    { id: 1004, code: 'A-0004', name: '철판', category: '철강', spec: null },
  ],
}

const MOCK_DETAIL = {
  success: true,
  data: {
    id: 1001, code: 'A-0001', name: '철근 D16', spec: 'D16×9m',
    unit: '본', category: '철강', source: 'nara',
    baseDate: '2026-03-24T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    basePrice: null, price_available: false,
    notice: '기준가격 미포함 품목입니다.',
  },
}

const MOCK_LOOKUP = {
  success: true,
  data: {
    parsedCount: 2,
    requestedCount: 2,
    foundCount: 2,
    items: [
      { id: 1001, code: 'A-0001', name: '철근 D16', spec: 'D16×9m', unit: '본', category: '철강', source: 'nara', base_date: '2026-03-24' },
      { id: 1002, code: 'A-0002', name: '시멘트 포대', spec: '40kg', unit: '포', category: '건자재', source: 'nara', base_date: '2026-03-24' },
    ],
    missingCodes: [],
  },
}

// ── 공통 mock: summary / categories / sync-status / detail ──
// catalog 는 각 테스트에서 직접 등록 (LIFO 충돌 방지)
async function setupBaseMocks(page: Page) {
  await page.route('**/api/proxy/material-summary**', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SUMMARY) })
  })
  await page.route('**/api/proxy/material-categories**', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_CATEGORIES) })
  })
  await page.route('**/api/proxy/material-sync-status**', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SYNC_STATUS) })
  })
  await page.route('**/api/proxy/material-detail**', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_DETAIL) })
  })
}

test.beforeEach(async ({ page }) => { await injectToken(page) })

// ══════════════════════════════════════════════════════════
// CAT-A  첫 진입
// ══════════════════════════════════════════════════════════
test('CAT-A 첫 진입 — 배너·요약카드·카테고리 확인', async ({ page }) => {
  await setupBaseMocks(page)
  // catalog 는 초기 진입 시 자동 호출되지 않으므로 mock 만 등록
  await page.route('**/api/proxy/material-catalog**', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_CATALOG) })
  })

  await page.goto(`${BASE}/admin/materials/catalog`)

  // h1
  await expect(page.locator('h1').filter({ hasText: '자재 카탈로그' })).toBeVisible({ timeout: 10000 })

  // deferred 배너 (수집 보류)
  await expect(page.getByText('수집 보류', { exact: true })).toBeVisible({ timeout: 8000 })

  // summary 카드 (12,345 는 트리 전체 버튼 + 카드에 중복 노출 → first() 사용)
  await expect(page.getByText('총 자재 수')).toBeVisible({ timeout: 8000 })
  await expect(page.getByText('12,345').first()).toBeVisible({ timeout: 5000 })
  await expect(page.getByText('카테고리').first()).toBeVisible()

  // 카테고리 트리 로드 확인 (select → 사이드바 트리로 전환됨)
  await expect(page.getByRole('button', { name: /건자재/ })).toBeVisible({ timeout: 5000 })

  // 검색 input 존재
  await expect(page.locator('input[placeholder="코드 또는 자재명 검색"]')).toBeVisible()

  // 코드 붙여넣기 섹션 헤더
  await expect(page.getByText('코드 붙여넣기 조회')).toBeVisible()
})

// ══════════════════════════════════════════════════════════
// CAT-B  검색 + 자동완성
// ══════════════════════════════════════════════════════════
test('CAT-B 검색+자동완성 — 입력→드롭다운→선택→목록 재조회', async ({ page }) => {
  await setupBaseMocks(page)

  await page.route('**/api/proxy/material-suggest**', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SUGGESTS) })
  })
  await page.route('**/api/proxy/material-catalog**', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_CATALOG) })
  })

  await page.goto(`${BASE}/admin/materials/catalog`)
  await expect(page.locator('h1').filter({ hasText: '자재 카탈로그' })).toBeVisible({ timeout: 10000 })

  const input = page.locator('input[placeholder="코드 또는 자재명 검색"]')
  await input.click()
  await input.fill('철')

  // 자동완성 드롭다운 표시 확인
  await expect(page.locator('[role="listbox"]')).toBeVisible({ timeout: 5000 })
  await expect(page.locator('[role="option"]').first()).toBeVisible({ timeout: 3000 })

  // 첫 번째 항목 선택 (onMouseDown 이벤트)
  await page.locator('[role="option"]').first().click()

  // 선택 후 input에 자재명 반영 (handleSuggestSelect → setQ(item.name))
  await expect(input).toHaveValue('철근 D16', { timeout: 3000 })

  // 드롭다운 닫힘 확인
  await expect(page.locator('[role="listbox"]')).not.toBeVisible({ timeout: 3000 })

  // 목록 재조회 후 테이블 표시 확인
  await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 8000 })
  await expect(page.getByText('철근 D16').first()).toBeVisible({ timeout: 5000 })
})

// ══════════════════════════════════════════════════════════
// CAT-C  카테고리 + 페이지 이동
// ══════════════════════════════════════════════════════════
test('CAT-C 카테고리+페이지 이동 — 필터→조회→다음 페이지', async ({ page }) => {
  await setupBaseMocks(page)

  await page.route('**/api/proxy/material-catalog**', async (route: Route) => {
    const url = route.request().url()
    if (url.includes('page=2')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_CATALOG_PAGE2) })
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_CATALOG_MULTI_PAGE) })
    }
  })

  await page.goto(`${BASE}/admin/materials/catalog`)
  await expect(page.locator('h1').filter({ hasText: '자재 카탈로그' })).toBeVisible({ timeout: 10000 })

  // 카테고리 트리에서 '건자재' 클릭 (select → 사이드바 트리로 전환됨)
  // 트리 클릭 시 handleCategoryChange → fetchMaterials 자동 호출
  await expect(page.getByRole('button', { name: /건자재/ })).toBeVisible({ timeout: 5000 })
  await page.getByRole('button', { name: /건자재/ }).click()

  // 총 N건 표시 확인
  await expect(page.getByText(/총 \d+건/)).toBeVisible({ timeout: 8000 })

  // 첫 행 표시 확인
  await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 5000 })

  // 페이지네이션 다음 버튼
  await expect(page.locator('button').filter({ hasText: '다음' })).toBeVisible({ timeout: 3000 })
  await page.locator('button').filter({ hasText: '다음' }).click()

  // 2페이지 데이터 확인
  await expect(page.getByText('페인트 백색')).toBeVisible({ timeout: 8000 })

  // URL에 category 파라미터 반영 확인
  expect(page.url()).toContain('category=')
})

// ══════════════════════════════════════════════════════════
// CAT-D  상세패널 열기/닫기
// ══════════════════════════════════════════════════════════
test('CAT-D 상세패널 — 행 클릭→열림→닫기', async ({ page }) => {
  await setupBaseMocks(page)
  await page.route('**/api/proxy/material-catalog**', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_CATALOG) })
  })

  await page.goto(`${BASE}/admin/materials/catalog`)
  await expect(page.locator('h1').filter({ hasText: '자재 카탈로그' })).toBeVisible({ timeout: 10000 })

  // 조회 실행해서 테이블 노출
  await page.getByRole('button', { name: '조회', exact: true }).click()
  await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 8000 })

  // 첫 행 클릭 → 상세패널 열림
  await page.locator('table tbody tr').first().click()

  // 상세패널 헤더 및 자재명 확인
  await expect(page.getByText('자재 상세')).toBeVisible({ timeout: 8000 })
  await expect(page.getByText('철근 D16').first()).toBeVisible({ timeout: 5000 })

  // 닫기 버튼 (aria-label="닫기")
  await page.locator('button[aria-label="닫기"]').click()
  await expect(page.getByText('자재 상세')).not.toBeVisible({ timeout: 3000 })
})

// ══════════════════════════════════════════════════════════
// CAT-E  붙여넣기 조회
// ══════════════════════════════════════════════════════════
test('CAT-E 붙여넣기 조회 — parsedCount/foundCount + 상세패널', async ({ page }) => {
  await setupBaseMocks(page)
  await page.route('**/api/proxy/material-catalog**', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_CATALOG) })
  })
  await page.route('**/api/proxy/material-lookup-text**', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_LOOKUP) })
  })

  await page.goto(`${BASE}/admin/materials/catalog`)
  await expect(page.locator('h1').filter({ hasText: '자재 카탈로그' })).toBeVisible({ timeout: 10000 })

  // 섹션 헤더 확인
  await expect(page.getByText('코드 붙여넣기 조회')).toBeVisible({ timeout: 5000 })

  // textarea에 코드 2개 입력
  const textarea = page.locator('textarea[placeholder*="A-0001"]')
  await textarea.fill('A-0001\nA-0002')

  // 일괄 조회 클릭
  await page.locator('button').filter({ hasText: '일괄 조회' }).click()

  // parsedCount / foundCount 표시 확인
  await expect(page.getByText(/파싱/)).toBeVisible({ timeout: 8000 })
  await expect(page.getByText('2').first()).toBeVisible({ timeout: 5000 })
  await expect(page.getByText(/조회됨/)).toBeVisible({ timeout: 5000 })

  // 결과 테이블 행 클릭 → 상세패널 열림
  // (LookupSection 결과 테이블은 main catalog 테이블보다 위에 위치)
  const lookupResultRows = page.locator('table tbody tr')
  await expect(lookupResultRows.first()).toBeVisible({ timeout: 5000 })
  await lookupResultRows.first().click()

  // 상세패널 확인
  await expect(page.getByText('자재 상세')).toBeVisible({ timeout: 8000 })
})

// ══════════════════════════════════════════════════════════
// CAT-F  CSV 버튼 존재/동작
// ══════════════════════════════════════════════════════════
test('CAT-F CSV 버튼 — 목록CSV + 붙여넣기CSV 존재 및 호출 확인', async ({ page }) => {
  await setupBaseMocks(page)
  await page.route('**/api/proxy/material-catalog**', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_CATALOG) })
  })

  let catalogExportCalled = false
  let lookupExportCalled  = false

  await page.route('**/api/proxy/material-catalog-export**', async (route: Route) => {
    catalogExportCalled = true
    await route.fulfill({
      status: 200,
      contentType: 'text/csv',
      headers: { 'content-disposition': 'attachment; filename="materials.csv"' },
      body: 'code,name\nA-0001,철근 D16\n',
    })
  })
  await page.route('**/api/proxy/material-lookup-text-export**', async (route: Route) => {
    lookupExportCalled = true
    await route.fulfill({
      status: 200,
      contentType: 'text/csv',
      headers: { 'content-disposition': 'attachment; filename="lookup.csv"' },
      body: 'code,name\nA-0001,철근 D16\n',
    })
  })

  await page.goto(`${BASE}/admin/materials/catalog`)
  await expect(page.locator('h1').filter({ hasText: '자재 카탈로그' })).toBeVisible({ timeout: 10000 })

  // 목록 CSV 버튼 존재 + 클릭
  const catalogCsvBtn = page.locator('button').filter({ hasText: '목록 CSV' })
  await expect(catalogCsvBtn).toBeVisible({ timeout: 5000 })
  await catalogCsvBtn.click()
  // 다운로드 트리거 대기
  await page.waitForResponse('**/api/proxy/material-catalog-export**', { timeout: 5000 }).catch(() => {})
  expect(catalogExportCalled).toBe(true)

  // 붙여넣기 CSV 다운로드 버튼 존재 확인
  const lookupCsvBtn = page.locator('button').filter({ hasText: 'CSV 다운로드' })
  await expect(lookupCsvBtn).toBeVisible()

  // textarea 입력 후 CSV 다운로드
  const textarea = page.locator('textarea[placeholder*="A-0001"]')
  await textarea.fill('A-0001')
  await lookupCsvBtn.click()
  await page.waitForResponse('**/api/proxy/material-lookup-text-export**', { timeout: 5000 }).catch(() => {})
  expect(lookupExportCalled).toBe(true)
})

// ══════════════════════════════════════════════════════════
// CAT-G  URL 복원
// ══════════════════════════════════════════════════════════
test('CAT-G URL 복원 — 새로고침 후 q·category·selectedId 유지', async ({ page }) => {
  await setupBaseMocks(page)
  await page.route('**/api/proxy/material-catalog**', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_CATALOG) })
  })

  // URL 파라미터 포함 진입
  await page.goto(`${BASE}/admin/materials/catalog?q=철근&category=철강&page=1&selectedId=1001`)
  await expect(page.locator('h1').filter({ hasText: '자재 카탈로그' })).toBeVisible({ timeout: 10000 })

  // q 복원 → input 값 확인
  const input = page.locator('input[placeholder="코드 또는 자재명 검색"]')
  await expect(input).toHaveValue('철근', { timeout: 8000 })

  // category 복원 → URL 파라미터로 확인 (select → 사이드바 트리로 전환됨)
  await expect(async () => {
    expect(page.url()).toContain('category=%EC%B2%A0%EA%B0%95')  // 철강 URL 인코딩
  }).toPass({ timeout: 5000 })

  // selectedId=1001 → 상세패널 열림
  await expect(page.getByText('자재 상세')).toBeVisible({ timeout: 8000 })

  // 새로고침 후 재복원
  await page.reload()
  await expect(page.locator('h1').filter({ hasText: '자재 카탈로그' })).toBeVisible({ timeout: 10000 })
  await expect(input).toHaveValue('철근', { timeout: 10000 })
  await expect(async () => {
    expect(page.url()).toContain('category=%EC%B2%A0%EA%B0%95')
  }).toPass({ timeout: 5000 })
  await expect(page.getByText('자재 상세')).toBeVisible({ timeout: 8000 })
})
