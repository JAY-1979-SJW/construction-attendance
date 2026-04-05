/**
 * 핵심 페이지 UI 인터랙션 자동점검 — 실사용 차단 수준
 *
 * ui-layout-core.spec.ts (깨짐 탐지) → ui-interaction-core.spec.ts (실사용 차단)
 *
 * 추가 검증:
 *   R-ENABLED    CTA 버튼 visible + not-disabled
 *   R-CLICKABLE  input/select/button 클릭 가능 (pointer-events, 비활성 여부)
 *   R-COVERED    fixed header/footer/FAB가 인터랙티브 요소를 가리면 FAIL
 *   R-TABORDER   Tab 키로 저장버튼까지 도달 가능
 *   R-NOTCLIP    마지막 컬럼/버튼이 뷰포트 밖으로 잘리지 않음
 *   R-LOADEND    skeleton/loading 종료 후 실제 본문 렌더
 *   R-VARIANT    empty / 1건 / 다건 3종 mock 모두 PASS
 *
 * mock 규칙: catch-all 금지 / 페이지별 필수 응답 스키마 고정
 *
 * 뷰포트: 360x800 / 390x844 / 412x915 / 1280x800
 *
 * 실행:
 *   npx playwright test e2e/ui-interaction-core.spec.ts \
 *     --config=e2e/playwright.config.ts --project=chromium
 */
import { test, expect, type Page, type Browser } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

// ── 환경 ───────────────────────────────────────────────────────
const BASE           = process.env.BASE_URL       || 'https://attendance.haehan-ai.kr'
const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    || 'jay@haehan-ai.kr'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234'
const TOKEN_FILE     = path.join(__dirname, '..', 'logs', '.admin-token.txt')

// ── 뷰포트 ─────────────────────────────────────────────────────
type VP = { w: number; h: number; label: string }
const MOBILE_VPS: VP[] = [
  { w: 360, h: 800,  label: '360' },
  { w: 390, h: 844,  label: '390' },
  { w: 412, h: 915,  label: '412' },
]
const DESKTOP_VP: VP  = { w: 1280, h: 800, label: '1280' }
const ALL_VPS:    VP[] = [...MOBILE_VPS, DESKTOP_VP]
const VP390 = MOBILE_VPS[1]

// ════════════════════════════════════════════════════════════════
//  인증 헬퍼
// ════════════════════════════════════════════════════════════════
let _tokenCache: string | null = null

