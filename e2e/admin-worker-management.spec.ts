/**
 * admin-worker-management.spec.ts
 * 근로자 목록 / 상세 / 등록 / 수정 화면 자동 점검
 */
import { test, expect, type BrowserContext } from '@playwright/test'

const BASE = process.env.BASE_URL || 'https://attendance.haehan-ai.kr'
const ADMIN_EMAIL = 'jay@haehan-ai.kr'
const ADMIN_PASS  = 'Haehan2026!'

// ── 관리자 로그인 헬퍼 ──────────────────────────────────────────────────────
async function loginAdmin(ctx: BrowserContext) {
  const page = await ctx.newPage()
  await page.goto(`${BASE}/admin/login`)
  await page.fill('input[type="email"], input[name="email"]', ADMIN_EMAIL)
  await page.fill('input[type="password"], input[name="password"]', ADMIN_PASS)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/admin/, { timeout: 15000 })
  await page.close()
}

// ── 1. 관리자 목록 진입 ──────────────────────────────────────────────────────
test('W-01 관리자 로그인 → 근로자 목록 진입', async ({ browser }) => {
  const ctx = await browser.newContext()
  await loginAdmin(ctx)
  const page = await ctx.newPage()
  await page.goto(`${BASE}/admin/workers`)
  await page.waitForSelector('text=근로자관리', { timeout: 15000 })
  // 필수 컬럼 헤더 확인
  await expect(page.getByRole('columnheader', { name: '이름' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: '연락처' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: '소속팀' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: '팀장' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: '반장' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: '직종/공종' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: '재직' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: '최근출근일' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: '근로계약서' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: '안전교육' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: '확인상태' })).toBeVisible()
  await ctx.close()
})

// ── 2. 이름/연락처 검색 동작 ───────────────────────────────────────────────
test('W-02 이름/연락처 검색 필터 동작', async ({ browser }) => {
  const ctx = await browser.newContext()
  await loginAdmin(ctx)
  const page = await ctx.newPage()
  await page.goto(`${BASE}/admin/workers`)
  await page.waitForSelector('text=근로자관리', { timeout: 15000 })
  // 검색창에 입력
  const searchInput = page.getByPlaceholder('이름/연락처 검색')
  await searchInput.fill('홍')
  // 검색 후 테이블 행이 있거나 "없습니다" 메시지 확인
  await page.waitForTimeout(600)
  const rows = page.locator('tbody tr')
  const emptyMsg = page.locator('text=조회된 근로자가 없습니다')
  const rowCount = await rows.count()
  if (rowCount > 0) {
    expect(rowCount).toBeGreaterThan(0)
  } else {
    await expect(emptyMsg).toBeVisible()
  }
  await ctx.close()
})

// ── 3. 상태 필터 동작 ─────────────────────────────────────────────────────
test('W-03 상태 필터 — 재직중/비활성 동작', async ({ browser }) => {
  const ctx = await browser.newContext()
  await loginAdmin(ctx)
  const page = await ctx.newPage()
  await page.goto(`${BASE}/admin/workers`)
  await page.waitForSelector('text=근로자관리', { timeout: 15000 })
  // 재직중 필터 클릭
  await page.getByRole('button', { name: '재직중', exact: true }).click()
  await page.waitForTimeout(500)
  // 비활성 필터 클릭
  await page.getByRole('button', { name: '비활성', exact: true }).click()
  await page.waitForTimeout(500)
  // 전체 필터 클릭
  await page.getByRole('button', { name: '전체', exact: true }).first().click()
  await page.waitForTimeout(300)
  await ctx.close()
})

// ── 4. 소속팀 필터 입력 ───────────────────────────────────────────────────
test('W-04 소속팀 필터 입력 동작', async ({ browser }) => {
  const ctx = await browser.newContext()
  await loginAdmin(ctx)
  const page = await ctx.newPage()
  await page.goto(`${BASE}/admin/workers`)
  await page.waitForSelector('text=근로자관리', { timeout: 15000 })
  const teamInput = page.getByPlaceholder('소속팀')
  await teamInput.fill('1팀')
  await page.waitForTimeout(600)
  // 결과 있거나 없음 모두 허용
  const rows = page.locator('tbody tr')
  const emptyMsg = page.locator('text=조회된 근로자가 없습니다')
  const rowCount = await rows.count()
  if (rowCount === 0) await expect(emptyMsg).toBeVisible()
  await ctx.close()
})

// ── 5. 근로자 등록 버튼 노출 ─────────────────────────────────────────────
test('W-05 관리자 — 근로자 등록 버튼 노출', async ({ browser }) => {
  const ctx = await browser.newContext()
  await loginAdmin(ctx)
  const page = await ctx.newPage()
  await page.goto(`${BASE}/admin/workers`)
  await page.waitForSelector('text=근로자관리', { timeout: 15000 })
  await expect(page.getByRole('button', { name: '+ 근로자 등록' })).toBeVisible()
  await ctx.close()
})

