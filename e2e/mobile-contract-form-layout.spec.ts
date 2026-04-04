/**
 * 근로계약서 생성 폼 — 모바일 레이아웃 자동점검
 *
 * 점검 항목:
 *   L-01  수평 스크롤 없음 (390px)
 *   L-02  수평 스크롤 없음 (412px)
 *   L-03  세부공종 input 높이 44px 이상 (390px)
 *   L-04  세부직종 input 높이 44px 이상 (390px)
 *   L-05  공종 select 높이 44px 이상 (390px)
 *   L-06  직종 select 높이 44px 이상 (390px)
 *   L-07  라벨 미클립 — 공종/세부공종/직종/세부직종 (390px)
 *   L-08  플로팅 버튼이 2단계 필드를 덮지 않음 (390px)
 *   L-09  스크린샷 baseline 비교 — 2단계 섹션 (390px)
 *   L-10  스크린샷 baseline 비교 — 2단계 섹션 (412px)
 *
 * 실행:
 *   npx playwright test e2e/mobile-contract-form-layout.spec.ts \
 *     --config=e2e/playwright.config.ts --project=chromium \
 *     --update-snapshots   ← 최초 1회 baseline 생성 시
 *
 * 결과: logs/screenshots/mobile-contract-layout/
 */
import { test, expect, type Page, type Route } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const BASE = process.env.BASE_URL || 'https://attendance.haehan-ai.kr'
const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    || 'jay@haehan-ai.kr'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234'

const TOKEN_FILE   = path.join(__dirname, '..', 'logs', '.admin-token.txt')
const SHOT_DIR     = path.join(__dirname, '..', 'logs', 'screenshots', 'mobile-contract-layout')
fs.mkdirSync(SHOT_DIR, { recursive: true })

// ── 인증 헬퍼 ─────────────────────────────────────────────
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
  try { token = await fetchAdminToken() }
  catch (e) { test.skip(true, `admin 인증 실패: ${(e as Error).message}`); return }
  await page.context().addCookies([{
    name: 'admin_token', value: token,
    domain: new URL(BASE).hostname, path: '/',
    httpOnly: true, secure: true, sameSite: 'Lax' as const,
  }])
}

// ── mock API 세팅 (초기 fetch 3개) ────────────────────────
async function mockInitialApis(page: Page) {
  await page.route('**/api/admin/workers**', async (route: Route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { items: [], total: 0 } }),
    })
  })
  await page.route('**/api/admin/sites**', async (route: Route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    })
  })
  await page.route('**/api/admin/companies**', async (route: Route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { items: [] } }),
    })
  })
}

// ── 페이지 로딩 + 2단계 섹션 노출 대기 ──────────────────
async function gotoContractsNew(page: Page) {
  await page.goto(`${BASE}/admin/contracts/new`)
  // 2단계: 공사 및 직종 정보 헤더 대기 (isDirectEmployment=true 기본값)
  await expect(
    page.locator('h2:has-text("2단계: 공사 및 직종 정보")')
  ).toBeVisible({ timeout: 15000 })
  // 2단계까지 스크롤
  await page.locator('h2:has-text("2단계: 공사 및 직종 정보")').scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)
}

// ── 수평 스크롤 검사 헬퍼 ────────────────────────────────
async function checkNoHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(() =>
    document.documentElement.scrollWidth <= window.innerWidth
  )
}

// ── bounding box 유틸 ────────────────────────────────────
async function getBox(page: Page, selector: string) {
  const el = page.locator(selector).first()
  await expect(el).toBeVisible({ timeout: 5000 })
  return el.boundingBox()
}

// ════════════════════════════════════════════════════════
//  L-01 / L-02  수평 스크롤 없음
// ════════════════════════════════════════════════════════
test.describe('[LAYOUT] 수평 스크롤', () => {
  for (const [width, height] of [[390, 844], [412, 915]] as const) {
    test(`L-0${width === 390 ? 1 : 2} 수평 스크롤 없음 (${width}px)`, async ({ browser }) => {
      const ctx  = await browser.newContext({ viewport: { width, height } })
      const page = await ctx.newPage()
      await ensureAdmin(page)
      await mockInitialApis(page)
      await gotoContractsNew(page)

      const noHScroll = await checkNoHorizontalScroll(page)
      expect(noHScroll, `${width}px: 수평 스크롤 발생`).toBe(true)

      await ctx.close()
    })
  }
})

// ════════════════════════════════════════════════════════
//  L-03~L-06  입력 필드 높이 44px 이상 (390px)
// ════════════════════════════════════════════════════════
test.describe('[LAYOUT] 입력 필드 최소 높이', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test.beforeEach(async ({ page }) => {
    await ensureAdmin(page)
    await mockInitialApis(page)
    await gotoContractsNew(page)
  })

  const MIN_H = 44

  test('L-03 세부공종 input 높이 ≥ 44px', async ({ page }) => {
    // 세부공종: placeholder="예: 동력반, 소화배관"
    const box = await getBox(page, 'input[placeholder*="동력반"]')
    expect(box, '세부공종 input not found').not.toBeNull()
    expect(box!.height, `세부공종 height=${box!.height}px`).toBeGreaterThanOrEqual(MIN_H)
  })

  test('L-04 세부직종 input 높이 ≥ 44px', async ({ page }) => {
    // 세부직종: placeholder="예: 전기기능사, 용접공"
    const box = await getBox(page, 'input[placeholder*="전기기능사"]')
    expect(box, '세부직종 input not found').not.toBeNull()
    expect(box!.height, `세부직종 height=${box!.height}px`).toBeGreaterThanOrEqual(MIN_H)
  })

  test('L-05 공종 select 높이 ≥ 44px', async ({ page }) => {
    // 공종 select — 2단계 첫 번째 select
    const section = page.locator('div:has(> h2:has-text("2단계"))')
    const selects = section.locator('select')
    const box = await selects.first().boundingBox()
    expect(box, '공종 select not found').not.toBeNull()
    expect(box!.height, `공종 select height=${box!.height}px`).toBeGreaterThanOrEqual(MIN_H)
  })

  test('L-06 직종 select 높이 ≥ 44px', async ({ page }) => {
    const section = page.locator('div:has(> h2:has-text("2단계"))')
    const selects = section.locator('select')
    const box = await selects.nth(1).boundingBox()
    expect(box, '직종 select not found').not.toBeNull()
    expect(box!.height, `직종 select height=${box!.height}px`).toBeGreaterThanOrEqual(MIN_H)
  })
})