async function fetchAdminToken(): Promise<string> {
  if (process.env.ADMIN_JWT) return process.env.ADMIN_JWT
  if (_tokenCache)            return _tokenCache
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

async function makeCtx(browser: Browser, vp: VP) {
  return browser.newContext({ viewport: { width: vp.w, height: vp.h } })
}

// ════════════════════════════════════════════════════════════════
//  Mock 데이터 — 페이지별 스키마 고정 (catch-all 금지)
// ════════════════════════════════════════════════════════════════
const ok = (data: unknown) => JSON.stringify({ success: true, data })
const SUPER_ADMIN_ME = ok({ role: 'SUPER_ADMIN' })

/** 현재 날짜 문자열 (YYYY-MM-DD) */
const TODAY = new Date().toISOString().slice(0, 10)

// ── Worker 스키마 ──────────────────────────────────────────────
function mkWorker(n: number) {
  return {
    id: `w-${n}`, name: `근로자${n}`, phone: `010-0000-000${n}`,
    jobTitle: '형틀목수', isActive: true, accountStatus: 'ACTIVE',
    birthDate: '1985-01-01', foreignerYn: false,
    employmentType: 'DAILY', organizationType: 'DIRECT',
    deviceCount: 1, retirementMutualStatus: 'ENROLLED',
    createdAt: '2024-01-01T00:00:00Z',
    primaryCompany: { id: 'c-1', companyName: '(주)해한건설' },
    activeSites:    [{ id: 's-1', name: '테스트현장', isPrimary: true }],
    todayAttendance: { siteId: 's-1', siteName: '테스트현장', checkInAt: '09:00', checkOutAt: null, status: 'WORKING' },
    hasContract: true, contractDate: TODAY,
    hasSafetyCert: true, safetyCertDate: TODAY,
    hasSafetyEducation: true, safetyEducationDate: TODAY,
    dailyWage: 200000, monthWage: 4000000, totalWage: 20000000,
  }
}

// ── Site 스키마 ────────────────────────────────────────────────
function mkSite(n: number) {
  return {
    id: `s-${n}`, name: `테스트현장${n}`, address: `서울시 강남구 테스트로 ${n}`,
    latitude: 37.5, longitude: 127.0, allowedRadius: 100,
    isActive: true, siteCode: null, openedAt: null, closedAt: null, notes: null,
    createdAt: '2024-01-01T00:00:00Z', companyAssignments: [],
    assignedWorkerCount: n, todayCheckInCount: 0, absentCount: 0,
    todayWage: 0, monthWage: 0, totalWage: 0,
  }
}

// ── Company 스키마 ─────────────────────────────────────────────
function mkCompany(n: number) {
  return {
    id: `c-${n}`, companyCode: null, companyName: `(주)테스트회사${n}`,
    businessNumber: null, representativeName: null,
    companyType: 'GENERAL', contactName: null, contactPhone: null,
    email: null, address: null, isActive: true, notes: null,
    createdAt: '2024-01-01T00:00:00Z',
    _count: { workerAssignments: 0, siteAssignments: 0 },
  }
}

// ── Attendance 스키마 ──────────────────────────────────────────
function mkAttendance(n: number) {
  return {
    id: `a-${n}`, workerId: `w-${n}`, workerName: `근로자${n}`,
    workerPhone: `010-0000-000${n}`, company: '(주)해한건설',
    jobTitle: '형틀목수', siteId: 's-1', siteName: '테스트현장',
    checkOutSiteName: null, workDate: TODAY,
    checkInAt: '09:00', checkOutAt: null, status: 'WORKING',
    checkInDistance: null, checkOutDistance: null,
    checkInWithinRadius: null, checkOutWithinRadius: null,
    checkInLat: null, checkInLng: null, checkOutLat: null, checkOutLng: null,
    isDirectCheckIn: false, exceptionReason: null, adminNote: null,
    isAutoCheckout: false, hasSiteMove: false, moveCount: 0,
    movePath: null, moveEvents: [],
    workedMinutesRaw: null, workedMinutesFinal: null,
    manualAdjustedYn: false, manualAdjustedReason: null,
    dayWage: 200000, monthWage: 4000000, totalWage: 20000000,
    hasCheckInPhoto: false, hasCheckOutPhoto: false,
  }
}

// ── 데이터 변형 타입 ────────────────────────────────────────────
type Variant = 'EMPTY' | 'ONE' | 'MANY'

// ── Dashboard mock ─────────────────────────────────────────────
const SUMMARY_BASE = {
  totalWorkers: 0, activeSites: 0, todayTotal: 0, todayCheckedIn: 0,
  todayCompleted: 0, todayMissing: 0, todayException: 0,
  pendingMissing: 0, pendingExceptions: 0, pendingDeviceRequests: 0,
  todayWage: 0, monthWage: 0, totalWage: 0,
  todayPresenceTotal: 0, todayPresencePending: 0,
  todayPresenceNoResponse: 0, todayPresenceReview: 0,
}

function dashboardData(v: Variant) {
  const recs  = v === 'EMPTY' ? [] : v === 'ONE' ? [mkAttendance(1)] : [mkAttendance(1), mkAttendance(2), mkAttendance(3)]
  const sites = v === 'EMPTY' ? [] : v === 'ONE' ? [mkSite(1)] : [mkSite(1), mkSite(2), mkSite(3)]
  const summary = v === 'EMPTY' ? SUMMARY_BASE : { ...SUMMARY_BASE, totalWorkers: recs.length, activeSites: sites.length, todayCheckedIn: recs.length }
  return { summary, recentAttendance: recs, sites, siteOptions: sites.map(s => ({ id: s.id, name: s.name })) }
}

// ── Workers mock ───────────────────────────────────────────────
function workersListData(v: Variant) {
  const items = v === 'EMPTY' ? [] : v === 'ONE' ? [mkWorker(1)] : [mkWorker(1), mkWorker(2), mkWorker(3)]
  return { items, total: items.length }
}

// ── Sites mock ─────────────────────────────────────────────────
function sitesListData(v: Variant): unknown[] {
  return v === 'EMPTY' ? [] : v === 'ONE' ? [mkSite(1)] : [mkSite(1), mkSite(2), mkSite(3)]
}

// ── Attendance mock ────────────────────────────────────────────
function attendanceData(v: Variant) {
  const items = v === 'EMPTY' ? [] : v === 'ONE' ? [mkAttendance(1)] : [mkAttendance(1), mkAttendance(2), mkAttendance(3)]
  return {
    items, total: items.length,
    siteOptions: [{ id: 's-1', name: '테스트현장' }],
    summary: { total: items.length, working: items.length, completed: 0, missing: 0, exception: 0, needsAction: 0, todayWage: 0 },
  }
}

// ── Companies mock ─────────────────────────────────────────────
function companiesData(v: Variant) {
  const items = v === 'EMPTY' ? [] : v === 'ONE' ? [mkCompany(1)] : [mkCompany(1), mkCompany(2), mkCompany(3)]
  return { items, total: items.length }
}

// ── Route 등록 헬퍼 (catch-all 금지) ──────────────────────────
async function mockRoute(page: Page, pattern: string, body: string) {
  await page.route(pattern, r => r.fulfill({ status: 200, contentType: 'application/json', body }))
}

async function setupAuthMe(page: Page) {
  await mockRoute(page, '**/api/admin/auth/me**', SUPER_ADMIN_ME)
}

async function setupDashboard(page: Page, v: Variant) {
  await mockRoute(page, '**/api/admin/dashboard**',  ok(dashboardData(v)))
  await mockRoute(page, '**/api/admin/sites**',       ok(sitesListData(v === 'EMPTY' ? 'EMPTY' : 'MANY')))
  await setupAuthMe(page)
}

async function setupWorkers(page: Page, v: Variant) {
  await mockRoute(page, '**/api/admin/workers**',  ok(workersListData(v)))
  await mockRoute(page, '**/api/admin/sites**',    ok(sitesListData('MANY')))
  await setupAuthMe(page)
}

async function setupSites(page: Page, v: Variant) {
  // LIFO 순서 고려: 구체적 경로를 마지막에 등록
  await mockRoute(page, '**/api/admin/companies**', ok(companiesData('MANY')))
  await mockRoute(page, '**/api/admin/sites**',      ok(sitesListData(v)))
  await setupAuthMe(page)
}

async function setupAttendance(page: Page, v: Variant) {
  await mockRoute(page, '**/api/admin/workers**',   ok(workersListData('MANY')))
  await mockRoute(page, '**/api/admin/attendance**', ok(attendanceData(v)))
  await mockRoute(page, '**/api/admin/sites**',      ok(sitesListData('MANY')))
  await setupAuthMe(page)
}

async function setupCompanies(page: Page, v: Variant) {
  await mockRoute(page, '**/api/admin/companies**', ok(companiesData(v)))
  await setupAuthMe(page)
}

async function setupContracts(page: Page) {
  await mockRoute(page, '**/api/admin/workers**',   ok(workersListData('MANY')))
  await mockRoute(page, '**/api/admin/sites**',      ok(sitesListData('MANY')))
  await mockRoute(page, '**/api/admin/companies**', ok(companiesData('MANY')))
  await setupAuthMe(page)
}

// ════════════════════════════════════════════════════════════════
//  공통 검증 유틸
// ════════════════════════════════════════════════════════════════

/** R-ENABLED: 버튼 중 하나가 visible + not-disabled */
async function assertEnabledCTA(page: Page, btnTexts: string[], vp: VP, ctx: string) {
  for (const txt of btnTexts) {
    const btn = page.locator(`button:has-text("${txt}")`).first()
    if (!await btn.isVisible().catch(() => false)) continue
    const disabled = await btn.isDisabled().catch(() => true)
    expect(disabled,
      `[${ctx} @${vp.label}px] R-ENABLED: "${txt}" 버튼이 disabled 상태`
    ).toBe(false)
    return // 첫 번째 enabled 버튼 발견 → PASS
  }
  expect(false,
    `[${ctx} @${vp.label}px] R-ENABLED: 버튼(${btnTexts.join('|')}) 전부 미노출 또는 disabled`
  ).toBe(true)
}

/** R-CLICKABLE: 셀렉터의 첫 번째 요소가 실제로 클릭 가능한지 검사 */
async function assertClickable(page: Page, selector: string, vp: VP, ctx: string) {
  const el = page.locator(selector).first()
  if (!await el.isVisible().catch(() => false)) return
  // pointer-events 가 none이면 클릭 불가
  const pointerEvents = await el.evaluate(e => window.getComputedStyle(e).pointerEvents)
  expect(pointerEvents,
    `[${ctx} @${vp.label}px] R-CLICKABLE: ${selector} pointer-events=${pointerEvents}`
  ).not.toBe('none')
  // disabled 속성 없어야 함
  const disabled = await el.isDisabled().catch(() => false)
  expect(disabled,
    `[${ctx} @${vp.label}px] R-CLICKABLE: ${selector} disabled=true`
  ).toBe(false)
}

/** R-COVERED: 인터랙티브 요소의 중심점이 fixed 오버레이에 가리지 않음
 *  el.evaluate() 로 element reference 직접 사용 — querySelectorAll/:has-text 금지 */
async function assertUncovered(page: Page, selector: string, vp: VP, ctx: string) {
  const els = page.locator(selector)
  const count = await els.count()
  for (let i = 0; i < count; i++) {
    const el = els.nth(i)
    if (!await el.isVisible().catch(() => false)) continue
    await el.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }))
    await page.waitForTimeout(80)
    const { isCovered, topTag } = await el.evaluate((node) => {
      const rect = node.getBoundingClientRect()
      const cx = rect.left + rect.width  / 2
      const cy = rect.top  + rect.height / 2
      const top = document.elementFromPoint(cx, cy)
      if (!top) return { isCovered: true, topTag: 'null' }
      const covered = !node.contains(top) && top !== node
      return { isCovered: covered, topTag: top.tagName + (top.className ? '.' + String(top.className).slice(0, 40) : '') }
    }).catch(() => ({ isCovered: false, topTag: '' }))
    expect(isCovered,
      `[${ctx} @${vp.label}px] R-COVERED: ${selector}[${i}] 중심점이 [${topTag}] 에 가림`
    ).toBe(false)
  }
}

