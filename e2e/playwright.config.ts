import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  timeout: 30000,
  use: {
    baseURL: process.env.BASE_URL || 'https://attendance.haehan-ai.kr',
    headless: true,
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    {
      name: 'admin-actions',
      use: { browserName: 'chromium' },
      testMatch: 'admin-page-actions.spec.ts',
      timeout: 45000,
    },
    {
      name: 'mobile-iphone13',
      use: {
        ...devices['iPhone 13'],
        screenshot: 'on',
      },
      testMatch: 'mobile-card-ui.spec.ts',
    },
    {
      name: 'mobile-galaxy-s21',
      use: {
        ...devices['Galaxy S9+'],
        screenshot: 'on',
      },
      testMatch: 'mobile-card-ui.spec.ts',
    },
  ],
})
