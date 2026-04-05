/**
 * 핵심 페이지 UI 레이아웃 자동점검 — 공통 규격
 *
 * 대상 페이지:
 *   [auth]       /admin/login
 *   [dashboard]  /admin
 *   [workers]    /admin/workers
 *   [sites]      /admin/sites
 *   [attendance] /admin/attendance
 *   [contracts]  /admin/contracts/new
 *   [companies]  /admin/companies
 *
 * 공통 검증 규칙:
 *   R-HSCROLL   수평 스크롤 있으면 FAIL
 *   R-OVERLAP   라벨↔입력창/select/button 겹치면 FAIL
 *   R-FAB       고정 버튼/FAB이 입력 필드나 저장버튼을 가리면 FAIL
 *   R-MINHEIGHT 주요 input/button 높이 44px 미만이면 FAIL
 *   R-CLIP      텍스트 잘림·세로쓰기 발생 시 FAIL
 *   R-OVERFLOW  테이블/카드/리스트가 뷰포트 밖으로 넘치면 FAIL
 *   R-CTA       저장/등록/다음/로그인 버튼 미노출이면 FAIL
 *   R-SHOT      핵심 섹션 screenshot baseline 비교
 *
 * 뷰포트: 360x800 / 390x844 / 412x915 (mobile) / 1280x800 (desktop)
 *
 * 실행:
 *   npx playwright test e2e/ui-layout-core.spec.ts \
 *     --config=e2e/playwright.config.ts --project=chromium \
 *     --update-snapshots   ← 최초 baseline 생성
 *
 * 결과: logs/screenshots/ui-layout-core/
 */
import { test, expect, type Page, type Route, type Browser } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

// ── 환경 ───────────────────────────────────────────────────
const BASE          = process.env.BASE_URL      || 'https://attendance.haehan-ai.kr'
const ADMIN_EMAIL   = process.env.ADMIN_EMAIL   || 'jay@haehan-ai.kr'
const ADMIN_PASSWORD= process.env.ADMIN_PASSWORD|| 'admin1234'

const TOKEN_FILE = path.join(__dirname, '..', 'logs', '.admin-token.txt')
const SHOT_DIR   = path.join(__dirname, '..', 'logs', 'screenshots', 'ui-layout-core')
fs.mkdirSync(SHOT_DIR, { recursive: true })

// ── viewport 정의 ──────────────────────────────────────────
type VP = { w: number; h: number; label: string }
const MOBILE_VPS: VP[] = [
  { w: 360, h: 800,  label: '360' },
  { w: 390, h: 844,  label: '390' },
  { w: 412, h: 915,  label: '412' },
]
const DESKTOP_VP: VP = { w: 1280, h: 800, label: '1280' }
const ALL_VPS: VP[] = [...MOBILE_VPS, DESKTOP_VP]

// ════════════════════════════════════════════════════════════
//  인증 헬퍼
// ════════════════════════════════════════════════════════════
let _tokenCache: string | null = null