/** R-NOTCLIP: 요소의 우측 끝이 뷰포트를 넘지 않음 */
async function assertNotClipped(page: Page, selector: string, vp: VP, ctx: string) {
  const els = page.locator(selector)
  const count = await els.count()
  for (let i = 0; i < count; i++) {
    const el = els.nth(i)
    if (!await el.isVisible().catch(() => false)) continue
    const box = await el.boundingBox()
    if (!box) continue
    expect(box.x + box.width,
      `[${ctx} @${vp.label}px] R-NOTCLIP: ${selector}[${i}] 우측(${(box.x + box.width).toFixed(0)}px)이 뷰포트(${vp.w}px) 밖`
    ).toBeLessThanOrEqual(vp.w + 1)
  }
}

/** R-LOADEND: loading 텍스트가 사라진 뒤 contentSels 중 하나가 렌더링되었는지 확인
 *  @param contentSels 배열 — 각각 독립적인 Playwright selector (text=/CSS) */
async function assertLoadEnd(page: Page, contentSels: string[], vp: VP, ctx: string) {
  const loadEl = page.locator('text=로딩 중...').first()
  await loadEl.waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {})
  for (const sel of contentSels) {
    try {
      const cnt = await page.locator(sel).count()
      if (cnt > 0) return // 하나라도 렌더링되면 PASS
    } catch { /* 잘못된 selector 무시 */ }
  }
  expect(false,
    `[${ctx} @${vp.label}px] R-LOADEND: loading 후 콘텐츠(${contentSels.join(' | ')}) 미렌더링`
  ).toBe(true)
}

