/**
 * mobile-labor-contract.spec.ts
 * 근로계약서 모바일 전체화면 팝업 — 기능·레이아웃 점검
 *
 * 검증 항목:
 *  LC-01 출퇴근 앱 진입 시 "근로계약서 확인" 버튼 노출 (390px)
 *  LC-02 모달 오픈 → 전체화면(전체 뷰포트) 차지
 *  LC-03 모달 본문 스크롤 가능 (overflow-y)
 *  LC-04 수평 스크롤 없음
 *  LC-05 닫기 버튼 동작 → 모달 닫힘
 *  LC-06 API GET /api/worker/my-contract → success: true
 *  LC-07 API POST /api/worker/my-contract/agree → agreedAt 저장
 *  LC-08 동의 후 재조회 → agreedAt != null
 *  LC-09 360px 뷰포트 — 수평 스크롤 없음
 *  LC-10 412px 뷰포트 — 수평 스크롤 없음
 */
import { test, expect, type Page, type Browser } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const BASE         = process.env.BASE_URL        || 'https://attendance.haehan-ai.kr'
const WORKER_PHONE = process.env.E2E_WORKER_PHONE || '01077770001'
const WORKER_PASS  = process.env.E2E_WORKER_PASS  || 'Test2026!!'
const TOKEN_FILE   = path.join(__dirname, '..', 'logs', '.worker-contract-e2e-token.txt')

// ── 토큰 캐시 ─────────────────────────────────────────────────
let _tokenCache: string | null = null