// ════════════════════════════════════════════════════════
//  L-07  라벨 미클립 — 잘리거나 0px가 되지 않을 것
// ════════════════════════════════════════════════════════
test.describe('[LAYOUT] 라벨 미클립', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test.beforeEach(async ({ page }) => {
    await ensureAdmin(page)
    await mockInitialApis(page)
    await gotoContractsNew(page)
  })

  const LABELS = ['공종', '세부공종', '직종', '세부직종']

  for (const label of LABELS) {
    test(`L-07 라벨 미클립 — "${label}"`, async ({ page }) => {
      const el = page.locator(`label:has-text("${label}")`).first()
      await expect(el).toBeVisible({ timeout: 5000 })
      const box = await el.boundingBox()
      expect(box, `"${label}" label not found`).not.toBeNull()
      expect(box!.width,  `"${label}" label width=0`).toBeGreaterThan(0)
      expect(box!.height, `"${label}" label height=0`).toBeGreaterThan(0)
      // 라벨이 뷰포트 오른쪽 밖으로 밀리지 않을 것
      expect(box!.x + box!.width, `"${label}" label 밖으로 밀림`).toBeLessThanOrEqual(390)
    })
  }
})

// ════════════════════════════════════════════════════════
//  L-08  플로팅 버튼이 2단계 필드를 덮지 않음
// ════════════════════════════════════════════════════════
test.describe('[LAYOUT] 플로팅 버튼 겹침', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('L-08 플로팅 버튼이 2단계 입력 필드를 덮지 않음', async ({ page }) => {
    await ensureAdmin(page)
    await mockInitialApis(page)
    await gotoContractsNew(page)

    // 플로팅 버튼 (FAQ 도우미 ⚖️)
    const fab = page.locator('button:has-text("⚖️")').first()
    const fabVisible = await fab.isVisible().catch(() => false)
    if (!fabVisible) {
      expect(true).toBe(true)
      return
    }
    const fabBox = await fab.boundingBox()
    expect(fabBox, 'floating button not found').not.toBeNull()

    // 2단계 내 모든 input/select
    const section = page.locator('div:has(> h2:has-text("2단계"))')
    const fields   = section.locator('input, select')
    const count    = await fields.count()
    expect(count, '2단계 필드 없음').toBeGreaterThan(0)

    for (let i = 0; i < count; i++) {
      // 각 필드를 개별로 viewport 중앙에 스크롤한 뒤 위치 확인
      // → "유저가 이 필드로 스크롤해서 탭할 때 FAB가 가리는가"를 재현
      await fields.nth(i).evaluate(el =>
        el.scrollIntoView({ block: 'center', behavior: 'instant' })
      )
      await page.waitForTimeout(80)

      const fBox   = await fields.nth(i).boundingBox()
      const fabNow = await fab.boundingBox()   // fixed → 항상 동일하지만 재측정
      if (!fBox || !fabNow) continue

      const vOverlap = fabNow.y < fBox.y + fBox.height && fabNow.y + fabNow.height > fBox.y
      const hOverlap = fabNow.x < fBox.x + fBox.width  && fabNow.x + fabNow.width  > fBox.x
      expect(
        vOverlap && hOverlap,
        `플로팅 버튼이 field[${i}]와 겹침 (fab: y=${fabNow.y}~${fabNow.y + fabNow.height}, ` +
        `field: y=${fBox.y}~${fBox.y + fBox.height})`
      ).toBe(false)
    }
  })
})

// ════════════════════════════════════════════════════════
//  L-09 / L-10  스크린샷 baseline 비교
// ════════════════════════════════════════════════════════
test.describe('[LAYOUT] 스크린샷 baseline', () => {
  for (const [width, height] of [[390, 844], [412, 915]] as const) {
    test(`L-${width === 390 ? '09' : '10'} 2단계 섹션 스크린샷 (${width}px)`, async ({ browser }) => {
      const ctx  = await browser.newContext({
        viewport: { width, height },
        colorScheme: 'dark',
      })
      const page = await ctx.newPage()
      await ensureAdmin(page)
      await mockInitialApis(page)
      await gotoContractsNew(page)

      // 2단계 섹션만 clip
      const section = page.locator('div:has(> h2:has-text("2단계"))')
      await expect(section).toBeVisible({ timeout: 5000 })

      // 로컬 파일 저장 (항상)
      const shotFile = path.join(SHOT_DIR, `step2-${width}px.png`)
      await section.screenshot({ path: shotFile })

      // baseline 비교 (--update-snapshots 로 최초 생성)
      await expect(section).toHaveScreenshot(`step2-${width}px.png`, {
        maxDiffPixelRatio: 0.02,   // 2% 이내 허용
        animations: 'disabled',
      })

      await ctx.close()
    })
  }
})
