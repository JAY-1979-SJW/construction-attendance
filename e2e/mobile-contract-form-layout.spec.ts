/**
 * 근로계약서 생성 폼 — 모바일 레이아웃 자동점검
 *
 * 점검 항목:
 *   L-01  수평 스크롤 없음 (360px)
 *   L-02  수평 스크롤 없음 (390px)
 *   L-03  수평 스크롤 없음 (412px)
 *   L-04  세부공종 input 높이 44px 이상 (390px)
 *   L-05  세부직종 input 높이 44px 이상 (390px)
 *   L-06  공종 select 높이 44px 이상 (390px)
 *   L-07  직종 select 높이 44px 이상 (390px)
 *   L-08  라벨 미클립 — 공종/세부공종/직종/세부직종 (390px)
 *   L-09  플로팅 버튼이 2단계 필드를 덮지 않음 (390px)
 *   L-10  스크린샷 baseline 비교 — 2단계 섹션 (360px)
 *   L-11  스크린샷 baseline 비교 — 2단계 섹션 (390px)
 *   L-12  스크린샷 baseline 비교 — 2단계 섹션 (412px)
 *   L-13  세부공종 라벨↔필드 세로 비겹침 (360/390/412)
 *   L-14  세부직종 라벨↔필드 세로 비겹침 (360/390/412)
 *   L-15  Step3 회사 라벨↔필드 세로 비겹침 (360/390/412)
 *   L-16  라벨 텍스트 단일 행 검증 — writing-mode + 줄수 (390px)
 *   L-17  공/직/담당업무 필드 left x 좌표 정렬 오차 ≤ 4px (390px)
 *   L-18  select 오버플로우 없음 + 우측 경계 뷰포트 내 (390px)
 *   L-19  Step3 회사 선택 영역 스크린샷 baseline (360/390/412)
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

// ── 라벨-필드 세로 비겹침 헬퍼 ─────────────────────────
// label이 field 위에 있을 때: label.bottom <= field.top 이어야 함
async function assertLabelAboveField(
  page: Page,
  labelText: string,
  fieldSelector: string,
  tag = labelText,
) {
  const label = page.locator(`label:has-text("${labelText}")`).first()
  const field = page.locator(fieldSelector).first()
  await expect(label).toBeVisible({ timeout: 5000 })
  await expect(field).toBeVisible({ timeout: 5000 })
  const lBox = await label.boundingBox()
  const fBox = await field.boundingBox()
  expect(lBox, `${tag}: label not found`).not.toBeNull()
  expect(fBox, `${tag}: field not found`).not.toBeNull()
  const labelBottom = lBox!.y + lBox!.height
  expect(
    labelBottom,
    `${tag}: 라벨 하단(${labelBottom.toFixed(1)})이 필드 상단(${fBox!.y.toFixed(1)})보다 아래 — 겹침`
  ).toBeLessThanOrEqual(fBox!.y + 1) // 1px 허용 오차
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
//  L-01 / L-02 / L-03  수평 스크롤 없음 (360 / 390 / 412px)
// ════════════════════════════════════════════════════════
test.describe('[LAYOUT] 수평 스크롤', () => {
  const VIEWPORTS: [number, number, string][] = [
    [360, 800, 'L-01'],
    [390, 844, 'L-02'],
    [412, 915, 'L-03'],
  ]
  for (const [width, height, id] of VIEWPORTS) {
    test(`${id} 수평 스크롤 없음 (${width}px)`, async ({ browser }) => {
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
//  L-04~L-07  입력 필드 높이 44px 이상 (390px)
// ════════════════════════════════════════════════════════
test.describe('[LAYOUT] 입력 필드 최소 높이', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test.beforeEach(async ({ page }) => {
    await ensureAdmin(page)
    await mockInitialApis(page)
    await gotoContractsNew(page)
  })

  const MIN_H = 44

  test('L-04 세부공종 input 높이 ≥ 44px', async ({ page }) => {
    const box = await getBox(page, 'input[placeholder*="동력반"]')
    expect(box, '세부공종 input not found').not.toBeNull()
    expect(box!.height, `세부공종 height=${box!.height}px`).toBeGreaterThanOrEqual(MIN_H)
  })

  test('L-05 세부직종 input 높이 ≥ 44px', async ({ page }) => {
    const box = await getBox(page, 'input[placeholder*="전기기능사"]')
    expect(box, '세부직종 input not found').not.toBeNull()
    expect(box!.height, `세부직종 height=${box!.height}px`).toBeGreaterThanOrEqual(MIN_H)
  })

  test('L-06 공종 select 높이 ≥ 44px', async ({ page }) => {
    const section = page.locator('div:has(> h2:has-text("2단계"))')
    const selects = section.locator('select')
    const box = await selects.first().boundingBox()
    expect(box, '공종 select not found').not.toBeNull()
    expect(box!.height, `공종 select height=${box!.height}px`).toBeGreaterThanOrEqual(MIN_H)
  })

  test('L-07 직종 select 높이 ≥ 44px', async ({ page }) => {
    const section = page.locator('div:has(> h2:has-text("2단계"))')
    const selects = section.locator('select')
    const box = await selects.nth(1).boundingBox()
    expect(box, '직종 select not found').not.toBeNull()
    expect(box!.height, `직종 select height=${box!.height}px`).toBeGreaterThanOrEqual(MIN_H)
  })
})

// ════════════════════════════════════════════════════════
//  L-08  라벨 미클립 — 잘리거나 0px가 되지 않을 것 (390px)
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
    test(`L-08 라벨 미클립 — "${label}"`, async ({ page }) => {
      const el = page.locator(`label:has-text("${label}")`).first()
      await expect(el).toBeVisible({ timeout: 5000 })
      const box = await el.boundingBox()
      expect(box, `"${label}" label not found`).not.toBeNull()
      expect(box!.width,  `"${label}" label width=0`).toBeGreaterThan(0)
      expect(box!.height, `"${label}" label height=0`).toBeGreaterThan(0)
      expect(box!.x + box!.width, `"${label}" label 밖으로 밀림`).toBeLessThanOrEqual(390)
    })
  }
})

// ════════════════════════════════════════════════════════
//  L-09  플로팅 버튼이 2단계 필드를 덮지 않음 (390px)
// ════════════════════════════════════════════════════════
test.describe('[LAYOUT] 플로팅 버튼 겹침', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('L-09 플로팅 버튼이 2단계 입력 필드를 덮지 않음', async ({ page }) => {
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
//  L-10 / L-11 / L-12  Step2 스크린샷 baseline (360/390/412px)
// ════════════════════════════════════════════════════════
test.describe('[LAYOUT] Step2 스크린샷 baseline', () => {
  const VIEWPORTS: [number, number, string][] = [
    [360, 800,  'L-10'],
    [390, 844,  'L-11'],
    [412, 915,  'L-12'],
  ]
  for (const [width, height, id] of VIEWPORTS) {
    test(`${id} Step2 섹션 스크린샷 (${width}px)`, async ({ browser }) => {
      const ctx  = await browser.newContext({ viewport: { width, height }, colorScheme: 'dark' })
      const page = await ctx.newPage()
      await ensureAdmin(page)
      await mockInitialApis(page)
      await gotoContractsNew(page)

      const section = page.locator('div:has(> h2:has-text("2단계"))')
      await expect(section).toBeVisible({ timeout: 5000 })
      await section.screenshot({ path: path.join(SHOT_DIR, `step2-${width}px.png`) })
      await expect(section).toHaveScreenshot(`step2-${width}px.png`, {
        maxDiffPixelRatio: 0.02, animations: 'disabled',
      })
      await ctx.close()
    })
  }
})

// ════════════════════════════════════════════════════════
//  L-13  세부공종 라벨↔필드 세로 비겹침 (360/390/412px)
// ════════════════════════════════════════════════════════
test.describe('[LAYOUT] 세부공종 라벨-필드 비겹침', () => {
  const VIEWPORTS: [number, number][] = [[360, 800], [390, 844], [412, 915]]

  for (const [width, height] of VIEWPORTS) {
    test(`L-13 세부공종 라벨↔input 비겹침 (${width}px)`, async ({ browser }) => {
      const ctx  = await browser.newContext({ viewport: { width, height } })
      const page = await ctx.newPage()
      await ensureAdmin(page)
      await mockInitialApis(page)
      await gotoContractsNew(page)

      await assertLabelAboveField(
        page,
        '세부공종',
        'input[placeholder*="동력반"]',
        `세부공종@${width}px`,
      )
      await ctx.close()
    })
  }
})

// ════════════════════════════════════════════════════════
//  L-14  세부직종 라벨↔필드 세로 비겹침 (360/390/412px)
// ════════════════════════════════════════════════════════
test.describe('[LAYOUT] 세부직종 라벨-필드 비겹침', () => {
  const VIEWPORTS: [number, number][] = [[360, 800], [390, 844], [412, 915]]

  for (const [width, height] of VIEWPORTS) {
    test(`L-14 세부직종 라벨↔input 비겹침 (${width}px)`, async ({ browser }) => {
      const ctx  = await browser.newContext({ viewport: { width, height } })
      const page = await ctx.newPage()
      await ensureAdmin(page)
      await mockInitialApis(page)
      await gotoContractsNew(page)

      await assertLabelAboveField(
        page,
        '세부직종',
        'input[placeholder*="전기기능사"]',
        `세부직종@${width}px`,
      )
      await ctx.close()
    })
  }
})

// ════════════════════════════════════════════════════════
//  L-15  Step3 회사 라벨↔select 세로 비겹침 (360/390/412px)
// ════════════════════════════════════════════════════════
test.describe('[LAYOUT] Step3 회사 라벨-필드 비겹침', () => {
  const VIEWPORTS: [number, number][] = [[360, 800], [390, 844], [412, 915]]

  for (const [width, height] of VIEWPORTS) {
    test(`L-15 Step3 회사 라벨↔select 비겹침 (${width}px)`, async ({ browser }) => {
      const ctx  = await browser.newContext({ viewport: { width, height } })
      const page = await ctx.newPage()
      await ensureAdmin(page)
      await mockInitialApis(page)
      await page.goto(`${BASE}/admin/contracts/new`)
      // Step3 헤더 대기
      await expect(page.locator('h2:has-text("3단계: 기본 정보")')).toBeVisible({ timeout: 15000 })
      await page.locator('h2:has-text("3단계: 기본 정보")').scrollIntoViewIfNeeded()
      await page.waitForTimeout(300)

      // 회사 (자동채움용) 라벨 vs 첫 번째 select
      const step3 = page.locator('div:has(> h2:has-text("3단계"))')
      const companyLabel = step3.locator('label:has-text("회사")').first()
      const companySelect = step3.locator('select').first()

      await expect(companyLabel).toBeVisible({ timeout: 5000 })
      await expect(companySelect).toBeVisible({ timeout: 5000 })

      const lBox = await companyLabel.boundingBox()
      const fBox = await companySelect.boundingBox()
      expect(lBox, `회사 label not found @${width}px`).not.toBeNull()
      expect(fBox, `회사 select not found @${width}px`).not.toBeNull()

      const labelBottom = lBox!.y + lBox!.height
      expect(
        labelBottom,
        `Step3 회사 라벨 하단(${labelBottom.toFixed(1)})이 select 상단(${fBox!.y.toFixed(1)})과 겹침 @${width}px`
      ).toBeLessThanOrEqual(fBox!.y + 1)

      await ctx.close()
    })
  }
})

// ════════════════════════════════════════════════════════
//  L-16  라벨 텍스트 단일 행 검증 (writing-mode + 줄수) (390px)
// ════════════════════════════════════════════════════════
test.describe('[LAYOUT] 라벨 단일 행', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test.beforeEach(async ({ page }) => {
    await ensureAdmin(page)
    await mockInitialApis(page)
    await gotoContractsNew(page)
  })

  // Step2 라벨 + Step3 회사 라벨
  const STEP2_LABELS = ['공종', '세부공종', '직종', '세부직종', '담당업무']

  for (const labelText of STEP2_LABELS) {
    test(`L-16 라벨 단일 행 — "${labelText}"`, async ({ page }) => {
      const el = page.locator(`label:has-text("${labelText}")`).first()
      await expect(el).toBeVisible({ timeout: 5000 })

      const { writingMode, lineCount } = await el.evaluate(node => {
        const s   = window.getComputedStyle(node)
        const lhRaw = s.lineHeight
        const lh  = lhRaw === 'normal'
          ? parseFloat(s.fontSize) * 1.4
          : parseFloat(lhRaw)
        const h   = node.getBoundingClientRect().height
        return {
          writingMode: s.writingMode,
          lineCount:   lh > 0 ? Math.round(h / lh) : 1,
        }
      })

      expect(
        writingMode,
        `"${labelText}" writing-mode=${writingMode} — 세로 배치`
      ).toBe('horizontal-tb')

      expect(
        lineCount,
        `"${labelText}" 라벨이 ${lineCount}줄로 표시됨 (1줄 기대)`
      ).toBeLessThanOrEqual(1)
    })
  }
})

// ════════════════════════════════════════════════════════
//  L-17  같은 열 내 필드 x좌표 정렬 오차 ≤ 4px (390px)
//
//  실제 레이아웃: sm:grid-cols-2 가 390px에서도 적용됨
//    col1(x≈37): 공종 select, 직종 select, 공사명 input, 담당업무 input
//    col2(x≈142): 세부공종 input, 세부직종 input
//  → 같은 열끼리만 x 일치 여부를 검사한다.
// ════════════════════════════════════════════════════════
test.describe('[LAYOUT] 필드 x좌표 정렬', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test.beforeEach(async ({ page }) => {
    await ensureAdmin(page)
    await mockInitialApis(page)
    await gotoContractsNew(page)
  })

  test('L-17a col1 필드(공종·직종·담당업무) left x 오차 ≤ 4px', async ({ page }) => {
    const section = page.locator('div:has(> h2:has-text("2단계"))')
    const targets = [
      { sel: () => section.locator('select').first(),            label: '공종 select'   },
      { sel: () => section.locator('select').nth(1),             label: '직종 select'   },
      { sel: () => section.locator('input[placeholder*="포설"]'), label: '담당업무 input'},
    ]
    const xs: { label: string; x: number }[] = []
    for (const t of targets) {
      const el = t.sel()
      if (!await el.isVisible().catch(() => false)) continue
      const box = await el.boundingBox()
      if (box) xs.push({ label: t.label, x: box.x })
    }
    expect(xs.length, 'col1 정렬 검사 대상 없음').toBeGreaterThan(1)
    const spread = Math.max(...xs.map(e => e.x)) - Math.min(...xs.map(e => e.x))
    expect(
      spread,
      `col1 x 오차 ${spread.toFixed(1)}px 초과\n` + xs.map(e => `  ${e.label}: x=${e.x.toFixed(1)}`).join('\n')
    ).toBeLessThanOrEqual(4)
  })

  test('L-17b col2 필드(세부공종·세부직종) left x 오차 ≤ 4px', async ({ page }) => {
    const section = page.locator('div:has(> h2:has-text("2단계"))')
    const targets = [
      { sel: () => section.locator('input[placeholder*="동력반"]'),    label: '세부공종 input'},
      { sel: () => section.locator('input[placeholder*="전기기능사"]'), label: '세부직종 input'},
    ]
    const xs: { label: string; x: number }[] = []
    for (const t of targets) {
      const el = t.sel()
      if (!await el.isVisible().catch(() => false)) continue
      const box = await el.boundingBox()
      if (box) xs.push({ label: t.label, x: box.x })
    }
    expect(xs.length, 'col2 정렬 검사 대상 없음').toBeGreaterThan(1)
    const spread = Math.max(...xs.map(e => e.x)) - Math.min(...xs.map(e => e.x))
    expect(
      spread,
      `col2 x 오차 ${spread.toFixed(1)}px 초과\n` + xs.map(e => `  ${e.label}: x=${e.x.toFixed(1)}`).join('\n')
    ).toBeLessThanOrEqual(4)
  })

  test('L-17c col2 x가 col1 x보다 큼 (2열 구분 유지)', async ({ page }) => {
    const section = page.locator('div:has(> h2:has-text("2단계"))')
    const col1Box  = await section.locator('select').first().boundingBox()
    const col2Box  = await section.locator('input[placeholder*="동력반"]').first().boundingBox()
    expect(col1Box, 'col1 field not found').not.toBeNull()
    expect(col2Box, 'col2 field not found').not.toBeNull()
    expect(
      col2Box!.x,
      `col2 x(${col2Box!.x.toFixed(1)}) ≤ col1 x(${col1Box!.x.toFixed(1)}) — 2열 구분 붕괴`
    ).toBeGreaterThan(col1Box!.x + 10)
  })
})

// ════════════════════════════════════════════════════════
//  L-18  select 오버플로우 없음 + 우측 경계 뷰포트 내 (390px)
// ════════════════════════════════════════════════════════
test.describe('[LAYOUT] select 오버플로우', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('L-18 select 오버플로우 없음 + 우측 경계 뷰포트 내', async ({ page }) => {
    await ensureAdmin(page)
    await mockInitialApis(page)
    await gotoContractsNew(page)

    // Step2의 select 2개 + Step3 최상단 회사 select
    const step2 = page.locator('div:has(> h2:has-text("2단계"))')
    const step3 = page.locator('div:has(> h2:has-text("3단계"))')

    // Step3 스크롤
    await page.locator('h2:has-text("3단계: 기본 정보")').scrollIntoViewIfNeeded()
    await page.waitForTimeout(200)

    const selects = [
      { loc: step2.locator('select').first(), name: 'Step2 공종' },
      { loc: step2.locator('select').nth(1),  name: 'Step2 직종' },
      { loc: step3.locator('select').first(), name: 'Step3 회사' },
    ]

    for (const { loc, name } of selects) {
      const visible = await loc.isVisible().catch(() => false)
      if (!visible) continue

      // 내부 오버플로우 없음
      const overflow = await loc.evaluate(el =>
        (el as HTMLSelectElement).scrollWidth > (el as HTMLSelectElement).offsetWidth
      )
      expect(overflow, `${name}: select 내부 오버플로우`).toBe(false)

      // 우측 경계 ≤ 뷰포트 우측
      const box = await loc.boundingBox()
      expect(box, `${name}: select not found`).not.toBeNull()
      expect(
        box!.x + box!.width,
        `${name}: select 우측(${(box!.x + box!.width).toFixed(1)})이 뷰포트(390) 밖으로 나감`
      ).toBeLessThanOrEqual(390)
    }
  })
})

// ════════════════════════════════════════════════════════
//  L-19  Step3 회사 선택 영역 스크린샷 baseline (360/390/412px)
// ════════════════════════════════════════════════════════
test.describe('[LAYOUT] Step3 회사 선택 스크린샷 baseline', () => {
  const VIEWPORTS: [number, number, string][] = [
    [360, 800,  'L-19a'],
    [390, 844,  'L-19b'],
    [412, 915,  'L-19c'],
  ]
  for (const [width, height, id] of VIEWPORTS) {
    test(`${id} Step3 회사 선택 영역 스크린샷 (${width}px)`, async ({ browser }) => {
      const ctx  = await browser.newContext({ viewport: { width, height }, colorScheme: 'dark' })
      const page = await ctx.newPage()
      await ensureAdmin(page)
      await mockInitialApis(page)
      await page.goto(`${BASE}/admin/contracts/new`)
      await expect(page.locator('h2:has-text("3단계: 기본 정보")')).toBeVisible({ timeout: 15000 })
      await page.locator('h2:has-text("3단계: 기본 정보")').scrollIntoViewIfNeeded()
      await page.waitForTimeout(300)

      const section = page.locator('div:has(> h2:has-text("3단계"))')
      await expect(section).toBeVisible({ timeout: 5000 })
      await section.screenshot({ path: path.join(SHOT_DIR, `step3-company-${width}px.png`) })
      await expect(section).toHaveScreenshot(`step3-company-${width}px.png`, {
        maxDiffPixelRatio: 0.02, animations: 'disabled',
      })
      await ctx.close()
    })
  }
})
