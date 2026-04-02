/**
 * E2E 전체 관리자 흐름 테스트
 * 공개 페이지 렌더링 + 관리자 로그인 후 전체 페이지 접근 확인
 */
import { test, expect, type Page } from '@playwright/test'

const BASE = process.env.BASE_URL || 'https://attendance.haehan-ai.kr'

// 관리자 로그인 헬퍼
async function adminLogin(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/admin/login`)
  await page.waitForLoadState('networkidle')
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button:has-text("로그인")')
  await page.waitForURL(/\/admin/, { timeout: 10000 })
}

// ─── 공개 페이지 ───────────────────────────────────────────────

test.describe('공개 페이지 렌더링', () => {
  test('메인 랜딩 페이지', async ({ page }) => {
    await page.goto(BASE)
    await page.waitForLoadState('networkidle')
    const title = await page.title()
    expect(title).toContain('해한')
    // 관리자 로그인 링크 확인
    await expect(page.locator('a[href="/admin/login"]').first()).toBeVisible({ timeout: 10000 })
  })

  test('관리자 로그인 페이지', async ({ page }) => {
    await page.goto(`${BASE}/admin/login`)
    await page.waitForLoadState('networkidle')
    // 이메일/비밀번호 입력란
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('input[type="password"]')).toBeVisible()
    // 가입 링크
    await expect(page.locator('text=업체관리자 가입 신청')).toBeVisible()
  })

  test('업체관리자 가입 신청 페이지', async ({ page }) => {
    await page.goto(`${BASE}/register/company-admin`)
    await page.waitForLoadState('networkidle')
    // 필수 입력 필드 확인
    // 가입 폼이 렌더링되었는지 (CSR이므로 충분히 대기)
    await expect(page.locator('button:has-text("관리자 신청"), input[placeholder]').first()).toBeVisible({ timeout: 15000 })
  })

  test('근로자 로그인 페이지', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await page.waitForLoadState('networkidle')
    const title = await page.title()
    expect(title).toContain('해한')
  })

  test('근로자 가입 페이지', async ({ page }) => {
    await page.goto(`${BASE}/register`)
    await page.waitForLoadState('networkidle')
    const title = await page.title()
    expect(title).toContain('해한')
  })
})

// ─── 관리자 로그인 후 페이지 ────────────────────────────────────

test.describe('관리자 페이지 (로그인 필요)', () => {
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'jay@haehan-ai.kr'
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234'

  test.beforeEach(async ({ page }) => {
    // JWT 쿠키 직접 세팅 (로그인 비밀번호를 모를 경우 대비)
    const token = process.env.ADMIN_JWT
    if (token) {
      await page.context().addCookies([{
        name: 'admin_token',
        value: token,
        domain: new URL(BASE).hostname,
        path: '/',
      }])
    } else {
      // 실제 로그인 시도
      try {
        await adminLogin(page, ADMIN_EMAIL, ADMIN_PASSWORD)
      } catch {
        test.skip(true, '관리자 로그인 실패 — ADMIN_JWT 환경변수를 설정하세요')
      }
    }
  })

  const ADMIN_PAGES = [
    { path: '/admin', name: '대시보드' },
    { path: '/admin/sites', name: '현장 관리' },
    { path: '/admin/workers', name: '근로자 관리' },
    { path: '/admin/workers/new', name: '근로자 등록' },
    { path: '/admin/approvals', name: '승인 관리' },
    { path: '/admin/contracts', name: '근로계약서' },
    { path: '/admin/document-packages', name: '제출 서류 검토' },
    { path: '/admin/attendance', name: '출퇴근 관리' },
    { path: '/admin/work-confirmations', name: '공수 관리' },
    { path: '/admin/wage', name: '노임 관리' },
    { path: '/admin/insurance-eligibility', name: '보험 자격 판정' },
    { path: '/admin/settings', name: '운영 설정' },
    { path: '/admin/companies', name: '회사 관리' },
    { path: '/admin/materials/requests', name: '자재청구' },
    { path: '/admin/reports', name: '작업일보' },
    { path: '/admin/audit-logs', name: '감사 로그' },
    { path: '/admin/devices', name: '기기 관리' },
  ]

  for (const pg of ADMIN_PAGES) {
    test(`${pg.name} (${pg.path})`, async ({ page }) => {
      await page.goto(`${BASE}${pg.path}`)
      await page.waitForLoadState('networkidle')
      // 로그인 페이지로 리다이렉트되지 않았는지 확인
      const url = page.url()
      expect(url).not.toContain('/admin/login')
      // 에러 페이지가 아닌지 확인
      // 404/500 에러 페이지가 아닌지 확인
      const h1 = await page.locator('h1').first().textContent().catch(() => '')
      expect(h1).not.toContain('404')
      expect(h1).not.toContain('Internal Server Error')
    })
  }
})

// ─── 근로자 페이지 (로그인 필요) ────────────────────────────────

test.describe('근로자 페이지 (로그인 필요)', () => {
  test.beforeEach(async ({ page }) => {
    const token = process.env.WORKER_JWT
    if (!token) {
      test.skip(true, 'WORKER_JWT 환경변수를 설정하세요')
      return
    }
    await page.context().addCookies([{
      name: 'worker_token',
      value: token,
      domain: new URL(BASE).hostname,
      path: '/',
    }])
  })

  const WORKER_PAGES = [
    { path: '/attendance', name: '출퇴근' },
    { path: '/my/sites', name: '배정 현장' },
    { path: '/my/onboarding', name: '서류 제출' },
    { path: '/my/material-requests', name: '자재청구' },
    { path: '/my/status', name: '내 정보' },
    { path: '/daily-report', name: '작업일보' },
  ]

  for (const pg of WORKER_PAGES) {
    test(`${pg.name} (${pg.path})`, async ({ page }) => {
      await page.goto(`${BASE}${pg.path}`)
      await page.waitForLoadState('networkidle')
      const url = page.url()
      expect(url).not.toContain('/login')
      const h1 = await page.locator('h1').first().textContent().catch(() => '')
      expect(h1).not.toContain('404')
    })
  }
})
