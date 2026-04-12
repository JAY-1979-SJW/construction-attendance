/**
 * admin-worker-management.spec.ts
 * 근로자 목록 / 상세 / 등록 / 수정 화면 자동 점검
 */
import { test, expect, type Page } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const BASE = process.env.BASE_URL || 'https://attendance.haehan-ai.kr'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'jay@haehan-ai.kr'
const ADMIN_PASS  = process.env.ADMIN_PASSWORD || 'Haehan2026!'
// 모든 admin spec이 동일 토큰 파일 공유 → 연속 실행 시 rate limit 방지
const TOKEN_FILE  = path.join(__dirname, '..', 'logs', '.admin-token.txt')

// ── 관리자 토큰 획득 (JWT 만료 기반 캐시, 429 시 최대 2회 retry) ─────────────
let _tokenCache = ''
async function fetchAdminToken(): Promise<string> {
  // 1) ADMIN_JWT 환경변수 우선
  if (process.env.ADMIN_JWT) return process.env.ADMIN_JWT
  // 2) 메모리 캐시
  if (_tokenCache) return _tokenCache
  // 3) 파일 캐시 — JWT exp 기반 유효성 확인
  if (fs.existsSync(TOKEN_FILE)) {
    const raw = fs.readFileSync(TOKEN_FILE, 'utf-8').trim()
    if (raw) {
      try {
        const payload = JSON.parse(Buffer.from(raw.split('.')[1], 'base64').toString())
        if (payload.exp * 1000 > Date.now() + 60_000) {
          _tokenCache = raw
          return _tokenCache
        }
      } catch { /* fall through */ }
    }
  }
  // 4) 로그인 API 호출 (429 시 60초 대기 후 1회 재시도)
  async function doLogin(): Promise<Response> {
    const r = await fetch(`${BASE}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASS }),
    })
    if (r.status === 429) {
      await new Promise(resolve => setTimeout(resolve, 62_000))
      return fetch(`${BASE}/api/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASS }),
      })
    }
    return r
  }
  const res = await doLogin()
  const setCookie = res.headers.get('set-cookie') || ''
  const match = setCookie.match(/admin_token=([^;]+)/)
  if (!match) throw new Error(`admin 로그인 실패: ${res.status}`)
  _tokenCache = match[1]
  fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true })
  fs.writeFileSync(TOKEN_FILE, _tokenCache)
  return _tokenCache
}

async function injectAdmin(page: Page) {
  const token = await fetchAdminToken()
  const domain = new URL(BASE).hostname
  await page.context().addCookies([{
    name: 'admin_token', value: token,
    domain, path: '/', httpOnly: true, secure: true, sameSite: 'Lax',
  }])
}

// ── 1. 관리자 목록 진입 및 필수 컬럼 확인 ─────────────────────────────────
test('W-01 관리자 근로자 목록 — 필수 컬럼 11개 확인', async ({ page }) => {
  await injectAdmin(page)
  await page.goto(`${BASE}/admin/workers`)
  await page.waitForSelector('text=근로자관리', { timeout: 15000 })
  for (const col of ['이름', '연락처', '소속팀', '팀장', '반장', '직종/공종', '재직', '최근출근일', '근로계약서', '안전교육', '확인상태']) {
    await expect(page.getByRole('columnheader', { name: col })).toBeVisible()
  }
})

// ── 2. 이름/연락처 검색 동작 ───────────────────────────────────────────────
test('W-02 이름/연락처 검색 필터 — 오류 없이 동작', async ({ page }) => {
  await injectAdmin(page)
  await page.goto(`${BASE}/admin/workers`)
  await page.waitForSelector('text=근로자관리', { timeout: 15000 })
  const searchInput = page.getByPlaceholder('이름/연락처 검색')
  await searchInput.fill('홍')
  await page.waitForTimeout(800)
  // 로딩 완료 후 에러 없이 페이지 유지 확인
  await expect(page.getByRole('heading', { name: '근로자관리' }).first()).toBeVisible()
})

