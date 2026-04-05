/**
 * 모바일 레이아웃 자동점검 — 근로자 페이지
 *
 * 대상:
 *   [worker-login]      /login          (360 / 390 / 412px)
 *   [worker-attendance] /attendance     (360 / 412px 추가, 390은 worker-home-ui.spec.ts 참조)
 *   [worker-attendance] 하단 nav FAB가 출근버튼 가리지 않음 (390px)
 *   [worker-attendance] 상태 카드 overflow 없음 (390px)
 *   [worker-attendance] 에러/빈상태 UI 모바일 (390px)
 *
 * 검증 규칙:
 *   R-HSCROLL   수평 스크롤 발생 → FAIL
 *   R-MINHEIGHT input/button < 44px → FAIL
 *   R-CTA       로그인/출근 버튼 미노출 → FAIL
 *   R-FAB       하단 nav가 출근버튼 가림 → FAIL
 *   R-OVERFLOW  카드/배지가 뷰포트 밖 → FAIL
 *
 * 실행:
 *   npx playwright test e2e/mobile-layout-worker.spec.ts \
 *     --config=e2e/playwright.config.ts --project=chromium
 */
import { test, expect, type Page, type Browser } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

// ── 환경 ───────────────────────────────────────────────────
const BASE         = process.env.BASE_URL        || 'https://attendance.haehan-ai.kr'
const WORKER_PHONE = process.env.E2E_WORKER_PHONE || '01077770001'
const WORKER_PASS  = process.env.E2E_WORKER_PASS  || 'Test2026!!'
const TOKEN_FILE   = path.join(__dirname, '..', 'logs', '.worker-e2e-token.txt')

// ── viewport 정의 ───────────────────────────────────────────
type VP = { w: number; h: number; label: string }
const VP360: VP = { w: 360, h: 800,  label: '360' }
const VP390: VP = { w: 390, h: 844,  label: '390' }
const VP412: VP = { w: 412, h: 915,  label: '412' }
const MOBILE_VPS: VP[] = [VP360, VP390, VP412]

// ── 컨텍스트 생성 ──────────────────────────────────────────
async function makeCtx(browser: Browser, vp: VP) {
  return browser.newContext({ viewport: { width: vp.w, height: vp.h } })
}

// ── worker 토큰 캐시 ───────────────────────────────────────
let _workerTokenCache: string | null = null

