/**
 * MODE=setup 전용 — 관리자 로그인 후 storageState 저장
 *
 * 실행: MODE=setup TARGET=local bash scripts/pw-run.sh
 * 저장: logs/playwright-state/admin.json
 *
 * 로컬에서만 실행 (headed). 서버는 저장된 state 재사용.
 */
import { test as setup } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'

// pw-run.sh 가 STATE_FILE 환경변수로 주입 (TARGET 분리 보장)
const STATE_FILE = process.env.STATE_FILE
  || path.join(__dirname, '..', '..', 'logs', 'playwright-state', 'admin.local.json')
const BASE = process.env.BASE_URL || 'https://attendance.haehan-ai.kr'
const EMAIL = process.env.ADMIN_EMAIL || 'jay@haehan-ai.kr'
const PASSWORD = process.env.ADMIN_PASSWORD || ''

setup('admin 로그인 → storageState 저장', async ({ page, request }) => {
  if (!PASSWORD) throw new Error('ADMIN_PASSWORD 환경변수 필요')

  // 1. API 로그인 → 쿠키 획득
  const res = await request.post(`${BASE}/api/admin/auth/login`, {
    data: { email: EMAIL, password: PASSWORD },
  })
  const setCookie = res.headers()['set-cookie'] || ''
  const match = setCookie.match(/admin_token=([^;]+)/)
  if (!match) throw new Error(`로그인 실패: HTTP ${res.status()}`)

  const token = match[1]

  // 2. 쿠키 주입 후 /admin 진입 확인
  await page.context().addCookies([{
    name: 'admin_token',
    value: token,
    domain: new URL(BASE).hostname,
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
  }])
  await page.goto(`${BASE}/admin`)
  await page.waitForTimeout(1500)
  if (page.url().includes('/login')) throw new Error('/admin 접근 실패 — 토큰 무효')

  // 3. storageState 저장
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true })
  await page.context().storageState({ path: STATE_FILE })
  console.log(`✓ storageState 저장: ${STATE_FILE}`)
})