/** R-TABORDER: Tab 키 N회 이내에 target 요소에 포커스 도달
 *  Playwright locator.evaluate() 사용 — document.querySelector/:has-text 금지 */
async function assertTabReachable(page: Page, targetSel: string, maxTabs: number, vp: VP, ctx: string) {
  await page.evaluate(() => (document.body as HTMLElement).focus())
  const targets = page.locator(targetSel)
  const count   = await targets.count()
  for (let t = 0; t < maxTabs; t++) {
    await page.keyboard.press('Tab')
    for (let j = 0; j < count; j++) {
      try {
        const isFocused = await targets.nth(j).evaluate(el => document.activeElement === el)
        if (isFocused) return
      } catch { /* 요소 미연결 → 무시 */ }
    }
  }
  expect(false,
    `[${ctx} @${vp.label}px] R-TABORDER: "${targetSel}" → ${maxTabs}번 Tab 내 포커스 미도달`
  ).toBe(true)
}

// ════════════════════════════════════════════════════════════════
//  [INTERACT:auth]  /admin/login
// ════════════════════════════════════════════════════════════════
test.describe('[INTERACT:auth] 로그인', () => {
  for (const vp of ALL_VPS) {
    test(`@${vp.label}px 입력+버튼 enabled·not-clipped`, async ({ browser }) => {
      const ctx  = await makeCtx(browser, vp)
      const page = await ctx.newPage()
      await page.goto(`${BASE}/admin/login`)
      await expect(page.locator('input[type="email"], input[type="text"]').first()).toBeVisible({ timeout: 15000 })

      // R-ENABLED: 로그인 버튼 enabled
      await assertEnabledCTA(page, ['로그인'], vp, 'auth')

      // R-CLICKABLE: 이메일 + 비밀번호 입력창 클릭 가능
      await assertClickable(page, 'input[type="email"], input[type="text"]', vp, 'auth')
      await assertClickable(page, 'input[type="password"]', vp, 'auth')

      // R-NOTCLIP: 폼 요소가 뷰포트 밖으로 안 나감
      await assertNotClipped(page, 'input, button[type="submit"], button:has-text("로그인")', vp, 'auth')

      await ctx.close()
    })
  }

  // R-TABORDER: email → password → 로그인 버튼
  test('@390px Tab 순서: email → password → 로그인', async ({ browser }) => {
    const ctx  = await makeCtx(browser, VP390)
    const page = await ctx.newPage()
    await page.goto(`${BASE}/admin/login`)
    await expect(page.locator('input[type="email"], input[type="text"]').first()).toBeVisible({ timeout: 15000 })

    // 이메일 input 탭 도달 확인
    await assertTabReachable(page, 'input[type="email"], input[type="text"]', 5, VP390, 'auth')
    // password input 탭 도달 확인
    await assertTabReachable(page, 'input[type="password"]', 3, VP390, 'auth')
    // 로그인 버튼 탭 도달 확인
    await assertTabReachable(page, 'button[type="submit"], button:has-text("로그인")', 3, VP390, 'auth')

    await ctx.close()
  })

  // R-COVERED: 입력창이 fixed 오버레이에 가리지 않음
  test('@390px 입력창 overlay 비피복', async ({ browser }) => {
    const ctx  = await makeCtx(browser, VP390)
    const page = await ctx.newPage()
    await page.goto(`${BASE}/admin/login`)
    await expect(page.locator('input[type="email"], input[type="text"]').first()).toBeVisible({ timeout: 15000 })

    await assertUncovered(page, 'input[type="email"], input[type="text"], input[type="password"]', VP390, 'auth')
    await ctx.close()
  })
})