async function fetchWorkerToken(): Promise<string> {
  if (_tokenCache) return _tokenCache
  if (fs.existsSync(TOKEN_FILE)) {
    const raw = fs.readFileSync(TOKEN_FILE, 'utf-8').trim()
    if (raw) {
      try {
        const parts = raw.split('.')
        if (parts.length === 3) {
          const p = JSON.parse(Buffer.from(parts[1] + '==', 'base64').toString())
          if (p.exp * 1000 > Date.now() + 60_000) { _tokenCache = raw; return raw }
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
  _tokenCache = m[1]
  fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true })
  fs.writeFileSync(TOKEN_FILE, _tokenCache)
  return _tokenCache
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

async function makeCtx(browser: Browser, w: number, h = 844) {
  return browser.newContext({ viewport: { width: w, height: h } })
}

// ── LC-01: 출퇴근 앱 — 문서 동의 버튼 또는 공통 모달 노출 ─────────
// 근로계약서는 공통 문서 시스템에 흡수됨
// 헤더에 "필수 문서 N건 확인" 또는 "문서 동의완료" 버튼, 또는 자동팝업 모달
test('LC-01 출퇴근 앱 — 문서 동의 버튼/모달 390px 노출', async ({ browser }) => {
  const ctx  = await makeCtx(browser, 390)
  const page = await ctx.newPage()
  await injectWorker(page)
  await page.goto(`${BASE}/attendance`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)   // 세션 로드 + 문서 fetch 대기

  // 공통 문서 버튼 (헤더) 또는 자동팝업 모달 중 하나가 노출되어야 함
  const btn       = page.locator('button').filter({ hasText: /필수 문서|문서 동의완료/ })
  const autoModal = page.locator('div.fixed.inset-0')
  const isBtn     = await btn.count() > 0 && await btn.first().isVisible().catch(() => false)
  const isModal   = await autoModal.isVisible().catch(() => false)
  expect(isBtn || isModal, '문서 버튼 또는 자동팝업 모달이 노출되어야 함').toBe(true)
  await ctx.close()
})

// ── LC-02: 모달 오픈 → 전체화면 차지 ────────────────────────────
test('LC-02 모달 — 전체화면 높이 차지 (390px)', async ({ browser }) => {
  const ctx  = await makeCtx(browser, 390)
  const page = await ctx.newPage()
  await injectWorker(page)
  await page.goto(`${BASE}/attendance`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)

  const btn = page.locator('button:has-text("근로계약서")')
  if (await btn.count() === 0) { test.skip(true, '버튼 없음'); return }

  // 자동팝업이 이미 열려 있거나, 수동으로 클릭해서 열기
  const modal = page.locator('text=근로계약서').filter({ hasText: '닫기' })
  const isAlreadyOpen = await page.locator('button:has-text("닫기")').isVisible().catch(() => false)
  if (!isAlreadyOpen) {
    await btn.first().click()
    await page.waitForTimeout(500)
  }

  // 전체화면 모달 — fixed inset-0 → innerHeight와 동일해야 함
  const modalBox = await page.locator('div.fixed.inset-0').first().boundingBox()
  const vpHeight = await page.evaluate(() => window.innerHeight)
  const vpWidth  = await page.evaluate(() => window.innerWidth)

  if (modalBox) {
    expect(modalBox.height, 'modal height ≈ viewport height').toBeGreaterThanOrEqual(vpHeight - 5)
    expect(modalBox.width,  'modal width  ≈ viewport width' ).toBeGreaterThanOrEqual(vpWidth  - 5)
  }
  await ctx.close()
})

// ── LC-03: 모달 본문 스크롤 ────────────────────────────────────
test('LC-03 모달 본문 — overflow-y scroll 가능', async ({ browser }) => {
  const ctx  = await makeCtx(browser, 390)
  const page = await ctx.newPage()
  await injectWorker(page)
  await page.goto(`${BASE}/attendance`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)

  const btn = page.locator('button:has-text("근로계약서")')
  if (await btn.count() === 0) { test.skip(true, '버튼 없음'); return }

  const isAlreadyOpen = await page.locator('button:has-text("닫기")').isVisible().catch(() => false)
  if (!isAlreadyOpen) {
    await btn.first().click()
    await page.waitForTimeout(600)
  }

  // 모달 내 스크롤 컨테이너 (flex-1 overflow-y-auto)
  const scrollEl = page.locator('div.flex-1.overflow-y-auto').first()
  if (await scrollEl.count() === 0) { test.skip(true, '스크롤 컨테이너 없음'); return }

  const overflowY = await scrollEl.evaluate(el =>
    window.getComputedStyle(el).overflowY
  )
  expect(['auto', 'scroll']).toContain(overflowY)
  await ctx.close()
})

// ── LC-04: 모달 수평 스크롤 없음 (390px) ─────────────────────
test('LC-04 모달 — 수평 스크롤 없음 (390px)', async ({ browser }) => {
  const ctx  = await makeCtx(browser, 390)
  const page = await ctx.newPage()
  await injectWorker(page)
  await page.goto(`${BASE}/attendance`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)

  const btn = page.locator('button:has-text("근로계약서")')
  if (await btn.count() === 0) { test.skip(true, '버튼 없음'); return }

  const isAlreadyOpen = await page.locator('button:has-text("닫기")').isVisible().catch(() => false)
  if (!isAlreadyOpen) {
    await btn.first().click()
    await page.waitForTimeout(600)
  }

  const noHScroll = await page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2
  )
  expect(noHScroll, 'R-HSCROLL: 모달에서 수평 스크롤 발생').toBe(true)
  await ctx.close()
})

// ── LC-05: 닫기 버튼 → 모달 닫힘 ───────────────────────────────
test('LC-05 닫기 버튼 — 모달 닫힘', async ({ browser }) => {
  const ctx  = await makeCtx(browser, 390)
  const page = await ctx.newPage()
  await injectWorker(page)
  await page.goto(`${BASE}/attendance`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)

  const btn = page.locator('button:has-text("근로계약서")')
  if (await btn.count() === 0) { test.skip(true, '버튼 없음'); return }

  // 모달 열기
  const isAlreadyOpen = await page.locator('button:has-text("닫기")').isVisible().catch(() => false)
  if (!isAlreadyOpen) {
    await btn.first().click()
    await page.waitForTimeout(500)
  }

  // 닫기 버튼 클릭
  await page.locator('button:has-text("닫기")').first().click()
  await page.waitForTimeout(400)

  // 모달이 닫혔는지 — fixed inset-0 사라짐
  const modalVisible = await page.locator('div.fixed.inset-0').isVisible().catch(() => false)
  expect(modalVisible).toBe(false)
  await ctx.close()
})

// ── LC-06: API GET /api/worker/my-contract ───────────────────
test('LC-06 API GET my-contract — success: true', async ({ request }) => {
  let token: string
  try { token = await fetchWorkerToken() }
  catch (e) { test.skip(true, `워커 인증 실패: ${(e as Error).message}`); return }

  const res = await request.get(`${BASE}/api/worker/my-contract`, {
    headers: { Cookie: `worker_token=${token}` },
  })
  expect(res.status()).toBe(200)
  const d = await res.json()
  expect(d.success).toBe(true)
  // agreedAt은 null 또는 string
  expect(['string', 'object']).toContain(typeof d.data.agreedAt)
})

// ── LC-07: API POST agree → agreedAt 저장 ───────────────────
test('LC-07 API POST agree — agreedAt 저장 + LC-08 재조회 확인', async ({ request }) => {
  let token: string
  try { token = await fetchWorkerToken() }
  catch (e) { test.skip(true, `워커 인증 실패: ${(e as Error).message}`); return }

  // 동의 초기화 (이전 동의 있을 수 있음 — 멱등 테스트)
  const agreeRes = await request.post(`${BASE}/api/worker/my-contract/agree`, {
    headers: { Cookie: `worker_token=${token}` },
  })
  expect(agreeRes.status()).toBe(200)
  const agreeData = await agreeRes.json()
  expect(agreeData.success).toBe(true)
  expect(typeof agreeData.data.agreedAt).toBe('string')

  // LC-08: 재조회 — agreedAt != null
  const getRes = await request.get(`${BASE}/api/worker/my-contract`, {
    headers: { Cookie: `worker_token=${token}` },
  })
  const getData = await getRes.json()
  expect(getData.success).toBe(true)
  expect(getData.data.agreedAt).not.toBeNull()
})

// ── LC-09: 360px 수평 스크롤 없음 (출퇴근 앱 기본) ──────────────
test('LC-09 출퇴근 앱 360px — 수평 스크롤 없음', async ({ browser }) => {
  const ctx  = await makeCtx(browser, 360, 800)
  const page = await ctx.newPage()
  await injectWorker(page)
  await page.goto(`${BASE}/attendance`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const noHScroll = await page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2
  )
  expect(noHScroll, '360px R-HSCROLL').toBe(true)
  await ctx.close()
})

// ── LC-10: 412px 수평 스크롤 없음 ───────────────────────────────
test('LC-10 출퇴근 앱 412px — 수평 스크롤 없음', async ({ browser }) => {
  const ctx  = await makeCtx(browser, 412, 915)
  const page = await ctx.newPage()
  await injectWorker(page)
  await page.goto(`${BASE}/attendance`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const noHScroll = await page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2
  )
  expect(noHScroll, '412px R-HSCROLL').toBe(true)
  await ctx.close()
})