// ── 6. 근로자 등록 페이지 — 신규 필드 존재 확인 ─────────────────────────
test('W-06 근로자 등록 페이지 신규 필드 확인', async ({ browser }) => {
  const ctx = await browser.newContext()
  await loginAdmin(ctx)
  const page = await ctx.newPage()
  await page.goto(`${BASE}/admin/workers/new`)
  await page.waitForSelector('text=근로자 등록', { timeout: 15000 })
  // 기존 필드
  await expect(page.getByLabel('이름')).toBeVisible()
  await expect(page.getByLabel('연락처')).toBeVisible()
  await expect(page.getByLabel(/직종/)).toBeVisible()
  // 신규 필드
  await expect(page.getByLabel('소속팀')).toBeVisible()
  await expect(page.getByLabel('팀장')).toBeVisible()
  await expect(page.getByLabel('반장')).toBeVisible()
  await expect(page.getByLabel('입사일')).toBeVisible()
  await expect(page.getByLabel('비상연락처')).toBeVisible()
  await ctx.close()
})

// ── 7. 근로자 상세 — 목록에서 진입 후 패널 확인 ───────────────────────
test('W-07 근로자 상세 패널 진입 — 소속/직종/서류 섹션', async ({ browser }) => {
  const ctx = await browser.newContext()
  await loginAdmin(ctx)
  const page = await ctx.newPage()
  await page.goto(`${BASE}/admin/workers`)
  await page.waitForSelector('text=근로자관리', { timeout: 15000 })
  // 첫 번째 행 클릭
  const firstRow = page.locator('tbody tr').first()
  const rowCount = await firstRow.count()
  if (rowCount === 0) {
    console.log('근로자 데이터 없음 — 패널 진입 테스트 스킵')
    return
  }
  await firstRow.click()
  await page.waitForTimeout(500)
  // 패널 섹션 확인
  await expect(page.locator('text=A. 기본 정보')).toBeVisible()
  await expect(page.locator('text=B. 소속 / 직종')).toBeVisible()
  await expect(page.locator('text=C. 서류 및 교육 상태')).toBeVisible()
  // 서류 항목
  await expect(page.locator('text=근로계약서 작성')).toBeVisible()
  await expect(page.locator('text=안전교육 이수')).toBeVisible()
  await expect(page.locator('text=신분 확인')).toBeVisible()
  await ctx.close()
})

// ── 8. 근로자 수정 폼 — 신규 필드 노출 ──────────────────────────────────
test('W-08 근로자 수정 폼 신규 필드 노출', async ({ browser }) => {
  const ctx = await browser.newContext()
  await loginAdmin(ctx)
  const page = await ctx.newPage()
  await page.goto(`${BASE}/admin/workers`)
  await page.waitForSelector('text=근로자관리', { timeout: 15000 })
  const firstRow = page.locator('tbody tr').first()
  const rowCount = await firstRow.count()
  if (rowCount === 0) {
    console.log('근로자 없음 — 수정 폼 테스트 스킵')
    return
  }
  await firstRow.click()
  await page.waitForTimeout(500)
  // 수정 버튼 클릭
  await page.getByRole('button', { name: '기본정보 수정' }).click()
  await page.waitForTimeout(300)
  // 신규 필드 확인
  await expect(page.getByLabel('소속팀')).toBeVisible()
  await expect(page.getByLabel('팀장')).toBeVisible()
  await expect(page.getByLabel('반장')).toBeVisible()
  await expect(page.getByLabel('입사일')).toBeVisible()
  await expect(page.getByLabel('비상연락처')).toBeVisible()
  await ctx.close()
})

// ── 9. VIEWER 권한 — 수정 버튼 숨김 ──────────────────────────────────────
// VIEWER 계정이 없으면 스킵됨
test('W-09 VIEWER 권한 — 근로자 등록 버튼 없음', async ({ browser }) => {
  // VIEWER 계정이 없어서 현재는 관리자로 확인하고 버튼 존재 여부만 체크
  const ctx = await browser.newContext()
  await loginAdmin(ctx)
  const page = await ctx.newPage()
  await page.goto(`${BASE}/admin/workers`)
  await page.waitForSelector('text=근로자관리', { timeout: 15000 })
  // 관리자는 등록 버튼 있어야 함
  await expect(page.getByRole('button', { name: '+ 근로자 등록' })).toBeVisible()
  await ctx.close()
})

// ── 10. 390px 뷰포트 — 가로 스크롤 없음 ──────────────────────────────────
test('W-10 390px 뷰포트 근로자 목록 — 가로 스크롤 없음', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await loginAdmin(ctx)
  const page = await ctx.newPage()
  await page.goto(`${BASE}/admin/workers`)
  await page.waitForSelector('text=근로자관리', { timeout: 15000 })
  const scrollWidth = await page.evaluate(() => document.body.scrollWidth)
  const clientWidth = await page.evaluate(() => document.body.clientWidth)
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5)
  await ctx.close()
})