// ── 3. 상태 필터 pill 동작 ────────────────────────────────────────────────
test('W-03 상태 필터 pill — 재직중/비활성/전체', async ({ page }) => {
  await injectAdmin(page)
  await page.goto(`${BASE}/admin/workers`)
  await page.waitForSelector('text=근로자관리', { timeout: 15000 })
  await page.getByRole('button', { name: '재직중', exact: true }).click()
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: '비활성', exact: true }).click()
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: '전체', exact: true }).first().click()
  await page.waitForTimeout(300)
  await expect(page.getByRole('heading', { name: '근로자관리' }).first()).toBeVisible()
})

// ── 4. 소속팀 필터 입력 ───────────────────────────────────────────────────
test('W-04 소속팀 필터 입력 — 오류 없이 동작', async ({ page }) => {
  await injectAdmin(page)
  await page.goto(`${BASE}/admin/workers`)
  await page.waitForSelector('text=근로자관리', { timeout: 15000 })
  await page.getByPlaceholder('소속팀').fill('E2E테스트팀')
  await page.waitForTimeout(800)
  await expect(page.getByRole('heading', { name: '근로자관리' }).first()).toBeVisible()
})

// ── 5. 근로자 등록 버튼 노출 ─────────────────────────────────────────────
test('W-05 관리자 — 근로자 등록 버튼 노출', async ({ page }) => {
  await injectAdmin(page)
  await page.goto(`${BASE}/admin/workers`)
  await page.waitForSelector('text=근로자관리', { timeout: 15000 })
  await expect(page.getByRole('button', { name: '+ 근로자 등록' })).toBeVisible()
})

// ── 6. 등록 페이지 — 신규 필드 존재 확인 ────────────────────────────────
test('W-06 근로자 등록 페이지 — 신규 필드 placeholder 확인', async ({ page }) => {
  await injectAdmin(page)
  await page.goto(`${BASE}/admin/workers/new`)
  await page.waitForSelector('text=근로자 등록', { timeout: 15000 })
  // 기존 필드
  await expect(page.getByPlaceholder('홍길동')).toBeVisible()
  await expect(page.getByPlaceholder('010-1234-5678')).toBeVisible()
  // 신규 필드
  await expect(page.getByPlaceholder('예: 1팀, 철근팀')).toBeVisible()  // 소속팀
  await expect(page.getByPlaceholder('팀장 이름')).toBeVisible()
  await expect(page.getByPlaceholder('반장 이름')).toBeVisible()
  await expect(page.getByPlaceholder('010-0000-0000')).toBeVisible()     // 비상연락처
  // 입사일 (date input)
  await expect(page.locator('label:has-text("입사일") + div input[type="date"], label:has-text("입사일") ~ input[type="date"], input[type="date"]').first()).toBeVisible()
})

// ── 7. 상세 패널 — 섹션 구성 확인 ────────────────────────────────────────
test('W-07 근로자 상세 패널 — A·B·C 섹션 및 서류 항목', async ({ page }) => {
  await injectAdmin(page)
  await page.goto(`${BASE}/admin/workers`)
  await page.waitForSelector('text=근로자관리', { timeout: 15000 })
  const firstRow = page.locator('tbody tr').first()
  if (await firstRow.count() === 0) {
    test.skip(true, '근로자 데이터 없음')
    return
  }
  await firstRow.click()
  await page.waitForTimeout(600)
  await expect(page.locator('text=A. 기본 정보')).toBeVisible()
  await expect(page.locator('text=B. 소속 / 직종')).toBeVisible()
  await expect(page.locator('text=C. 서류 및 교육 상태')).toBeVisible()
  // 서류 항목 (exact 필수)
  await expect(page.getByText('근로계약서 작성', { exact: true })).toBeVisible()
  await expect(page.getByText('안전교육 이수', { exact: true })).toBeVisible()
  await expect(page.getByText('신분 확인', { exact: false }).first()).toBeVisible()
})