async function fetchWorkerToken(): Promise<string> {
  if (_workerTokenCache) return _workerTokenCache
  if (fs.existsSync(TOKEN_FILE)) {
    const raw = fs.readFileSync(TOKEN_FILE, 'utf-8').trim()
    if (raw) {
      try {
        const parts = raw.split('.')
        if (parts.length === 3) {
          const p = JSON.parse(Buffer.from(parts[1] + '==', 'base64').toString())
          if (p.exp * 1000 > Date.now() + 60000) { _workerTokenCache = raw; return raw }
        }
      } catch { /* fall through */ }
    }
  }
  const res = await fetch(`${BASE}/api/auth/worker-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: WORKER_PHONE, password: WORKER_PASS }),
  })
  const m = (res.headers.get('set-cookie') ?? '').match(/worker_token=([^;]+)/)
  if (!m) throw new Error(`워커 로그인 실패: ${res.status}`)
  _workerTokenCache = m[1]
  fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true })
  fs.writeFileSync(TOKEN_FILE, _workerTokenCache)
  return _workerTokenCache
}

async function injectWorker(page: Page) {
  let token: string
  try { token = await fetchWorkerToken() }
  catch (e) { test.skip(true, `워커 인증 실패: ${(e as Error).message}`); return }
  await page.context().addCookies([{
    name: 'worker_token', value: token,
    domain: new URL(BASE).hostname, path: '/',
    httpOnly: true, secure: true, sameSite: 'Lax',
  }])
}

// ── 공통 검증 유틸 ─────────────────────────────────────────

async function assertNoHScroll(page: Page, label: string) {
  const ok = await page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2
  )
  expect(ok, `[${label}] R-HSCROLL: 수평 스크롤 발생`).toBe(true)
}

async function assertMinHeight(page: Page, selector: string, minH: number, label: string) {
  const els = page.locator(selector)
  const count = await els.count()
  for (let i = 0; i < count; i++) {
    const el = els.nth(i)
    if (!await el.isVisible().catch(() => false)) continue
    const box = await el.boundingBox()
    if (!box) continue
    expect(box.height, `[${label}] R-MINHEIGHT: ${selector}[${i}] 높이 ${box.height.toFixed(0)}px < ${minH}px`).toBeGreaterThanOrEqual(minH)
  }
}

async function assertCTAVisible(page: Page, btnTexts: string[], label: string) {
  for (const txt of btnTexts) {
    const vis = await page.locator(`button:has-text("${txt}")`).first().isVisible().catch(() => false)
    if (vis) return
  }
  expect(false, `[${label}] R-CTA: 버튼(${btnTexts.join('|')}) 미노출`).toBe(true)
}

async function assertNotOverflowViewport(page: Page, selector: string, vpW: number, label: string) {
  const els = page.locator(selector)
  const count = await els.count()
  for (let i = 0; i < count; i++) {
    const el = els.nth(i)
    if (!await el.isVisible().catch(() => false)) continue
    const box = await el.boundingBox()
    if (!box) continue
    expect(
      box.x + box.width,
      `[${label}] R-OVERFLOW: ${selector}[${i}] 우측 ${(box.x + box.width).toFixed(0)}px > ${vpW}px`
    ).toBeLessThanOrEqual(vpW + 1)
  }
}

/** R-FAB: 하단 고정 nav가 필드/버튼을 가리는지 */
async function assertNavNotCovering(page: Page, fieldSel: string, label: string) {
  const nav = page.locator('nav.fixed.bottom-0, [class*="fixed"][class*="bottom-0"]').first()
  if (!await nav.isVisible().catch(() => false)) return
  const navBox = await nav.boundingBox()
  if (!navBox) return

  const fields = page.locator(fieldSel)
  const count  = await fields.count()
  for (let i = 0; i < count; i++) {
    await fields.nth(i).evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }))
    await page.waitForTimeout(60)
    const fBox = await fields.nth(i).boundingBox()
    const nBox = await nav.boundingBox()
    if (!fBox || !nBox) continue
    const vOv = nBox.y < fBox.y + fBox.height && nBox.y + nBox.height > fBox.y
    const hOv = nBox.x < fBox.x + fBox.width  && nBox.x + nBox.width  > fBox.x
    expect(
      vOv && hOv,
      `[${label}] R-FAB: 하단 nav가 ${fieldSel}[${i}] 가림` +
      ` (nav.y=${nBox.y.toFixed(0)}, field.bottom=${(fBox.y + fBox.height).toFixed(0)})`
    ).toBe(false)
  }
}

// ── worker 출퇴근 API mock ──────────────────────────────────
async function mockAttendanceAPIs(page: Page) {
  const ok = (d: unknown) => ({ success: true, data: d })
  const ELIGIBLE_ALL = {
    success: true, eligible: true,
    conditions: [
      { key: 'account', label: '계정 상태', passed: true, message: '승인됨' },
      { key: 'device',  label: '기기 승인', passed: true, message: '승인된 기기' },
      { key: 'site',    label: '현장 배정', passed: true, message: '테스트현장' },
      { key: 'docs',    label: '필수 서류', passed: true, message: '5/5 완료' },
      { key: 'gps',     label: 'GPS 위치',  passed: true, message: '반경 내 (5m)' },
      { key: 'time',    label: '출근 시간', passed: true, message: '시간 제한 없음' },
      { key: 'duplicate', label: '중복 출근', passed: true, message: '출근 가능' },
    ],
  }
  await page.route(`${BASE}/api/attendance/today`,              r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ok(null)) }))
  await page.route(`${BASE}/api/attendance/available-sites**`,  r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, sites: [] }) }))
  await page.route(`${BASE}/api/attendance/eligibility**`,      r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ELIGIBLE_ALL) }))
  await page.route(`${BASE}/api/attendance/presence/my-pending`,r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ok({ item: null })) }))
  await page.route(`${BASE}/api/attendance/history**`,          r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ok({ items: [], total: 0 })) }))
}

async function waitForAttendancePage(page: Page) {
  await page.waitForFunction(
    () => !window.location.pathname.startsWith('/login') &&
          !window.location.pathname.startsWith('/m/login'),
    { timeout: 8000 }
  ).catch(() => {})
  await page.waitForSelector('nav.fixed.bottom-0', { timeout: 10000 })
}

// ── 로그인 공통 헬퍼 ───────────────────────────────────────
async function gotoLoginPage(page: Page) {
  // /api/auth/me → 401: 로그인 페이지 진입 허용
  await page.route(`${BASE}/api/auth/me`, r =>
    r.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ success: false }) }))
  await page.goto(`${BASE}/login`)
  await expect(page.locator('input[type="tel"], input[type="text"], input[type="email"]').first())
    .toBeVisible({ timeout: 15000 })
}

// ════════════════════════════════════════════════════════════
//  [MOBILE:login-layout] 근로자 /login — 레이아웃 전용 점검
//  목적: 뷰포트별 HScroll / MinHeight / CTA / 입력창 overflow
//  인증 플로우와 무관 (mock 전용)
// ════════════════════════════════════════════════════════════
test.describe('[MOBILE:login-layout] 근로자 로그인 — 레이아웃', () => {
  for (const vp of MOBILE_VPS) {
    test(`@${vp.label}px HScroll·입력높이·CTA·입력창overflow`, async ({ browser }) => {
      const ctx  = await makeCtx(browser, vp)
      const page = await ctx.newPage()
      await gotoLoginPage(page)

      // R-HSCROLL
      await assertNoHScroll(page, `login-layout@${vp.label}`)

      // R-MINHEIGHT: 입력창 ≥ 44px (h-12 = 48px)
      await assertMinHeight(page, 'input[type="tel"], input[type="password"], input[type="text"], input[type="email"]', 44, `login-layout@${vp.label}`)

      // R-MINHEIGHT: submit 버튼 ≥ 44px (탭 버튼 제외 — h-12·bg-brand-accent 클래스로 구분)
      await assertMinHeight(page, 'button[class*="h-12"], button[class*="bg-brand-accent"]', 44, `login-layout@${vp.label}`)

      // R-CTA: 로그인 버튼 보임
      await assertCTAVisible(page, ['로그인'], `login-layout@${vp.label}`)

      // R-OVERFLOW: 입력창이 뷰포트 밖으로 안나감
      await assertNotOverflowViewport(page, 'input', vp.w, `login-layout@${vp.label}`)

      await ctx.close()
    })
  }

  // R-HSCROLL: 탭 전환 후 이메일 입력창 렌더 대기 → HScroll 없음 (고정대기 금지)
  test('@390px 탭 전환 후 HScroll 없음', async ({ browser }) => {
    const ctx  = await makeCtx(browser, VP390)
    const page = await ctx.newPage()
    await gotoLoginPage(page)

    const emailTab = page.locator('button:has-text("이메일")')
    if (await emailTab.isVisible().catch(() => false)) {
      await emailTab.click()
      // 이메일 탭 전환 후 email 입력창이 DOM에 나타날 때까지 대기
      await page.waitForSelector('input[type="email"]', { state: 'visible', timeout: 3000 }).catch(() => {})
      await assertNoHScroll(page, 'login-layout-tab@390')
    }
    await ctx.close()
  })

  // R-HSCROLL: 입력 포커스 후 HScroll 없음 (고정대기 금지)
  test('@390px 입력 포커스 후 HScroll 없음', async ({ browser }) => {
    const ctx  = await makeCtx(browser, VP390)
    const page = await ctx.newPage()
    await gotoLoginPage(page)

    const input = page.locator('input[type="tel"], input[type="text"]').first()
    await input.focus()
    // 포커스 완료 시점 = activeElement가 input으로 변경
    await page.waitForFunction(
      () => document.activeElement?.tagName === 'INPUT',
      { timeout: 3000 }
    ).catch(() => {})
    await assertNoHScroll(page, 'login-layout-focus@390')
    await ctx.close()
  })
})

// ════════════════════════════════════════════════════════════
//  [MOBILE:attendance] 근로자 /attendance 추가 viewport
//  (390px는 worker-home-ui.spec.ts에서 커버)
// ════════════════════════════════════════════════════════════
test.describe('[MOBILE:attendance] 근로자 출퇴근 화면 추가 viewport', () => {

  // 360 / 412px 추가 viewport HScroll 검증
  for (const vp of [VP360, VP412]) {
    test(`@${vp.label}px 수평스크롤 없음`, async ({ browser }) => {
      const ctx  = await makeCtx(browser, vp)
      const page = await ctx.newPage()
      await injectWorker(page)
      await mockAttendanceAPIs(page)
      await page.goto(`${BASE}/attendance`)
      await waitForAttendancePage(page)

      await assertNoHScroll(page, `attendance@${vp.label}`)
      await ctx.close()
    })
  }

  // R-FAB: 하단 nav가 출근버튼 가리지 않음 (390px)
  test('@390px 하단 nav가 출근버튼 가리지 않음', async ({ browser }) => {
    const ctx  = await makeCtx(browser, VP390)
    const page = await ctx.newPage()
    await injectWorker(page)
    await mockAttendanceAPIs(page)
    await page.goto(`${BASE}/attendance`)
    await waitForAttendancePage(page)

    // eligibility API 응답 후 출근버튼이 DOM에 나타날 때까지 대기 (고정대기 금지)
    await page.waitForSelector(
      'button:has-text("출근하기"), button:has-text("조건 미충족"), [data-testid="checkin-btn"]',
      { state: 'attached', timeout: 8000 }
    ).catch(() => { /* 버튼 없는 상태면 FAB 체크 생략 */ })

    await assertNavNotCovering(
      page,
      'button:has-text("출근하기"), button:has-text("조건 미충족"), [data-testid="checkin-btn"]',
      'attendance-nav-fab@390'
    )
    await ctx.close()
  })

  // R-OVERFLOW: 상태 카드 영역이 뷰포트 밖으로 안나감 (360px 가장 좁은 기기)
  test('@360px 상태 카드 overflow 없음', async ({ browser }) => {
    const ctx  = await makeCtx(browser, VP360)
    const page = await ctx.newPage()
    await injectWorker(page)
    await mockAttendanceAPIs(page)
    await page.goto(`${BASE}/attendance`)
    await waitForAttendancePage(page)

    // 카드/뱃지 요소 overflow 체크
    await assertNotOverflowViewport(
      page,
      '[class*="rounded-2xl"], [class*="rounded-xl"], [class*="badge"], [class*="rounded-full"]',
      VP360.w,
      'attendance-card@360'
    )
    await assertNoHScroll(page, 'attendance-card-hscroll@360')
    await ctx.close()
  })

  // R-OVERFLOW: 빈상태 (사이트 없음) UI 모바일에서 overflow 없음 (390px)
  test('@390px 빈상태 UI overflow 없음', async ({ browser }) => {
    const ctx  = await makeCtx(browser, VP390)
    const page = await ctx.newPage()
    await injectWorker(page)

    // 빈 상태: 배정 현장 없음, 오늘 출퇴근 없음
    const ok = (d: unknown) => ({ success: true, data: d })
    await page.route(`${BASE}/api/attendance/today`,              r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ok(null)) }))
    await page.route(`${BASE}/api/attendance/available-sites**`,  r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, sites: [] }) }))
    await page.route(`${BASE}/api/attendance/eligibility**`,      r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      success: true, eligible: false,
      conditions: [
        { key: 'site', label: '현장 배정', passed: false, message: '배정된 현장 없음' },
      ],
    }) }))
    await page.route(`${BASE}/api/attendance/presence/my-pending`, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ok({ item: null })) }))
    await page.route(`${BASE}/api/attendance/history**`,           r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ok({ items: [], total: 0 })) }))

    await page.goto(`${BASE}/attendance`)
    await waitForAttendancePage(page)
    await page.waitForTimeout(800)

    await assertNoHScroll(page, 'attendance-empty@390')
    await assertNotOverflowViewport(page, '[class*="rounded"]', VP390.w, 'attendance-empty-card@390')
    await ctx.close()
  })

  // R-OVERFLOW: 412px 가로 배지/텍스트 overflow 없음
  test('@412px 배지·텍스트 overflow 없음', async ({ browser }) => {
    const ctx  = await makeCtx(browser, VP412)
    const page = await ctx.newPage()
    await injectWorker(page)
    await mockAttendanceAPIs(page)
    await page.goto(`${BASE}/attendance`)
    await waitForAttendancePage(page)

    await assertNotOverflowViewport(page, '[class*="rounded-full"], [class*="badge"]', VP412.w, 'attendance-badge@412')
    await ctx.close()
  })
})

// ════════════════════════════════════════════════════════════
//  [MOBILE:login-auth] 근로자 /login — 인증 플로우 점검
//  목적: submit 동작 / 에러 메시지 / 성공 응답 검증 (mock API 기반)
//  레이아웃 검증과 분리 — 화면 깨짐 여부 + 플로우 정상 여부 함께 확인
// ════════════════════════════════════════════════════════════
test.describe('[MOBILE:login-auth] 근로자 로그인 — 인증 플로우', () => {

  // A. 실패 플로우: 에러 메시지 노출 + overflow 없음 (고정대기 금지)
  test('@360px 로그인 실패 → 에러 메시지 overflow 없음', async ({ browser }) => {
    const ctx  = await makeCtx(browser, VP360)
    const page = await ctx.newPage()

    await page.route(`${BASE}/api/auth/me`, r =>
      r.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ success: false }) }))
    await page.route(`${BASE}/api/auth/worker-login`, r =>
      r.fulfill({ status: 401, contentType: 'application/json',
        body: JSON.stringify({ success: false, message: '핸드폰 번호 또는 비밀번호가 올바르지 않습니다.' }) }))

    await page.goto(`${BASE}/login`)
    const input = page.locator('input[type="tel"], input[type="text"]').first()
    await expect(input).toBeVisible({ timeout: 15000 })

    await input.fill('01000000000')
    const pwInput = page.locator('input[type="password"]').first()
    if (await pwInput.isVisible().catch(() => false)) await pwInput.fill('wrongpass')

    // submit 버튼 클릭
    const loginBtn = page.locator('button[class*="h-12"], button[class*="bg-brand-accent"]').first()
    if (await loginBtn.isVisible().catch(() => false)) {
      await loginBtn.click()
      // mock 응답 후 loading=false → 버튼 disabled 해제를 대기 조건으로 사용 (에러 CSS 클래스 의존 금지)
      await page.waitForFunction(
        () => {
          const btn = document.querySelector('button[class*="h-12"], button[class*="bg-brand-accent"]') as HTMLButtonElement | null
          return btn !== null && !btn.disabled
        },
        { timeout: 8000 }
      ).catch(() => {})
    }

    await assertNoHScroll(page, 'login-auth-fail@360')
    await assertNotOverflowViewport(page, '[class*="text-red"], [class*="text-destructive"]', VP360.w, 'login-auth-fail-msg@360')
    await ctx.close()
  })

  // B. 성공 플로우: mock API 성공 응답 → login-success indicator 노출
  test('@390px 로그인 성공 → login-success indicator 노출 (mock)', async ({ browser }) => {
    const ctx  = await makeCtx(browser, VP390)
    const page = await ctx.newPage()

    await page.route(`${BASE}/api/auth/me`, r =>
      r.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ success: false }) }))
    // 성공 응답 mock — 실서버 미호출, 플로우만 검증
    await page.route(`${BASE}/api/auth/worker-login`, r =>
      r.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { accountStatus: 'APPROVED' } }),
      }))
    // 리다이렉트 후 /attendance 마운트 막기 (테스트 범위 밖)
    await page.route(`${BASE}/attendance`, r => r.abort())

    await page.goto(`${BASE}/login`)
    const input = page.locator('input[type="tel"], input[type="text"]').first()
    await expect(input).toBeVisible({ timeout: 15000 })

    await input.fill('01077770001')
    const pwInput = page.locator('input[type="password"]').first()
    if (await pwInput.isVisible().catch(() => false)) await pwInput.fill('Test2026!!')

    const loginBtn = page.locator('button[class*="h-12"], button[class*="bg-brand-accent"]').first()
    if (await loginBtn.isVisible().catch(() => false)) {
      await loginBtn.click()
      // login-success span이 DOM에 attach될 때까지 대기 (page.tsx: data-testid="login-success")
      await expect(page.locator('[data-testid="login-success"]'))
        .toBeAttached({ timeout: 6000 })
    }
    await ctx.close()
  })
})

// ════════════════════════════════════════════════════════════
//  [MOBILE:onboarding] 근로자 /my/onboarding  서류 페이지
// ════════════════════════════════════════════════════════════
async function mockOnboardingAPIs(page: Page) {
  const ok = (d: unknown) => ({ success: true, data: d })
  await page.route(`${BASE}/api/my/documents`, r =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(ok({ package: null, documents: [] })) }))
}

test.describe('[MOBILE:onboarding] 근로자 서류 페이지', () => {
  for (const vp of MOBILE_VPS) {
    test(`@${vp.label}px HScroll·카드overflow·CTA`, async ({ browser }) => {
      const ctx  = await makeCtx(browser, vp)
      const page = await ctx.newPage()
      await injectWorker(page)
      await mockOnboardingAPIs(page)
      await page.goto(`${BASE}/my/onboarding`)
      // 하단 nav 또는 h1 로딩 대기
      await page.waitForSelector('nav.fixed.bottom-0, h1, h2', { timeout: 10000 })

      await assertNoHScroll(page, `onboarding@${vp.label}`)

      // R-OVERFLOW: 카드/항목이 뷰포트 밖으로 안나감
      await assertNotOverflowViewport(
        page,
        '[class*="rounded-2xl"], [class*="rounded-xl"], [class*="rounded-[12px]"]',
        vp.w,
        `onboarding-card@${vp.label}`
      )

      await ctx.close()
    })
  }

  // R-MINHEIGHT: 360px 버튼 터치 타겟 ≥ 44px
  test('@360px 제출 버튼 높이 ≥ 44px', async ({ browser }) => {
    const ctx  = await makeCtx(browser, VP360)
    const page = await ctx.newPage()
    await injectWorker(page)
    await mockOnboardingAPIs(page)
    await page.goto(`${BASE}/my/onboarding`)
    await page.waitForSelector('nav.fixed.bottom-0, h1', { timeout: 10000 })

    // 주요 CTA 버튼이 있을 때만 높이 검증
    await assertMinHeight(page, 'button[class*="h-12"], button[class*="bg-brand-accent"]', 44, 'onboarding-btn@360')
    await ctx.close()
  })

  // R-FAB: 하단 nav가 서류 항목 가리지 않음 (390px)
  test('@390px 하단 nav가 서류 카드 가리지 않음', async ({ browser }) => {
    const ctx  = await makeCtx(browser, VP390)
    const page = await ctx.newPage()
    await injectWorker(page)
    await mockOnboardingAPIs(page)
    await page.goto(`${BASE}/my/onboarding`)

    // 서류 카드가 DOM에 나타날 때까지 대기
    await page.waitForSelector('[class*="rounded-2xl"], [class*="rounded-xl"], nav.fixed.bottom-0', { timeout: 10000 })

    await assertNavNotCovering(
      page,
      '[class*="rounded-2xl"], [class*="rounded-xl"]',
      'onboarding-nav-fab@390'
    )
    await ctx.close()
  })
})

// ════════════════════════════════════════════════════════════
//  [MOBILE:wage] 근로자 /wage  노임 페이지
// ════════════════════════════════════════════════════════════
async function mockWageAPIs(page: Page) {
  const ok = (d: unknown) => ({ success: true, data: d })
  await page.route(`${BASE}/api/attendance/monthly**`, r =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(ok({ days: [], summary: { totalDays: 0, totalMinutes: 0 } })) }))
  await page.route(`${BASE}/api/wage/my-payslip**`, r =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(ok({ days: [], summary: { totalWage: 0 } })) }))
}

test.describe('[MOBILE:wage] 근로자 노임 페이지', () => {
  for (const vp of MOBILE_VPS) {
    test(`@${vp.label}px HScroll·카드overflow`, async ({ browser }) => {
      const ctx  = await makeCtx(browser, vp)
      const page = await ctx.newPage()
      await injectWorker(page)
      await mockWageAPIs(page)
      await page.goto(`${BASE}/wage`)
      // 하단 nav 또는 컨텐츠 로딩 대기
      await page.waitForSelector('nav.fixed.bottom-0, h1, [class*="rounded"]', { timeout: 10000 })

      await assertNoHScroll(page, `wage@${vp.label}`)

      // R-OVERFLOW: 요약 카드/배지가 뷰포트 밖으로 안나감
      await assertNotOverflowViewport(
        page,
        '[class*="rounded-2xl"], [class*="rounded-xl"], [class*="rounded-full"]',
        vp.w,
        `wage-card@${vp.label}`
      )

      await ctx.close()
    })
  }

  // R-FAB: 하단 nav가 월 선택 버튼 가리지 않음 (390px)
  test('@390px 하단 nav가 월 선택 영역 가리지 않음', async ({ browser }) => {
    const ctx  = await makeCtx(browser, VP390)
    const page = await ctx.newPage()
    await injectWorker(page)
    await mockWageAPIs(page)
    await page.goto(`${BASE}/wage`)

    // 월 선택 버튼 또는 컨텐츠가 DOM에 나타날 때까지 대기
    await page.waitForSelector(
      'button:has-text("이전"), button:has-text("다음"), button:has-text("월"), nav.fixed.bottom-0',
      { state: 'attached', timeout: 8000 }
    ).catch(() => {})

    await assertNavNotCovering(
      page,
      'button:has-text("이전"), button:has-text("다음")',
      'wage-nav-fab@390'
    )
    await ctx.close()
  })

  // R-OVERFLOW: 360px 빈상태(0원) 텍스트 overflow 없음
  test('@360px 빈상태 텍스트 overflow 없음', async ({ browser }) => {
    const ctx  = await makeCtx(browser, VP360)
    const page = await ctx.newPage()
    await injectWorker(page)
    await mockWageAPIs(page)
    await page.goto(`${BASE}/wage`)
    await page.waitForSelector('nav.fixed.bottom-0, [class*="rounded"]', { timeout: 10000 })

    // 빈상태에서 수평 overflow 없음
    await assertNoHScroll(page, 'wage-empty@360')
    await ctx.close()
  })
})

// ════════════════════════════════════════════════════════════
//  [MOBILE:daily-report] 근로자 /daily-report  작업일보
// ════════════════════════════════════════════════════════════
async function mockDailyReportAPIs(page: Page) {
  const ok = (d: unknown) => ({ success: true, data: d })
  const TODAY = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10)
  const WORKING = ok({
    id: 'a-1', siteId: 's-1', checkInSite: { id: 's-1', name: '테스트현장' },
    workDate: TODAY, checkInAt: `${TODAY}T09:00:00+09:00`, checkOutAt: null, status: 'WORKING',
  })
  await page.route(`${BASE}/api/auth/me`, r =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(ok({ id: 'w-1', name: 'E2E테스트', accountStatus: 'APPROVED' })) }))
  await page.route(`${BASE}/api/attendance/today`, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(WORKING) }))
  await page.route(`${BASE}/api/worker/daily-reports**`, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ok([])) }))
  await page.route(`${BASE}/api/worker/trades**`, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ok([])) }))
  await page.route(`${BASE}/api/worker/locations**`, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ok([])) }))
  await page.route(`${BASE}/api/worker/daily-reports/suggestions**`, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ok([])) }))
}

test.describe('[MOBILE:daily-report] 근로자 작업일보', () => {
  for (const vp of MOBILE_VPS) {
    test(`@${vp.label}px HScroll·카드overflow`, async ({ browser }) => {
      const ctx  = await makeCtx(browser, vp)
      const page = await ctx.newPage()
      await injectWorker(page)
      await mockDailyReportAPIs(page)
      await page.goto(`${BASE}/daily-report`)
      await page.waitForSelector('nav.fixed.bottom-0, h1, [class*="rounded"]', { timeout: 10000 })

      await assertNoHScroll(page, `daily-report@${vp.label}`)
      await assertNotOverflowViewport(page, '[class*="rounded-2xl"], [class*="rounded-xl"]', vp.w, `daily-report-card@${vp.label}`)
      await ctx.close()
    })
  }

  // R-MINHEIGHT: 360px 저장 버튼 ≥ 44px
  test('@360px 저장 버튼 높이 ≥ 44px', async ({ browser }) => {
    const ctx  = await makeCtx(browser, VP360)
    const page = await ctx.newPage()
    await injectWorker(page)
    await mockDailyReportAPIs(page)
    await page.goto(`${BASE}/daily-report`)
    await page.waitForSelector('nav.fixed.bottom-0, [class*="rounded"]', { timeout: 10000 })
    await assertMinHeight(page, 'button[class*="h-12"], button[class*="bg-brand-accent"]', 44, 'daily-report-btn@360')
    await ctx.close()
  })

  // R-FAB: 하단 nav가 저장 버튼 가리지 않음 (390px)
  test('@390px 하단 nav가 저장 버튼 가리지 않음', async ({ browser }) => {
    const ctx  = await makeCtx(browser, VP390)
    const page = await ctx.newPage()
    await injectWorker(page)
    await mockDailyReportAPIs(page)
    await page.goto(`${BASE}/daily-report`)
    // 저장 버튼이 DOM에 나타날 때까지 대기
    await page.waitForSelector(
      'button[class*="h-12"], button[class*="bg-brand-accent"], button:has-text("저장")',
      { state: 'attached', timeout: 8000 }
    ).catch(() => {})
    await assertNavNotCovering(page, 'button:has-text("저장"), button:has-text("수정 저장")', 'daily-report-nav-fab@390')
    await ctx.close()
  })
})

// ════════════════════════════════════════════════════════════
//  [MOBILE:my-sites] 근로자 /my/sites  내 현장
// ════════════════════════════════════════════════════════════
test.describe('[MOBILE:my-sites] 근로자 내 현장', () => {
  for (const vp of MOBILE_VPS) {
    test(`@${vp.label}px HScroll·카드overflow`, async ({ browser }) => {
      const ctx  = await makeCtx(browser, vp)
      const page = await ctx.newPage()
      await injectWorker(page)
      const ok = (d: unknown) => ({ success: true, data: d })
      await page.route(`${BASE}/api/attendance/available-sites**`, r =>
        r.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ success: true, sites: [] }) }))
      // me mock: 로그인 리다이렉트 방지
      await page.route(`${BASE}/api/auth/me`, r =>
        r.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify(ok({ id: 'w-1', name: 'E2E테스트', accountStatus: 'APPROVED' })) }))
      await page.goto(`${BASE}/my/sites`)
      await page.waitForSelector('nav.fixed.bottom-0, h1, [class*="rounded"]', { timeout: 10000 })

      await assertNoHScroll(page, `my-sites@${vp.label}`)
      await assertNotOverflowViewport(page, '[class*="rounded-2xl"], [class*="rounded-xl"]', vp.w, `my-sites-card@${vp.label}`)
      await ctx.close()
    })
  }

  // R-OVERFLOW: 빈 상태(배정 현장 없음) overflow 없음 (360px)
  test('@360px 빈 상태 overflow 없음', async ({ browser }) => {
    const ctx  = await makeCtx(browser, VP360)
    const page = await ctx.newPage()
    await injectWorker(page)
    await page.route(`${BASE}/api/attendance/available-sites**`, r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, sites: [] }) }))
    await page.goto(`${BASE}/my/sites`)
    await page.waitForSelector('nav.fixed.bottom-0, h1', { timeout: 10000 })
    await assertNoHScroll(page, 'my-sites-empty@360')
    await ctx.close()
  })
})

// ════════════════════════════════════════════════════════════
//  [MOBILE:my-documents] 근로자 /my/documents  내 서류
// ════════════════════════════════════════════════════════════
test.describe('[MOBILE:my-documents] 근로자 내 서류', () => {
  for (const vp of MOBILE_VPS) {
    test(`@${vp.label}px HScroll·카드overflow·탭overflow`, async ({ browser }) => {
      const ctx  = await makeCtx(browser, vp)
      const page = await ctx.newPage()
      await injectWorker(page)
      const ok = (d: unknown) => ({ success: true, data: d })
      await page.route(`${BASE}/api/worker/documents**`, r =>
        r.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify(ok({ items: [], total: 0 })) }))
      await page.goto(`${BASE}/my/documents`)
      await page.waitForSelector('nav.fixed.bottom-0, h1, [class*="rounded"]', { timeout: 10000 })

      await assertNoHScroll(page, `my-documents@${vp.label}`)
      await assertNotOverflowViewport(page, '[class*="rounded-2xl"], [class*="rounded-xl"]', vp.w, `my-documents-card@${vp.label}`)
      // R-OVERFLOW: 탭 버튼(안전서류/계약서/동의서)이 뷰포트 밖으로 안나감
      await assertNotOverflowViewport(page, '[role="tab"], button[class*="h-9"], button[class*="h-10"]', vp.w, `my-documents-tab@${vp.label}`)
      await ctx.close()
    })
  }

  // R-MINHEIGHT: 390px 탭 버튼 ≥ 36px
  test('@390px 탭 버튼 높이 ≥ 36px', async ({ browser }) => {
    const ctx  = await makeCtx(browser, VP390)
    const page = await ctx.newPage()
    await injectWorker(page)
    const ok = (d: unknown) => ({ success: true, data: d })
    await page.route(`${BASE}/api/worker/documents**`, r =>
      r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(ok({ items: [], total: 0 })) }))
    await page.goto(`${BASE}/my/documents`)
    await page.waitForSelector('nav.fixed.bottom-0, h1', { timeout: 10000 })
    await assertMinHeight(page, '[role="tab"], button[class*="h-9"]', 36, 'my-documents-tab-height@390')
    await ctx.close()
  })
})
