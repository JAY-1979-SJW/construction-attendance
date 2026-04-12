/**
 * mobile-consent-docs.spec.ts
 * 앱 공통 문서 동의 시스템 E2E
 *
 * CD-01  GET /api/worker/required-documents → success: true, docs 배열 존재
 * CD-02  POST /api/worker/required-documents/agree (global doc) → agreedAt 저장
 * CD-03  동의 후 재조회 → agreedAt != null
 * CD-04  출퇴근 앱 진입 390px — 필수 문서 버튼 또는 동의완료 버튼 노출
 * CD-05  DocumentConsentModal 전체화면 차지 (390px)
 * CD-06  360px 출퇴근 앱 — 수평 스크롤 없음
 * CD-07  412px 출퇴근 앱 — 수평 스크롤 없음
 * CD-08  관리자 GET /api/admin/consent-docs → 목록 반환
 * CD-09  관리자 POST /api/admin/consent-docs → 새 문서 등록
 */
import { test, expect, type Page, type Browser } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const BASE         = process.env.BASE_URL        || 'https://attendance.haehan-ai.kr'
const WORKER_PHONE = process.env.E2E_WORKER_PHONE || '01077770001'
const WORKER_PASS  = process.env.E2E_WORKER_PASS  || 'Test2026!!'
const ADMIN_EMAIL  = process.env.E2E_ADMIN_EMAIL  || 'jay@haehan-ai.kr'
const ADMIN_PASS   = process.env.E2E_ADMIN_PASS   || 'Haehan2026!'
const TOKEN_FILE   = path.join(__dirname, '..', 'logs', '.worker-consent-e2e-token.txt')

let _workerTokenCache: string | null = null
let _adminTokenCache:  string | null = null

