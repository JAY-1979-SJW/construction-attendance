import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const BASE = 'https://attendance.haehan-ai.kr'
const TOKEN_FILE = path.join(__dirname, '..', 'logs', '.admin-token.txt')

test('diag - new page console errors', async ({ page }) => {
  const errors: string[] = []
  const consoleMessages: string[] = []
  
  page.on('console', msg => consoleMessages.push(`[${msg.type()}] ${msg.text()}`))
  page.on('pageerror', err => errors.push(err.message))
  
  // inject token
  if (fs.existsSync(TOKEN_FILE)) {
    const token = fs.readFileSync(TOKEN_FILE, 'utf-8').trim()
    await page.context().addCookies([{
      name: 'admin_token', value: token,
      domain: 'attendance.haehan-ai.kr', path: '/',
      httpOnly: true, secure: true, sameSite: 'Lax' as const,
    }])
  }
  
  await page.goto(`${BASE}/admin/materials/requests/new`)
  await page.waitForTimeout(3000)
  
  console.log('=== URL:', page.url())
  console.log('=== Title:', await page.title())
  console.log('=== Page Errors:', errors)
  console.log('=== Console:', consoleMessages.filter(m => !m.includes('Download')))
  
  const bodyText = await page.locator('body').innerText().catch(() => 'n/a')
  console.log('=== Body text snippet:', bodyText.substring(0, 500))
})