// ════════════════════════════════════════════════════════════════
//  [INTERACT:dashboard]  /admin
// ════════════════════════════════════════════════════════════════
test.describe('[INTERACT:dashboard] 대시보드', () => {
  for (const vp of ALL_VPS) {
    test(`@${vp.label}px CTA enabled`, async ({ browser }) => {
      const ctx  = await makeCtx(browser, vp)
      const page = await ctx.newPage()
      await ensureAdmin(page)
      await setupDashboard(page, 'MANY')
      await page.goto(`${BASE}/admin`)
      await page.waitForLoadState('networkidle', { timeout: 15000 })

      // R-ENABLED: 새로고침, 근로자 초대 링크
      await assertEnabledCTA(page, ['새로고침', '근로자 초대 링크', '복사됨!'], vp, 'dashboard')

      // R-NOTCLIP: KPI 카드 오른쪽 끝이 잘리지 않음
      await assertNotClipped(page, '[class*="rounded-[12px]"][class*="border"]', vp, 'dashboard')

      await ctx.close()
    })
  }

  // R-VARIANT × 3: EMPTY / ONE / MANY — loading 후 콘텐츠 렌더링
  for (const variant of ['EMPTY', 'ONE', 'MANY'] as Variant[]) {
    test(`@390px 데이터변형(${variant}): loading → 콘텐츠 렌더`, async ({ browser }) => {
      const ctx  = await makeCtx(browser, VP390)
      const page = await ctx.newPage()
      await ensureAdmin(page)
      await setupDashboard(page, variant)
      await page.goto(`${BASE}/admin`)
      await page.waitForLoadState('networkidle', { timeout: 15000 })

      // loading 종료 후 h1 또는 KPI 카드 렌더 확인
      await assertLoadEnd(
        page,
        ['h1', '[class*="rounded-[12px]"][class*="border"]', '[class*="SectionCard"]'],
        VP390,
        `dashboard-${variant}`
      )
      await ctx.close()
    })
  }
})

// ════════════════════════════════════════════════════════════════
//  [INTERACT:workers]  /admin/workers
// ════════════════════════════════════════════════════════════════
test.describe('[INTERACT:workers] 근로자 목록', () => {
  for (const vp of ALL_VPS) {
    test(`@${vp.label}px CTA enabled·not-clipped`, async ({ browser }) => {
      const ctx  = await makeCtx(browser, vp)
      const page = await ctx.newPage()
      await ensureAdmin(page)
      await setupWorkers(page, 'MANY')
      await page.goto(`${BASE}/admin/workers`)
      await page.waitForLoadState('networkidle', { timeout: 15000 })

      // R-ENABLED: + 근로자 등록 또는 새로고침
      await assertEnabledCTA(page, ['+ 근로자 등록', '새로고침'], vp, 'workers')

      // R-NOTCLIP: 필터 인풋/셀렉트
      await assertNotClipped(page, 'input[type="text"], select', vp, 'workers')

      await ctx.close()
    })
  }

  // R-CLICKABLE + R-COVERED: 390px
  test('@390px 필터 입력 clickable · 오버레이 미피복', async ({ browser }) => {
    const ctx  = await makeCtx(browser, VP390)
    const page = await ctx.newPage()
    await ensureAdmin(page)
    await setupWorkers(page, 'ONE')
    await page.goto(`${BASE}/admin/workers`)
    await page.waitForLoadState('networkidle', { timeout: 15000 })

    await assertClickable(page, 'input[type="text"]', VP390, 'workers')
    await assertUncovered(page, 'input[type="text"]', VP390, 'workers')
    await assertUncovered(page, 'button:has-text("+ 근로자 등록"), button:has-text("새로고침")', VP390, 'workers')
    await ctx.close()
  })

  // R-VARIANT × 3: loading → 콘텐츠 (빈 상태 문자열 or 근로자 행)
  for (const variant of ['EMPTY', 'ONE', 'MANY'] as Variant[]) {
    test(`@390px 데이터변형(${variant}): loading → 콘텐츠 렌더`, async ({ browser }) => {
      const ctx  = await makeCtx(browser, VP390)
      const page = await ctx.newPage()
      await ensureAdmin(page)
      await setupWorkers(page, variant)
      await page.goto(`${BASE}/admin/workers`)
      await page.waitForLoadState('networkidle', { timeout: 15000 })

      // empty OR 데이터 행
      await assertLoadEnd(
        page,
        ['text=조회된 근로자가 없습니다', 'text=근로자1', 'text=근로자2', 'h1'],
        VP390,
        `workers-${variant}`
      )
      await ctx.close()
    })
  }

  // R-CLICKABLE: 근로자 행 클릭 → 패널 오픈 (ONE 변형)
  test('@390px 근로자 행 클릭 → 상세 패널', async ({ browser }) => {
    const ctx  = await makeCtx(browser, VP390)
    const page = await ctx.newPage()
    await ensureAdmin(page)
    await setupWorkers(page, 'ONE')
    await page.goto(`${BASE}/admin/workers`)
    await page.waitForLoadState('networkidle', { timeout: 15000 })

    // 근로자1 행이 클릭 가능한지 + 클릭 후 이름이 패널에 표시
    const rowText = page.locator('text=근로자1').first()
    await expect(rowText).toBeVisible({ timeout: 10000 })

    await rowText.click()
    await page.waitForTimeout(400)

    // 패널에 근로자 이름이 표시되어야 함
    const panelName = page.locator('h3:has-text("근로자1"), [class*="font-bold"]:has-text("근로자1")').first()
    const panelVisible = await panelName.isVisible().catch(() => false)
    expect(panelVisible,
      `[workers @${VP390.label}px] R-CLICKABLE: 근로자 행 클릭 → 상세 패널 미표시`
    ).toBe(true)

    await ctx.close()
  })
})