async function fetchWorkerToken(): Promise<string> {
  if (_workerTokenCache) return _workerTokenCache
  if (fs.existsSync(TOKEN_FILE)) {
    const raw = fs.readFileSync(TOKEN_FILE, 'utf-8').trim()
    if (raw) {
      try {
        const parts = raw.split('.')
        if (parts.length === 3) {
          const p = JSON.parse(Buffer.from(parts[1] + '==', 'base64').toString())
          if (p.exp * 1000 > Date.now() + 60_000) { _workerTokenCache = raw; return raw }
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

async function fetchAdminToken(): Promise<string> {
  if (_adminTokenCache) return _adminTokenCache
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASS }),
  })
  const m = (res.headers.get('set-cookie') ?? '').match(/admin_token=([^;]+)/)
  if (!m) {
    // try session cookie
    const d = await res.json()
    if (d.token) { _adminTokenCache = d.token; return _adminTokenCache! }
    throw new Error(`관리자 로그인 실패: ${res.status}`)
  }
  _adminTokenCache = m[1]
  return _adminTokenCache!
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

// ── CD-01: GET required-documents ────────────────────────────
test('CD-01 GET /api/worker/required-documents — success: true', async ({ request }) => {
  let token: string
  try { token = await fetchWorkerToken() }
  catch (e) { test.skip(true, `워커 인증 실패: ${(e as Error).message}`); return }

  const res = await request.get(`${BASE}/api/worker/required-documents`, {
    headers: { Cookie: `worker_token=${token}` },
  })
  expect(res.status()).toBe(200)
  const d = await res.json()
  expect(d.success).toBe(true)
  expect(Array.isArray(d.data.docs)).toBe(true)
  expect(typeof d.data.pendingCount).toBe('number')
})

// ── CD-02 + CD-03: agree + 재조회 ────────────────────────────
test('CD-02~03 agree 전역 문서 → agreedAt 저장 및 재조회', async ({ request }) => {
  let token: string
  try { token = await fetchWorkerToken() }
  catch (e) { test.skip(true, `워커 인증 실패: ${(e as Error).message}`); return }

  // 전역 문서 ID 가져오기
  const listRes = await request.get(`${BASE}/api/worker/required-documents`, {
    headers: { Cookie: `worker_token=${token}` },
  })
  const listData = await listRes.json()
  const docs: { id: string; docType: string; agreedAt: string | null }[] = listData.data.docs
  const globalDoc = docs.find(d => !d.id.startsWith('labor-contract:') && d.docType !== 'LABOR_CONTRACT')
  if (!globalDoc) { test.skip(true, '전역 ConsentDoc 없음'); return }

  // 동의
  const agreeRes = await request.post(`${BASE}/api/worker/required-documents/agree`, {
    headers: {
      Cookie: `worker_token=${token}`,
      'Content-Type': 'application/json',
    },
    data: { docId: globalDoc.id },
  })
  expect(agreeRes.status()).toBe(200)
  const agreeData = await agreeRes.json()
  expect(agreeData.success).toBe(true)
  expect(typeof agreeData.data.agreedAt).toBe('string')

  // 재조회 — agreedAt != null
  const reRes = await request.get(`${BASE}/api/worker/required-documents`, {
    headers: { Cookie: `worker_token=${token}` },
  })
  const reData = await reRes.json()
  const reDoc = reData.data.docs.find((d: { id: string }) => d.id === globalDoc.id)
  expect(reDoc?.agreedAt).not.toBeNull()
})

// ── CD-04: 출퇴근 앱 390px — 문서 버튼 노출 ─────────────────
test('CD-04 출퇴근 앱 390px — 문서 버튼 노출', async ({ browser }) => {
  const ctx  = await makeCtx(browser, 390)
  const page = await ctx.newPage()
  await injectWorker(page)
  await page.goto(`${BASE}/attendance`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)

  // "필수 문서 N건 확인" 또는 "문서 동의완료"
  const btn = page.locator('button').filter({ hasText: /필수 문서|문서 동의완료/ })
  await expect(btn.first()).toBeVisible({ timeout: 8000 })
  await ctx.close()
})

// ── CD-05: DocumentConsentModal 전체화면 (390px) ────────────
test('CD-05 DocumentConsentModal 전체화면 390px', async ({ browser }) => {
  const ctx  = await makeCtx(browser, 390)
  const page = await ctx.newPage()
  await injectWorker(page)
  await page.goto(`${BASE}/attendance`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)

  // 레이아웃의 자동 팝업 OR 헤더 버튼 클릭
  const alreadyOpen = await page.locator('div.fixed.inset-0').isVisible().catch(() => false)
  if (!alreadyOpen) {
    const btn = page.locator('button').filter({ hasText: /필수 문서|문서 동의완료/ })
    if (await btn.count() === 0) { test.skip(true, '문서 버튼 없음'); await ctx.close(); return }
    await btn.first().click()
    await page.waitForTimeout(500)
  }

  const modalBox = await page.locator('div.fixed.inset-0').first().boundingBox()
  const vpHeight  = await page.evaluate(() => window.innerHeight)
  const vpWidth   = await page.evaluate(() => window.innerWidth)

  if (modalBox) {
    expect(modalBox.height).toBeGreaterThanOrEqual(vpHeight - 5)
    expect(modalBox.width).toBeGreaterThanOrEqual(vpWidth - 5)
  }
  await ctx.close()
})

// ── CD-06: 360px 수평 스크롤 없음 ────────────────────────────
test('CD-06 출퇴근 앱 360px — 수평 스크롤 없음', async ({ browser }) => {
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

// ── CD-07: 412px 수평 스크롤 없음 ────────────────────────────
test('CD-07 출퇴근 앱 412px — 수평 스크롤 없음', async ({ browser }) => {
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

// ── CD-08: 관리자 GET consent-docs ───────────────────────────
test('CD-08 관리자 GET /api/admin/consent-docs — 목록 반환', async ({ request }) => {
  let token: string
  try { token = await fetchAdminToken() }
  catch (e) { test.skip(true, `관리자 인증 실패: ${(e as Error).message}`); return }

  const res = await request.get(`${BASE}/api/admin/consent-docs`, {
    headers: { Cookie: `admin_token=${token}` },
  })
  expect(res.status()).toBe(200)
  const d = await res.json()
  expect(d.success).toBe(true)
  expect(Array.isArray(d.data.docs)).toBe(true)
  // 기본 전역 문서 2건 이상 존재
  expect(d.data.docs.length).toBeGreaterThanOrEqual(2)
})

// ── CD-09: 관리자 POST consent-docs ──────────────────────────
test('CD-09 관리자 POST /api/admin/consent-docs — 새 문서 등록', async ({ request }) => {
  let token: string
  try { token = await fetchAdminToken() }
  catch (e) { test.skip(true, `관리자 인증 실패: ${(e as Error).message}`); return }

  const res = await request.post(`${BASE}/api/admin/consent-docs`, {
    headers: {
      Cookie: `admin_token=${token}`,
      'Content-Type': 'application/json',
    },
    data: {
      docType:   'GENERAL',
      scope:     'GLOBAL',
      title:     '[E2E 테스트] 임시 공지사항',
      contentMd: '## E2E 테스트 문서\n이 문서는 자동 테스트로 생성되었습니다.',
      isRequired: false,
      sortOrder:  99,
    },
  })
  expect(res.status()).toBe(200)
  const d = await res.json()
  expect(d.success).toBe(true)
  expect(d.data.doc.id).toBeTruthy()
})
