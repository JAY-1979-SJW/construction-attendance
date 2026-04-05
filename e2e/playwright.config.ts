import { defineConfig, devices } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'

const TARGET = process.env.TARGET || 'server'
const MODE   = process.env.MODE   || 'check'

const BASE_URL   = process.env.BASE_URL || 'https://attendance.haehan-ai.kr'
// TARGET 별 state 분리 — local/server 공용 금지
// pw-run.sh 가 STATE_FILE 환경변수로 주입; 직접 실행 시 TARGET 기반 기본값 사용
const STATE_FILE = process.env.STATE_FILE
  || path.join(__dirname, '..', 'logs', 'playwright-state', `admin.${TARGET}.json`)
const stateFile  = fs.existsSync(STATE_FILE) ? STATE_FILE : undefined

// 로컬 + setup/apply 모드만 headed
const HEADLESS = !(TARGET === 'local' && (MODE === 'setup' || MODE === 'apply'))

export default defineConfig({
  testDir: '.',
  timeout: 30000,
  use: {
    baseURL: BASE_URL,
    headless: HEADLESS,
    screenshot: 'only-on-failure',
  },

  projects: [
    // ── setup: 로그인 → storageState 저장 ─────────────────
    {
      name: 'auth-setup',
      testMatch: 'auth/admin.setup.ts',
      use: {
        browserName: 'chromium',
        headless: false,
        storageState: undefined,
      },
    },

    // ── chromium: 기본 E2E (storageState 있으면 재사용) ────
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        storageState: stateFile,
      },
    },

    // ── admin-actions ──────────────────────────────────────
    {
      name: 'admin-actions',
      use: { browserName: 'chromium', storageState: stateFile },
      testMatch: 'admin-page-actions.spec.ts',
      timeout: 45000,
    },

    // ── 모바일 ────────────────────────────────────────────
    {
      name: 'mobile-iphone13',
      use: { ...devices['iPhone 13'], screenshot: 'on', storageState: stateFile },
      testMatch: 'mobile-card-ui.spec.ts',
    },
    {
      name: 'mobile-galaxy-s21',
      use: { ...devices['Galaxy S9+'], screenshot: 'on', storageState: stateFile },
      testMatch: 'mobile-card-ui.spec.ts',
    },

    // ── 레이아웃 (storageState 불필요) ────────────────────
    {
      name: 'mobile-contract-layout',
      use: { browserName: 'chromium', screenshot: 'on' },
      testMatch: 'mobile-contract-form-layout.spec.ts',
    },
    {
      name: 'ui-layout-core',
      use: { browserName: 'chromium', screenshot: 'on' },
      testMatch: 'ui-layout-core.spec.ts',
    },

    // ── worker / admin 관리 ───────────────────────────────
    {
      name: 'worker-home-ui',
      use: { browserName: 'chromium', screenshot: 'only-on-failure', storageState: stateFile },
      testMatch: 'worker-home-ui.spec.ts',
    },
    {
      name: 'admin-worker-management',
      use: { browserName: 'chromium', screenshot: 'only-on-failure', storageState: stateFile },
      testMatch: 'admin-worker-management.spec.ts',
      timeout: 45000,
    },
  ],
})