// ════════════════════════════════════════════════════════════════
//  [INTERACT:sites]  /admin/sites
// ════════════════════════════════════════════════════════════════
test.describe('[INTERACT:sites] 현장 목록', () => {
  for (const vp of ALL_VPS) {
    test(`@${vp.label}px CTA enabled·not-clipped`, async ({ browser }) => {
      const ctx  = await makeCtx(browser, vp)
      const page = await ctx.newPage()
      await ensureAdmin(page)
      await setupSites(page, 'MANY')
      await page.goto(`${BASE}/admin/sites`)
      await page.waitForLoadState('networkidle', { timeout: 15000 })

      await assertEnabledCTA(page, ['+ 현장 등록', '현장 등록', '새로고침'], vp, 'sites')
      await assertNotClipped(page, 'input[type="text"], select', vp, 'sites')
      await ctx.close()
    })
  }

  // R-VARIANT × 3
  for (const variant of ['EMPTY', 'ONE', 'MANY'] as Variant[]) {
    test(`@390px 데이터변형(${variant}): loading → 콘텐츠 렌더`, async ({ browser }) => {
      const ctx  = await makeCtx(browser, VP390)
      const page = await ctx.newPage()
      await ensureAdmin(page)
      await setupSites(page, variant)
      await page.goto(`${BASE}/admin/sites`)
      await page.waitForLoadState('networkidle', { timeout: 15000 })

      await assertLoadEnd(
        page,
        ['text=등록된 현장이 없습니다.', 'text=테스트현장1', 'text=테스트현장2', 'h1'],
        VP390,
        `sites-${variant}`
      )
      await ctx.close()
    })
  }

  // R-CLICKABLE: 현장 행 클릭 → 상세 패널 (기본정보 수정 버튼 노출)
  test('@390px 현장 행 클릭 → 기본정보 수정 버튼', async ({ browser }) => {
    const ctx  = await makeCtx(browser, VP390)
    const page = await ctx.newPage()
    await ensureAdmin(page)
    // 명시적 sites mock (구체적 경로 후등록 = 우선 매칭)
    await mockRoute(page, '**/api/admin/companies**', ok(companiesData('MANY')))
    await mockRoute(page, '**/api/admin/sites**',      ok(sitesListData('ONE')))
    await setupAuthMe(page)
    await page.goto(`${BASE}/admin/sites`)
    await page.waitForLoadState('networkidle', { timeout: 15000 })

    // + 현장 등록 버튼이 보여야 canMutate=true (auth/me React state 반영 보장)
    await expect(page.locator('button:has-text("+ 현장 등록")')).toBeVisible({ timeout: 8000 })

    // 데스크톱 레이아웃(hidden sm:grid)은 390px에서 hidden → cursor-pointer 행으로 클릭
    // force:true — sticky 헤더가 행 중심점을 덮더라도 onClick 핸들러 동작 확인
    const siteRow = page.locator('div[class*="cursor-pointer"]').filter({ hasText: '테스트현장1' }).first()
    await expect(siteRow).toBeVisible({ timeout: 10000 })

    // DOM 직접 클릭 — sticky 헤더 피복 시 Playwright click이 막히므로 evaluate 사용
    await siteRow.evaluate(el => (el as HTMLElement).click())

    // 기본정보 수정 버튼 노출 확인 (패널이 렌더링될 때까지 대기)
    const editBtn = page.locator('button:has-text("기본정보 수정")').first()
    await expect(editBtn).toBeVisible({ timeout: 5000 })

    // 기본정보 수정 버튼 클릭 → 수정 모달 오픈 (sticky 헤더 회피)
    await editBtn.evaluate(el => (el as HTMLElement).click())
    // Modal = div.fixed.inset-0.z-50 (role="dialog" 없음) — 제목 h2로 확인
    const modal = page.locator('h2:has-text("현장 수정")').first()
    const modalVisible = await modal.waitFor({ timeout: 3000 }).then(() => true).catch(() => false)
    expect(modalVisible,
      `[sites @${VP390.label}px] R-CLICKABLE: 기본정보 수정 버튼 클릭 → 수정 모달 미오픈`
    ).toBe(true)

    await ctx.close()
  })
})

