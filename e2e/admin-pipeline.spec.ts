import { test, expect } from '@playwright/test'
const BASE = process.env.BASE_URL || 'https://attendance.haehan-ai.kr'
const DOMAIN = new URL(BASE).hostname

const PAGES = [
  { path: '/admin', name: '대시보드' },
  { path: '/admin/sites', name: '현장 관리' },
  { path: '/admin/workers/new', name: '근로자 등록' },
  { path: '/admin/approvals', name: '승인 관리' },
  { path: '/admin/document-packages', name: '서류 검토' },
  { path: '/admin/attendance', name: '출퇴근 관리' },
  { path: '/admin/work-confirmations', name: '공수 관리' },
  { path: '/admin/wage', name: '노임 관리' },
  { path: '/admin/insurance-eligibility', name: '보험 판정' },
  { path: '/admin/settings', name: '운영 설정' },
  { path: '/admin/materials/requests', name: '자재청구' },
  { path: '/admin/contracts', name: '근로계약서' },
  { path: '/admin/safety-docs', name: '안전서류' },
  { path: '/admin/companies', name: '회사 관리' },
]

test.describe('관리자 파이프라인', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().addCookies([{ name: 'admin_token', value: process.env.ADMIN_JWT!, domain: DOMAIN, path: '/' }])
  })
  for (const pg of PAGES) {
    test(`${pg.name} (${pg.path})`, async ({ page }) => {
      await page.goto(`${BASE}${pg.path}`, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(3000)
      expect(page.url()).not.toContain('/admin/login')
      const idx = PAGES.indexOf(pg)
      await page.screenshot({ path: `e2e/screenshots/${String(idx+1).padStart(2,'0')}-${pg.path.replace(/\//g,'_')}.png`, fullPage: true })
    })
  }
})
