import { test, expect } from '@playwright/test'

test('catalog tree view renders without error', async ({ page, request }) => {
  const loginRes = await request.post('https://attendance.haehan-ai.kr/api/admin/auth/login', {
    data: { email: 'jay@haehan-ai.kr', password: 'Haehan2026!' },
  })
  // token is set as HttpOnly cookie — extract from Set-Cookie header
  const setCookie = loginRes.headers()['set-cookie'] ?? ''
  const tokenMatch = setCookie.match(/admin_token=([^;]+)/)
  const token = tokenMatch ? tokenMatch[1] : ''
  await page.context().addCookies([
    { name: 'admin_token', value: token, domain: 'attendance.haehan-ai.kr', path: '/' }
  ])

  await page.goto('https://attendance.haehan-ai.kr/admin/materials/catalog', { waitUntil: 'networkidle', timeout: 30000 })

  const url = page.url()
  const bodyText = await page.locator('body').innerText()
  const hasError = bodyText.includes('오류가 발생') || bodyText.includes('문제가 발생')

  console.log('URL:', url)
  console.log('has_error:', hasError)

  const asideCount = await page.locator('aside').count()
  // Get all aside texts
  const asideTexts: string[] = []
  for (let i = 0; i < asideCount; i++) {
    asideTexts.push(await page.locator('aside').nth(i).innerText().catch(() => ''))
  }
  const allAsideText = asideTexts.join('\n')

  console.log('aside_count:', asideCount)
  for (let i = 0; i < asideTexts.length; i++) {
    console.log(`aside[${i}] len=${asideTexts[i].length} preview:`, asideTexts[i].slice(0, 80).replace(/\n/g, '|'))
  }
  console.log('any_aside_has_분류:', allAsideText.includes('분류'))
  console.log('any_aside_has_전체:', allAsideText.includes('전체'))

  await page.screenshot({ path: 'logs/catalog-tree-verify.png', fullPage: false })

  expect(hasError).toBe(false)
  expect(asideCount).toBeGreaterThan(1)
  expect(allAsideText).toContain('분류')
  expect(allAsideText).toContain('전체')
})