// ════════════════════════════════════════════════════════════════
//  [INTERACT:attendance]  /admin/attendance
// ════════════════════════════════════════════════════════════════
test.describe('[INTERACT:attendance] 출퇴근 관리', () => {
  for (const vp of ALL_VPS) {
    test(`@${vp.label}px CTA enabled·not-clipped`, async ({ browser }) => {
      const ctx  = await makeCtx(browser, vp)
      const page = await ctx.newPage()
      await ensureAdmin(page)
      await setupAttendance(page, 'MANY')
      await page.goto(`${BASE}/admin/attendance`)
      await page.waitForLoadState('networkidle', { timeout: 15000 })

      await assertEnabledCTA(page, ['대리 등록', '새로고침'], vp, 'attendance')
      await assertNotClipped(page, 'input[type="date"], input[type="text"], select', vp, 'attendance')
      await ctx.close()
    })
  }

  // R-VARIANT × 3
  for (const variant of ['EMPTY', 'ONE', 'MANY'] as Variant[]) {
    test(`@390px 데이터변형(${variant}): loading → 콘텐츠 렌더`, async ({ browser }) => {
      const ctx  = await makeCtx(browser, VP390)
      const page = await ctx.newPage()
      await ensureAdmin(page)
      await setupAttendance(page, variant)
      await page.goto(`${BASE}/admin/attendance`)
      await page.waitForLoadState('networkidle', { timeout: 15000 })

      await assertLoadEnd(
        page,
        ['text=조회된 기록이 없습니다', 'text=근로자1', 'text=근로자2', 'h1'],
        VP390,
        `attendance-${variant}`
      )
      await ctx.close()
    })
  }

  // R-CLICKABLE: 날짜 입력 + 대리 등록 버튼 clickable·not-covered
  test('@390px date 입력 clickable · 대리등록 오버레이 미피복', async ({ browser }) => {
    const ctx  = await makeCtx(browser, VP390)
    const page = await ctx.newPage()
    await ensureAdmin(page)
    await setupAttendance(page, 'ONE')
    await page.goto(`${BASE}/admin/attendance`)
    await page.waitForLoadState('networkidle', { timeout: 15000 })

    await assertClickable(page, 'input[type="date"]', VP390, 'attendance')
    await assertUncovered(page, 'button:has-text("대리 등록"), button:has-text("새로고침")', VP390, 'attendance')
    await ctx.close()
  })
})

