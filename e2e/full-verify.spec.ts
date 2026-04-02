import { test, expect } from '@playwright/test'

const BASE = process.env.BASE_URL || 'https://attendance.haehan-ai.kr'

// ── 공개 페이지 ────────────────────────────────────
test.describe('공개 페이지', () => {
  const pages = [
    { path: '/', name: '메인 랜딩' },
    { path: '/admin/login', name: '관리자 로그인' },
    { path: '/register/company-admin', name: '업체관리자 가입' },
    { path: '/login', name: '근로자 로그인' },
    { path: '/register', name: '근로자 가입' },
  ]
  for (const pg of pages) {
    test(pg.name, async ({ page }) => {
      const res = await page.goto(`${BASE}${pg.path}`)
      expect(res?.status()).toBeLessThan(500)
    })
  }
})

// ── 관리자 페이지 ──────────────────────────────────
test.describe('관리자 페이지', () => {
  test.beforeEach(async ({ page }) => {
    const token = process.env.ADMIN_JWT
    if (!token) { test.skip(true, 'ADMIN_JWT 없음'); return }
    await page.context().addCookies([{ name: 'admin_token', value: token, domain: new URL(BASE).hostname, path: '/' }])
  })
  const pages = [
    '/admin', '/admin/sites', '/admin/workers', '/admin/workers/new',
    '/admin/approvals', '/admin/contracts', '/admin/document-packages',
    '/admin/attendance', '/admin/work-confirmations', '/admin/wage',
    '/admin/insurance-eligibility', '/admin/settings', '/admin/companies',
    '/admin/materials/requests', '/admin/reports', '/admin/audit-logs',
    '/admin/devices', '/admin/safety-docs',
  ]
  for (const path of pages) {
    test(path, async ({ page }) => {
      await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' })
      expect(page.url()).not.toContain('/admin/login')
      await page.waitForTimeout(2000)
      const title = await page.title()
      expect(title).toBeTruthy()
    })
  }
})

// ── 근로자 페이지 ──────────────────────────────────
test.describe('근로자 페이지', () => {
  test.beforeEach(async ({ page }) => {
    const token = process.env.WORKER_JWT
    if (!token) { test.skip(true, 'WORKER_JWT 없음'); return }
    await page.context().addCookies([{ name: 'worker_token', value: token, domain: new URL(BASE).hostname, path: '/' }])
  })
  const pages = [
    '/attendance', '/my/sites', '/my/onboarding',
    '/my/material-requests', '/my/status', '/daily-report',
    '/tbm', '/work-complete',
  ]
  for (const path of pages) {
    test(path, async ({ page }) => {
      await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(3000)
      const title = await page.title()
      expect(title).toBeTruthy()
      // 500 에러 페이지 아닌지 확인
      const h1 = await page.locator('h1').first().textContent().catch(() => '')
      expect(h1 || '').not.toContain('Internal Server Error')
    })
  }
})