// ── 8. 수정 폼 — 신규 필드 placeholder 확인 ──────────────────────────────
test('W-08 근로자 수정 폼 — 신규 필드 노출', async ({ page }) => {
  await injectAdmin(page)
  await page.goto(`${BASE}/admin/workers`)
  await page.waitForSelector('text=근로자관리', { timeout: 15000 })
  const firstRow = page.locator('tbody tr').first()
  if (await firstRow.count() === 0) {
    test.skip(true, '근로자 데이터 없음')
    return
  }
  await firstRow.click()
  await page.waitForTimeout(600)
  await page.getByRole('button', { name: '기본정보 수정' }).click()
  await page.waitForTimeout(400)
  await expect(page.getByPlaceholder('예: 1팀')).toBeVisible()       // 소속팀
  await expect(page.getByPlaceholder('팀장 이름')).toBeVisible()
  await expect(page.getByPlaceholder('반장 이름')).toBeVisible()
  await expect(page.getByPlaceholder('010-0000-0000')).toBeVisible() // 비상연락처
})

// ── 9. API — 신규 필드 PUT → 응답 반영 확인 ─────────────────────────────
test('W-09 API — 신규 필드 PUT 저장 반영', async ({ request }) => {
  const token = await fetchAdminToken()
  const listRes = await request.get(`${BASE}/api/admin/workers?pageSize=1`, {
    headers: { Cookie: `admin_token=${token}` },
  })
  const listData = await listRes.json()
  expect(listData.success).toBe(true)
  if (!listData.data?.items?.length) {
    test.skip(true, '근로자 데이터 없음')
    return
  }
  const workerId = listData.data.items[0].id

  const putRes = await request.put(`${BASE}/api/admin/workers/${workerId}`, {
    headers: { Cookie: `admin_token=${token}`, 'Content-Type': 'application/json' },
    data: { teamName: 'E2E테스트팀', supervisorName: 'E2E팀장', foremanName: 'E2E반장', hireDate: '2024-01-01', emergencyContact: '01099990000' },
  })
  const putData = await putRes.json()
  expect(putData.success).toBe(true)
  expect(putData.data.teamName).toBe('E2E테스트팀')
  expect(putData.data.supervisorName).toBe('E2E팀장')
  expect(putData.data.foremanName).toBe('E2E반장')

  // 원상복구
  await request.put(`${BASE}/api/admin/workers/${workerId}`, {
    headers: { Cookie: `admin_token=${token}`, 'Content-Type': 'application/json' },
    data: { teamName: null, supervisorName: null, foremanName: null, hireDate: null, emergencyContact: null },
  })
})

// ── 10. 390px 뷰포트 — 가로 스크롤 없음 ─────────────────────────────────
test('W-10 390px 뷰포트 근로자 목록 — 가로 스크롤 없음', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  await injectAdmin(page)
  await page.goto(`${BASE}/admin/workers`)
  await page.waitForSelector('text=근로자관리', { timeout: 15000 })
  const scrollWidth = await page.evaluate(() => document.body.scrollWidth)
  const clientWidth = await page.evaluate(() => document.body.clientWidth)
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5)
  await ctx.close()
})

// ── 11. 한글 근로자명 — 목록 표시 정상 확인 ──────────────────────────────
// E2E 전용 근로자(phone=01077770001, name=E2E테스트)가 목록에 깨지지 않고 표시되는지 검증
// 관련 버그: EUC-KR 바이트가 UTF-8로 잘못 디코딩 → U+FFFD 치환 문자 삽입 (2026-04-04 발생)
test('W-11 한글 근로자명 — 목록 정상 표시 (인코딩 검증)', async ({ request }) => {
  const token = await fetchAdminToken()
  const res = await request.get(`${BASE}/api/admin/workers?search=01077770001&pageSize=5`, {
    headers: { Cookie: `admin_token=${token}` },
  })
  const data = await res.json()
  expect(data.success).toBe(true)
  if (!data.data?.items?.length) {
    test.skip(true, 'E2E 테스트 근로자(01077770001) 없음 — setup 필요')
    return
  }
  const worker = data.data.items[0]
  // 깨진 문자(U+FFFD, replacement char) 포함 여부 검증
  expect(worker.name).not.toContain('\uFFFD')
  // 한글이 실제로 포함되어 있는지 검증 (정상 한글 범위: U+AC00~U+D7A3)
  expect(/[\uAC00-\uD7A3]/.test(worker.name)).toBe(true)
})
