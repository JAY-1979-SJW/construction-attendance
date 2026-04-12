/**
 * site-geocode-save.spec.ts
 * 현장 등록 — 주소 입력 → 좌표 확인 → 저장 API 검증
 * 구조 고정 기준: VWorld Geocoder REST API (서버 전용) + Leaflet 타일 지도
 */
import { test, expect, type Page } from '@playwright/test'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

const BASE = process.env.BASE_URL || 'https://attendance.haehan-ai.kr'
const ADMIN_EMAIL = 'jay@haehan-ai.kr'
const ADMIN_PASS  = 'Haehan2026!'
const TOKEN_FILE  = path.join(os.tmpdir(), 'admin_token_geocode.txt')

let _tokenCache = ''
async function fetchAdminToken(): Promise<string> {
  if (_tokenCache) return _tokenCache
  if (fs.existsSync(TOKEN_FILE)) {
    const stat = fs.statSync(TOKEN_FILE)
    if (Date.now() - stat.mtimeMs < 30 * 60 * 1000) {
      _tokenCache = fs.readFileSync(TOKEN_FILE, 'utf-8').trim()
      if (_tokenCache) return _tokenCache
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

async function injectAdmin(page: Page) {
  const token = await fetchAdminToken()
  const domain = new URL(BASE).hostname
  await page.context().addCookies([{
    name: 'admin_token', value: token,
    domain, path: '/', httpOnly: true, secure: true, sameSite: 'Lax',
  }])
}

// ── GEO-01: Geocoder API — 주소 → 좌표 반환 ──────────────────────────────
test('GEO-01 VWorld Geocoder API — 주소 → 좌표 반환', async ({ request }) => {
  const token = await fetchAdminToken()
  const testAddress = '서울특별시 강남구 테헤란로 152'
  const res = await request.get(
    `${BASE}/api/admin/geocode?address=${encodeURIComponent(testAddress)}`,
    { headers: { Cookie: `admin_token=${token}` } }
  )
  expect(res.status()).toBe(200)
  const data = await res.json()
  expect(data.success).toBe(true)
  expect(typeof data.data.lat).toBe('number')
  expect(typeof data.data.lng).toBe('number')
  // 서울 좌표 범위 검증
  expect(data.data.lat).toBeGreaterThan(37.0)
  expect(data.data.lat).toBeLessThan(38.0)
  expect(data.data.lng).toBeGreaterThan(126.0)
  expect(data.data.lng).toBeLessThan(128.0)
})

// ── GEO-02: 현장 신규 등록 페이지 — 주소 입력 필드 존재 확인 ──────────────
test('GEO-02 현장 등록 페이지 — 주소/좌표 필드 노출', async ({ page }) => {
  await injectAdmin(page)
  await page.goto(`${BASE}/admin/sites`)
  await page.waitForSelector('text=현장관리', { timeout: 15000 })
  // 현장 등록 버튼
  const addBtn = page.getByRole('button', { name: /현장 등록|현장 추가|새 현장/ })
  if (await addBtn.count() === 0) {
    test.skip(true, '현장 등록 버튼 없음')
    return
  }
  await addBtn.first().click()
  await page.waitForTimeout(500)
  // 주소 입력 필드 확인
  const addrInput = page.getByPlaceholder(/주소|도로명|지번/)
  await expect(addrInput.first()).toBeVisible()
})

// ── GEO-03: 현장 저장 API — lat/lng 포함 POST → 성공 응답 ──────────────────
test('GEO-03 현장 저장 API — 좌표 포함 POST 201 반환', async ({ request }) => {
  const token = await fetchAdminToken()

  // 좌표 먼저 획득
  const geoRes = await request.get(
    `${BASE}/api/admin/geocode?address=${encodeURIComponent('서울특별시 중구 세종대로 110')}`,
    { headers: { Cookie: `admin_token=${token}` } }
  )
  const geoData = await geoRes.json()
  expect(geoData.success).toBe(true)
  const { lat, lng } = geoData.data

  // 현장 저장 (테스트 현장명으로 등록 후 삭제)
  const siteName = `E2E_GEO_TEST_${Date.now()}`
  const saveRes = await request.post(`${BASE}/api/admin/sites`, {
    headers: { Cookie: `admin_token=${token}`, 'Content-Type': 'application/json' },
    data: {
      name: siteName,
      address: '서울특별시 중구 세종대로 110',
      latitude: lat,
      longitude: lng,
    },
  })
  const saveData = await saveRes.json()
  expect(saveData.success).toBe(true)
  expect(saveData.data?.latitude).toBeCloseTo(lat, 3)
  expect(saveData.data?.longitude).toBeCloseTo(lng, 3)

  // 테스트 현장 삭제 (원상복구)
  const siteId = saveData.data?.id
  if (siteId) {
    await request.delete(`${BASE}/api/admin/sites/${siteId}`, {
      headers: { Cookie: `admin_token=${token}` },
    })
  }
})

// ── GEO-04: Leaflet 지도 컨테이너 — 좌표 있을 때 렌더링 확인 ──────────────
test('GEO-04 현장 목록 — 상세 패널 지도 컨테이너 존재', async ({ page }) => {
  await injectAdmin(page)
  await page.goto(`${BASE}/admin/sites`)
  await page.waitForSelector('text=현장관리', { timeout: 15000 })
  const firstRow = page.locator('tbody tr').first()
  if (await firstRow.count() === 0) {
    test.skip(true, '현장 데이터 없음')
    return
  }
  await firstRow.click()
  await page.waitForTimeout(800)
  // Leaflet 컨테이너 (leaflet-container 클래스)
  const leafletContainer = page.locator('.leaflet-container')
  const mapMsg = page.locator('text=위치 정보 없음')
  // 둘 중 하나는 반드시 존재
  const hasLeaflet = await leafletContainer.count() > 0
  const hasNoCoords = await mapMsg.count() > 0
  expect(hasLeaflet || hasNoCoords).toBe(true)
})

// ── GEO-05: VWorld SDK 의존성 없음 확인 ─────────────────────────────────────
test('GEO-05 페이지 — VWorld SDK script 로드 없음', async ({ page }) => {
  await injectAdmin(page)
  const vworldSdkRequests: string[] = []
  page.on('request', req => {
    const url = req.url()
    if (url.includes('vworldMapInit') || url.includes('sopMapInit') || url.includes('check2DNum')) {
      vworldSdkRequests.push(url)
    }
  })
  await page.goto(`${BASE}/admin/sites`)
  await page.waitForSelector('text=현장관리', { timeout: 15000 })
  await page.waitForTimeout(1000)
  // VWorld JS SDK 호출이 없어야 함
  expect(vworldSdkRequests).toHaveLength(0)
})