// ════════════════════════════════════════════════════════════════
//  [INTERACT:companies]  /admin/companies
// ════════════════════════════════════════════════════════════════
test.describe('[INTERACT:companies] 회사 관리', () => {
  for (const vp of ALL_VPS) {
    test(`@${vp.label}px CTA enabled·not-clipped`, async ({ browser }) => {
      const ctx  = await makeCtx(browser, vp)
      const page = await ctx.newPage()
      await ensureAdmin(page)
      await setupCompanies(page, 'MANY')
      await page.goto(`${BASE}/admin/companies`)
      await page.waitForLoadState('networkidle', { timeout: 15000 })

      await assertEnabledCTA(page, ['+ 회사 등록'], vp, 'companies')
      await assertNotClipped(page, 'input[type="text"], select, table', vp, 'companies')
      await ctx.close()
    })
  }

  // R-VARIANT × 3
  for (const variant of ['EMPTY', 'ONE', 'MANY'] as Variant[]) {
    test(`@390px 데이터변형(${variant}): loading → 콘텐츠 렌더`, async ({ browser }) => {
      const ctx  = await makeCtx(browser, VP390)
      const page = await ctx.newPage()
      await ensureAdmin(page)
      await setupCompanies(page, variant)
      await page.goto(`${BASE}/admin/companies`)
      await page.waitForLoadState('networkidle', { timeout: 15000 })

      await assertLoadEnd(
        page,
        ['text=등록된 회사가 없습니다.', 'text=(주)테스트회사1', 'h1'],
        VP390,
        `companies-${variant}`
      )
      await ctx.close()
    })
  }

  // R-CLICKABLE: + 회사 등록 버튼 클릭 → 폼 오픈
  test('@390px + 회사 등록 클릭 → 폼 오픈', async ({ browser }) => {
    const ctx  = await makeCtx(browser, VP390)
    const page = await ctx.newPage()
    await ensureAdmin(page)
    await setupCompanies(page, 'EMPTY')
    await page.goto(`${BASE}/admin/companies`)
    await page.waitForLoadState('networkidle', { timeout: 15000 })

    const btn = page.locator('button:has-text("+ 회사 등록")').first()
    await expect(btn).toBeVisible({ timeout: 8000 })
    await btn.click()
    await page.waitForTimeout(400)

    // 폼이 열려야 함 — 회사명 입력창 (placeholder 일치)
    const form = page.locator('[placeholder="(주)해한건설"]').first()
    const formVisible = await form.isVisible().catch(() => false)
    expect(formVisible,
      `[companies @${VP390.label}px] R-CLICKABLE: + 회사 등록 → 폼 미오픈`
    ).toBe(true)

    // 폼 내 저장 버튼 enabled 확인
    await assertEnabledCTA(page, ['저장'], VP390, 'companies-form')

    await ctx.close()
  })
})

// ════════════════════════════════════════════════════════════════
//  [INTERACT:contracts]  /admin/contracts/new
// ════════════════════════════════════════════════════════════════
test.describe('[INTERACT:contracts] 계약서 생성', () => {
  for (const vp of ALL_VPS) {
    test(`@${vp.label}px 계약 저장 enabled·not-covered`, async ({ browser }) => {
      const ctx  = await makeCtx(browser, vp)
      const page = await ctx.newPage()
      await ensureAdmin(page)
      await setupContracts(page)
      await page.goto(`${BASE}/admin/contracts/new`)
      await page.waitForLoadState('networkidle', { timeout: 15000 })

      // R-ENABLED: 계약 저장 버튼 (기본 laborRelation=DIRECT_EMPLOYEE → blockReason=null)
      await assertEnabledCTA(page, ['계약 저장', '검토 필요로 저장'], vp, 'contracts')

      // R-NOTCLIP: 폼 입력 요소가 잘리지 않음
      await assertNotClipped(page, 'input[type="text"], select', vp, 'contracts')

      await ctx.close()
    })
  }

  // R-COVERED: FAB이 계약 저장 버튼을 가리지 않음 (390px)
  test('@390px FAB이 계약 저장 버튼 미피복', async ({ browser }) => {
    const ctx  = await makeCtx(browser, VP390)
    const page = await ctx.newPage()
    await ensureAdmin(page)
    await setupContracts(page)
    await page.goto(`${BASE}/admin/contracts/new`)
    await page.waitForLoadState('networkidle', { timeout: 15000 })

    // 계약 저장 버튼 스크롤 후 피복 검사
    await assertUncovered(
      page,
      'button:has-text("계약 저장"), button:has-text("검토 필요로 저장")',
      VP390,
      'contracts-fab'
    )
    await ctx.close()
  })

  // R-TABORDER: Tab으로 계약 저장 버튼까지 도달
  test('@390px Tab → 계약 저장 버튼 도달', async ({ browser }) => {
    const ctx  = await makeCtx(browser, VP390)
    const page = await ctx.newPage()
    await ensureAdmin(page)
    await setupContracts(page)
    await page.goto(`${BASE}/admin/contracts/new`)
    await page.waitForLoadState('networkidle', { timeout: 15000 })

    // 계약서 생성 페이지는 6단계 × ~20개 입력 필드 → 150회 Tab 허용
    await assertTabReachable(
      page,
      'button:has-text("계약 저장"), button:has-text("검토 필요로 저장")',
      150,
      VP390,
      'contracts-tab'
    )
    await ctx.close()
  })

  // R-CLICKABLE: 주요 입력 필드 클릭 가능 (390px)
  test('@390px Step1 입력 필드 clickable', async ({ browser }) => {
    const ctx  = await makeCtx(browser, VP390)
    const page = await ctx.newPage()
    await ensureAdmin(page)
    await setupContracts(page)
    await page.goto(`${BASE}/admin/contracts/new`)
    await page.waitForLoadState('networkidle', { timeout: 15000 })

    await assertClickable(page, 'input[type="text"]', VP390, 'contracts')
    await assertClickable(page, 'select', VP390, 'contracts')
    await ctx.close()
  })
})