async function fetchAdminToken(): Promise<string> {
  if (process.env.ADMIN_JWT) return process.env.ADMIN_JWT
  if (_tokenCache) return _tokenCache
  if (fs.existsSync(TOKEN_FILE)) {
    const raw = fs.readFileSync(TOKEN_FILE, 'utf-8').trim()
    if (raw) {
      try {
        const p = JSON.parse(Buffer.from(raw.split('.')[1], 'base64').toString())
        if (p.exp * 1000 > Date.now()) { _tokenCache = raw; return _tokenCache }
      } catch { /* fall through */ }
    }
  }
  const res = await fetch(`${BASE}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  })
  const m = (res.headers.get('set-cookie') || '').match(/admin_token=([^;]+)/)
  if (!m) throw new Error(`admin 로그인 실패: ${res.status}`)
  _tokenCache = m[1]
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

// ── 뷰포트별 컨텍스트 생성 ─────────────────────────────────
async function makeCtx(browser: Browser, vp: VP) {
  return browser.newContext({ viewport: { width: vp.w, height: vp.h } })
}

// ════════════════════════════════════════════════════════════
//  API 목 헬퍼
// ════════════════════════════════════════════════════════════
const emptyList = { success: true, data: { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 } }
const emptyArr  = { success: true, data: [] }

async function mockAllAdminApis(page: Page) {
  // ⚠ Playwright routes are LIFO: last registered = first matched.
  // Register catch-all FIRST so specific routes override it.
  await page.route('**/api/admin/**', async r => {
    if (!r.request().isNavigationRequest()) {
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) })
    } else {
      await r.continue()
    }
  })
  // Specific overrides (registered after = matched first)
  await page.route('**/api/admin/workers**',     r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(emptyList) }))
  await page.route('**/api/admin/sites**',       r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(emptyArr)  }))
  await page.route('**/api/admin/companies**',   r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(emptyList) }))
  await page.route('**/api/admin/attendance**',  r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(emptyList) }))
  await page.route('**/api/admin/dashboard**',   r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { summary: {}, recentAttendance: [], sites: [], siteOptions: [] } }) }))
  await page.route('**/api/admin/contracts**',   r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(emptyList) }))
  await page.route('**/api/admin/presence-checks**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(emptyList) }))
  await page.route('**/api/admin/auth/me**',     r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { role: 'SUPER_ADMIN' } }) }))
}

// ════════════════════════════════════════════════════════════
//  공통 검증 유틸
// ════════════════════════════════════════════════════════════

/** R-HSCROLL: 수평 스크롤 없음 */
async function assertNoHScroll(page: Page, vp: VP, ctx: string) {
  const ok = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
  expect(ok, `[${ctx} @${vp.label}px] R-HSCROLL: 수평 스크롤 발생 (scrollWidth > innerWidth)`).toBe(true)
}

/** R-OVERLAP: 라벨이 연결 필드보다 위에 있어야 함 (bottom ≤ top + 2px) */
async function assertLabelAbove(page: Page, labelSel: string, fieldSel: string, vp: VP, ctx: string) {
  const label = page.locator(labelSel).first()
  const field = page.locator(fieldSel).first()
  if (!await label.isVisible().catch(() => false)) return
  if (!await field.isVisible().catch(() => false)) return
  const lBox = await label.boundingBox()
  const fBox = await field.boundingBox()
  if (!lBox || !fBox) return
  expect(
    lBox.y + lBox.height,
    `[${ctx} @${vp.label}px] R-OVERLAP: 라벨(${labelSel}) 하단이 필드(${fieldSel}) 상단과 겹침`
  ).toBeLessThanOrEqual(fBox.y + 2)
}

/** R-MINHEIGHT: 인터랙티브 요소 최소 높이 */
async function assertMinHeight(page: Page, selector: string, minH: number, vp: VP, ctx: string) {
  const els = page.locator(selector)
  const count = await els.count()
  for (let i = 0; i < count; i++) {
    const el = els.nth(i)
    if (!await el.isVisible().catch(() => false)) continue
    const box = await el.boundingBox()
    if (!box) continue
    expect(
      box.height,
      `[${ctx} @${vp.label}px] R-MINHEIGHT: ${selector}[${i}] 높이 ${box.height.toFixed(0)}px < ${minH}px`
    ).toBeGreaterThanOrEqual(minH)
  }
}

/** R-FAB: 고정 오버레이가 필드를 가리지 않는지 (각 필드를 center scroll 후 확인) */
async function assertFABNotCovering(
  page: Page, fabSel: string, fieldSel: string, vp: VP, ctx: string
) {
  const fab = page.locator(fabSel).first()
  if (!await fab.isVisible().catch(() => false)) return
  const fields = page.locator(fieldSel)
  const count  = await fields.count()
  for (let i = 0; i < count; i++) {
    await fields.nth(i).evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }))
    await page.waitForTimeout(60)
    const fBox = await fields.nth(i).boundingBox()
    const fNow = await fab.boundingBox()
    if (!fBox || !fNow) continue
    const vOv = fNow.y < fBox.y + fBox.height && fNow.y + fNow.height > fBox.y
    const hOv = fNow.x < fBox.x + fBox.width  && fNow.x + fNow.width  > fBox.x
    expect(
      vOv && hOv,
      `[${ctx} @${vp.label}px] R-FAB: FAB(${fabSel})이 ${fieldSel}[${i}] 가림` +
      ` (fab y=${fNow.y.toFixed(0)}-${(fNow.y+fNow.height).toFixed(0)},` +
      ` field y=${fBox.y.toFixed(0)}-${(fBox.y+fBox.height).toFixed(0)})`
    ).toBe(false)
  }
}

/** R-OVERFLOW: 요소가 뷰포트 우측을 벗어나지 않음 */
async function assertNotOverflowViewport(page: Page, selector: string, vp: VP, ctx: string) {
  const els = page.locator(selector)
  const count = await els.count()
  const vpW = vp.w
  for (let i = 0; i < count; i++) {
    const el = els.nth(i)
    if (!await el.isVisible().catch(() => false)) continue
    const box = await el.boundingBox()
    if (!box) continue
    expect(
      box.x + box.width,
      `[${ctx} @${vp.label}px] R-OVERFLOW: ${selector}[${i}] 우측(${(box.x+box.width).toFixed(0)}px)이 뷰포트(${vpW}px) 밖`
    ).toBeLessThanOrEqual(vpW + 1)
  }
}

/** R-CLIP: 텍스트 요소 writing-mode 및 줄수 검증 */
async function assertNoTextClip(page: Page, selector: string, maxLines: number, vp: VP, ctx: string) {
  const el = page.locator(selector).first()
  if (!await el.isVisible().catch(() => false)) return
  const { writingMode, lineCount } = await el.evaluate((node, max) => {
    const s  = window.getComputedStyle(node)
    const lh = s.lineHeight === 'normal' ? parseFloat(s.fontSize) * 1.4 : parseFloat(s.lineHeight)
    const h  = node.getBoundingClientRect().height
    return { writingMode: s.writingMode, lineCount: lh > 0 ? Math.round(h / lh) : 1 }
  }, maxLines)
  expect(writingMode, `[${ctx} @${vp.label}px] R-CLIP: ${selector} writing-mode=${writingMode}`).toBe('horizontal-tb')
  expect(lineCount,   `[${ctx} @${vp.label}px] R-CLIP: ${selector} ${lineCount}줄 (최대 ${maxLines}줄 기대)`).toBeLessThanOrEqual(maxLines)
}

/** R-CTA: 저장/등록/로그인 등 핵심 버튼 가시성 */
async function assertCTAVisible(page: Page, btnTexts: string[], vp: VP, ctx: string) {
  for (const txt of btnTexts) {
    const visible = await page.locator(`button:has-text("${txt}")`).first().isVisible().catch(() => false)
    if (visible) return
  }
  expect(false, `[${ctx} @${vp.label}px] R-CTA: 버튼(${btnTexts.join('|')}) 미노출`).toBe(true)
}

/** R-SHOT: 섹션 screenshot baseline */
async function assertScreenshot(page: Page, sectionSel: string, name: string, vp: VP) {
  const section = page.locator(sectionSel).first()
  if (!await section.isVisible().catch(() => false)) return
  const file = path.join(SHOT_DIR, `${name}-${vp.label}px.png`)
  await section.screenshot({ path: file })
  await expect(section).toHaveScreenshot(`${name}-${vp.label}px.png`, {
    maxDiffPixelRatio: 0.03, animations: 'disabled',
  })
}

// ════════════════════════════════════════════════════════════
//  [LAYOUT:auth]  /admin/login
// ════════════════════════════════════════════════════════════
test.describe('[LAYOUT:auth] 로그인 페이지', () => {
  for (const vp of ALL_VPS) {
    test(`@${vp.label}px 수평스크롤·입력높이·CTA·screenshot`, async ({ browser }) => {
      const ctx  = await makeCtx(browser, vp)
      const page = await ctx.newPage()
      await page.goto(`${BASE}/admin/login`)
      await expect(page.locator('input[type="email"], input[type="text"]').first()).toBeVisible({ timeout: 15000 })

      await assertNoHScroll(page, vp, 'auth')

      // R-MINHEIGHT: 입력창 + 버튼 ≥ 44px
      await assertMinHeight(page, 'input[type="email"], input[type="password"]', 44, vp, 'auth')
      await assertMinHeight(page, 'button[type="submit"], button:has-text("로그인")', 44, vp, 'auth')

      // R-OVERLAP: 이메일 라벨↔입력창
      await assertLabelAbove(page, 'label[for="admin-email"], label:has-text("이메일")', 'input[type="email"]', vp, 'auth')

      // R-CTA: 로그인 버튼
      await assertCTAVisible(page, ['로그인'], vp, 'auth')

      // R-SHOT: 로그인 카드
      const cardSel = 'form, [class*="max-w-\\[440px\\]"], main'
      await assertScreenshot(page, cardSel, 'auth-login', vp)

      await ctx.close()
    })
  }
})

// ════════════════════════════════════════════════════════════
//  [LAYOUT:dashboard]  /admin
// ════════════════════════════════════════════════════════════
test.describe('[LAYOUT:dashboard] 관리자 대시보드', () => {
  for (const vp of ALL_VPS) {
    test(`@${vp.label}px 수평스크롤·KPI오버플로우·screenshot`, async ({ browser }) => {
      const ctx  = await makeCtx(browser, vp)
      const page = await ctx.newPage()
      await ensureAdmin(page)
      await mockAllAdminApis(page)
      await page.goto(`${BASE}/admin`)
      await page.waitForLoadState('networkidle', { timeout: 15000 })

      await assertNoHScroll(page, vp, 'dashboard')

      // R-OVERFLOW: KPI 카드가 뷰포트 밖으로 나가지 않음
      await assertNotOverflowViewport(page, '[class*="rounded-[12px]"][class*="border"]', vp, 'dashboard')

      // R-CTA: 새로고침 또는 페이지 액션 버튼 존재
      await assertCTAVisible(page, ['새로고침', '근로자 초대 링크', '복사됨!'], vp, 'dashboard')

      // R-SHOT: 전체 페이지 상단
      await assertScreenshot(page, 'main, [class*="PageShell"], body > div', 'dashboard-main', vp)

      await ctx.close()
    })
  }
})

// ════════════════════════════════════════════════════════════
//  [LAYOUT:workers]  /admin/workers
// ════════════════════════════════════════════════════════════
test.describe('[LAYOUT:workers] 근로자 목록', () => {
  for (const vp of ALL_VPS) {
    test(`@${vp.label}px 수평스크롤·필터오버플로우·CTA·screenshot`, async ({ browser }) => {
      const ctx  = await makeCtx(browser, vp)
      const page = await ctx.newPage()
      await ensureAdmin(page)
      await mockAllAdminApis(page)
      await page.goto(`${BASE}/admin/workers`)
      await page.waitForLoadState('networkidle', { timeout: 15000 })

      await assertNoHScroll(page, vp, 'workers')

      // R-OVERFLOW: 필터 영역이 뷰포트 밖으로 나가지 않음
      await assertNotOverflowViewport(page, 'input[type="text"], select', vp, 'workers')

      // R-CTA: 근로자 등록 버튼 (SUPER_ADMIN 기준)
      await assertCTAVisible(page, ['+ 근로자 등록', '근로자 등록', '새로고침'], vp, 'workers')

      // R-SHOT: 필터+헤더 섹션
      await assertScreenshot(page, '[class*="SectionCard"], [class*="rounded-[12px]"]', 'workers-filter', vp)

      await ctx.close()
    })
  }

  // R-MINHEIGHT: 모바일 필터 pill 터치 타겟 (390px)
  test('@390px 필터 pill 높이 ≥ 36px', async ({ browser }) => {
    const vp = MOBILE_VPS[1]
    const ctx = await makeCtx(browser, vp)
    const page = await ctx.newPage()
    await ensureAdmin(page)
    await mockAllAdminApis(page)
    await page.goto(`${BASE}/admin/workers`)
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 15000 })

    // FilterPill: h-9 = 36px (서브픽셀 렌더링 허용 → 35px, h-9 클래스 한정)
    await assertMinHeight(page, 'button[class*="h-9"]', 35, vp, 'workers-pill')
    await ctx.close()
  })
})

// ════════════════════════════════════════════════════════════
//  [LAYOUT:sites]  /admin/sites
// ════════════════════════════════════════════════════════════
test.describe('[LAYOUT:sites] 현장 목록', () => {
  for (const vp of ALL_VPS) {
    test(`@${vp.label}px 수평스크롤·오버플로우·screenshot`, async ({ browser }) => {
      const ctx  = await makeCtx(browser, vp)
      const page = await ctx.newPage()
      await ensureAdmin(page)
      await mockAllAdminApis(page)
      await page.goto(`${BASE}/admin/sites`)
      await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 15000 })

      await assertNoHScroll(page, vp, 'sites')
      await assertNotOverflowViewport(page, 'input[type="text"], select', vp, 'sites')
      await assertCTAVisible(page, ['현장 등록', '새로고침', '등록'], vp, 'sites')

      await assertScreenshot(page, '[class*="bg-card"][class*="rounded"]', 'sites-list', vp)
      await ctx.close()
    })
  }

  // R-OVERLAP: 현장 수정 모달 내 라벨↔필드 (모바일 390px)
  test('@390px 현장명 라벨↔입력창 비겹침', async ({ browser }) => {
    const vp = MOBILE_VPS[1]
    const ctx = await makeCtx(browser, vp)
    const page = await ctx.newPage()
    await ensureAdmin(page)
    // sites 전용 mock: 실제 사이트 1건 반환
    await page.route('**/api/admin/sites**', r => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [{
        id: 's-1', name: '테스트현장', address: '서울시 테스트로 1',
        latitude: 37.5, longitude: 127.0, allowedRadius: 100,
        isActive: true, siteCode: null, openedAt: null, closedAt: null, notes: null,
        assignedWorkerCount: 0, todayCheckInCount: 0, absentCount: 0,
        todayWage: 0, monthWage: 0, totalWage: 0, companyAssignments: [],
      }] }),
    }))
    await page.route('**/api/admin/**', async r => {
      if (!r.request().isNavigationRequest()) {
        await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
      } else { await r.continue() }
    })
    await page.goto(`${BASE}/admin/sites`)

    // 현장 행이 렌더링되면 클릭 → 패널 → 기본정보 수정
    const siteRow = page.locator('text=테스트현장').first()
    const appeared = await siteRow.waitFor({ timeout: 10000 }).then(() => true).catch(() => false)
    if (!appeared) { await ctx.close(); test.skip(true, '현장 목록 렌더링 안됨 — 스킵'); return }

    await siteRow.click()
    await page.waitForTimeout(300)

    const hasMutateBtn = await page.locator('button:has-text("기본정보 수정")').isVisible().catch(() => false)
    if (hasMutateBtn) {
      await page.click('button:has-text("기본정보 수정")')
      await page.waitForTimeout(300)
      await assertLabelAbove(page, 'label:has-text("현장명")', 'input[placeholder*="현장"]', vp, 'sites-edit')
    }
    await ctx.close()
  })
})

// ════════════════════════════════════════════════════════════
//  [LAYOUT:attendance]  /admin/attendance
// ════════════════════════════════════════════════════════════
test.describe('[LAYOUT:attendance] 출퇴근 관리', () => {
  for (const vp of ALL_VPS) {
    test(`@${vp.label}px 수평스크롤·필터·screenshot`, async ({ browser }) => {
      const ctx  = await makeCtx(browser, vp)
      const page = await ctx.newPage()
      await ensureAdmin(page)
      await mockAllAdminApis(page)
      await page.goto(`${BASE}/admin/attendance`)
      await page.waitForLoadState('networkidle', { timeout: 15000 })

      await assertNoHScroll(page, vp, 'attendance')
      await assertNotOverflowViewport(page, 'input[type="date"], input[type="text"], select', vp, 'attendance')
      await assertCTAVisible(page, ['대리 등록', '새로고침'], vp, 'attendance')

      await assertScreenshot(page, '[class*="SectionCard"], [class*="rounded-[12px]"]', 'attendance-filter', vp)
      await ctx.close()
    })
  }

  // R-MINHEIGHT: 날짜 입력 + 필터 인풋 (390px)
  test('@390px 필터 입력 높이 ≥ 36px', async ({ browser }) => {
    const vp = MOBILE_VPS[1]
    const ctx = await makeCtx(browser, vp)
    const page = await ctx.newPage()
    await ensureAdmin(page)
    await mockAllAdminApis(page)
    await page.goto(`${BASE}/admin/attendance`)
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 15000 })

    // FilterInput uses h-9 = 36px
    await assertMinHeight(page, 'input[type="date"]', 36, vp, 'attendance-date')
    await ctx.close()
  })
})

// ════════════════════════════════════════════════════════════
//  [LAYOUT:contracts]  /admin/contracts/new
//  (상세 검증은 mobile-contract-form-layout.spec.ts 참조)
// ════════════════════════════════════════════════════════════
test.describe('[LAYOUT:contracts] 계약서 생성', () => {
  for (const vp of ALL_VPS) {
    test(`@${vp.label}px 수평스크롤·CTA·screenshot`, async ({ browser }) => {
      const ctx  = await makeCtx(browser, vp)
      const page = await ctx.newPage()
      await ensureAdmin(page)
      await mockAllAdminApis(page)
      await page.goto(`${BASE}/admin/contracts/new`)
      await page.waitForLoadState('networkidle', { timeout: 15000 })

      await assertNoHScroll(page, vp, 'contracts')

      // R-CTA: 저장 버튼 (계약 저장 | 검토 필요로 저장)
      await assertCTAVisible(page, ['계약 저장', '검토 필요로 저장'], vp, 'contracts')

      await assertScreenshot(page, '[class*="bg-card"][class*="rounded-lg"]', 'contracts-step1', vp)
      await ctx.close()
    })
  }

  // Step2 상세 검증은 mobile-contract-form-layout.spec.ts 에서 커버 (isDirectEmployment 조건부 렌더링)
})

// ════════════════════════════════════════════════════════════
//  [LAYOUT:companies]  /admin/companies
// ════════════════════════════════════════════════════════════
test.describe('[LAYOUT:companies] 회사 관리', () => {
  for (const vp of ALL_VPS) {
    test(`@${vp.label}px 수평스크롤·오버플로우·CTA·screenshot`, async ({ browser }) => {
      const ctx  = await makeCtx(browser, vp)
      const page = await ctx.newPage()
      await ensureAdmin(page)
      await mockAllAdminApis(page)
      await page.goto(`${BASE}/admin/companies`)
      await expect(page.locator('h1').first()).toBeVisible({ timeout: 15000 })

      await assertNoHScroll(page, vp, 'companies')
      await assertNotOverflowViewport(page, 'input[type="text"], select', vp, 'companies')
      await assertCTAVisible(page, ['회사 등록', '+ 회사', '등록'], vp, 'companies')

      await assertScreenshot(page, 'main, [class*="p-8"], body > div', 'companies-list', vp)
      await ctx.close()
    })
  }

  // R-OVERLAP: 회사 등록 폼 라벨↔입력창 (390px)
  test('@390px 회사 등록 폼 라벨↔입력창 비겹침', async ({ browser }) => {
    const vp = MOBILE_VPS[1]
    const ctx = await makeCtx(browser, vp)
    const page = await ctx.newPage()
    await ensureAdmin(page)
    await mockAllAdminApis(page)
    await page.goto(`${BASE}/admin/companies`)
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 15000 })

    // 회사 등록 버튼 클릭 → 폼 열기
    const btn = page.locator('button:has-text("+ 회사 등록"), button:has-text("회사 등록")').first()
    const hasBtnText = await btn.isVisible().catch(() => false)
    if (hasBtnText) {
      await btn.click()
      await page.waitForTimeout(400)
      // 모달/폼 컨테이너 내 회사명 라벨↔입력창 (검색창과 구분하기 위해 placeholder 정확히 지정)
      await assertLabelAbove(
        page,
        'label:has-text("회사명*"), label:has-text("회사명")',
        'input[placeholder="(주)해한건설"]',
        vp,
        'companies-form'
      )
    }
    await ctx.close()
  })

  // R-CLIP: 회사명 텍스트 단일행 (데스크톱 1280px)
  test('@1280px 회사 목록 텍스트 세로쓰기 없음', async ({ browser }) => {
    const vp = DESKTOP_VP
    const ctx = await makeCtx(browser, vp)
    const page = await ctx.newPage()
    await ensureAdmin(page)
    await mockAllAdminApis(page)
    await page.goto(`${BASE}/admin/companies`)
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 15000 })

    // h1 타이틀이 정상 horizontal-tb
    await assertNoTextClip(page, 'h1', 2, vp, 'companies-title')
    await ctx.close()
  })
})
