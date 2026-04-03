/**
 * 모바일 카드형 UI 자동 점검
 *
 * 점검 항목:
 * 1. 카드 셀렉터 존재 (rounded-2xl, bg-card 등)
 * 2. 테이블/dl/dt 잔존 여부 → FAIL
 * 3. 카드 제목/값 visible
 * 4. 버튼 클릭 가능 여부
 * 5. 가로 스크롤/overflow 여부
 * 6. 요소 겹침 여부
 * 7. 실패 시 스크린샷 저장
 *
 * 실행: npx playwright test mobile-card-ui.spec.ts --project=mobile-iphone13
 */
import { test, expect, type Page, type Locator } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'

const BASE = process.env.BASE_URL || 'https://attendance.haehan-ai.kr'
const SCREENSHOT_DIR = path.join(__dirname, '..', 'logs', 'screenshots')

// ── 공개 모바일 페이지 (인증 불필요) ──
const PUBLIC_PAGES = [
  { path: '/m/login', name: '모바일 로그인' },
  { path: '/m/register', name: '모바일 회원가입' },
  { path: '/m', name: '모바일 랜딩' },
  { path: '/m/why', name: '왜 해한인지' },
  { path: '/m/features', name: '기능 소개' },
  { path: '/m/flow', name: '도입 흐름' },
  { path: '/m/faq', name: 'FAQ' },
  { path: '/m/guide', name: '가이드' },
]

// ── 인증 필요 모바일 페이지 ──
const AUTH_PAGES = [
  { path: '/attendance', name: '출퇴근' },
  { path: '/daily-report', name: '작업일보' },
  { path: '/work-orders', name: '작업지시' },
  { path: '/work-complete', name: '작업완료' },
  { path: '/tbm', name: 'TBM' },
  { path: '/my/documents', name: '내 서류' },
  { path: '/my/sites', name: '내 현장' },
  { path: '/my/onboarding', name: '온보딩' },
  { path: '/my/material-requests', name: '자재요청' },
]

// ── 스크린샷 디렉터리 생성 ──
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })

// ── 공통 점검 함수들 ──

/**
 * 테이블/dl/dt 잔존 여부 점검
 * 모바일에서 <table>, <dl>, <dt> 가 메인 콘텐츠에 있으면 FAIL
 */
async function checkNoTableElements(page: Page, pageName: string) {
  // 메인 콘텐츠 내 테이블 요소 탐지 (nav/head 내부는 제외)
  const tableCount = await page.locator('main table, [role="main"] table, .mobile-content table').count()
    .catch(() => 0)

  // body 전체에서도 확인 (main이 없을 수 있음)
  const bodyTableCount = await page.evaluate(() => {
    const tables = document.querySelectorAll('table')
    // nav, header, footer 내부 테이블은 제외
    let count = 0
    tables.forEach(t => {
      const parent = t.closest('nav, header, footer, script, style')
      if (!parent) count++
    })
    return count
  })

  const dlCount = await page.evaluate(() => {
    const dls = document.querySelectorAll('dl, dt, dd')
    let count = 0
    dls.forEach(el => {
      const parent = el.closest('nav, header, footer, script, style')
      if (!parent) count++
    })
    return count
  })

  return {
    table: bodyTableCount,
    dl: dlCount,
    pass: bodyTableCount === 0 && dlCount === 0,
  }
}

/**
 * 카드 셀렉터 존재 확인
 */
async function checkCardSelectors(page: Page) {
  const cardCount = await page.evaluate(() => {
    const selectors = [
      '[class*="rounded-2xl"]',
      '[class*="bg-card"]',
      '[class*="shadow-sm"]',
      '[class*="rounded-xl"]',
    ]
    const found = new Set<Element>()
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => found.add(el))
    })
    return found.size
  })
  return { count: cardCount, pass: cardCount > 0 }
}

/**
 * 가로 스크롤/overflow 점검
 */
async function checkNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const viewportWidth = window.innerWidth
    const bodyScrollWidth = document.body.scrollWidth
    const overflowingElements: string[] = []

    document.querySelectorAll('*').forEach(el => {
      const rect = el.getBoundingClientRect()
      if (rect.right > viewportWidth + 2) {
        const tag = el.tagName.toLowerCase()
        const cls = el.className?.toString()?.slice(0, 60) || ''
        overflowingElements.push(`${tag}.${cls}`)
      }
    })

    return {
      bodyOverflows: bodyScrollWidth > viewportWidth + 2,
      viewportWidth,
      bodyScrollWidth,
      overflowingElements: overflowingElements.slice(0, 5),
    }
  })

  return {
    ...overflow,
    pass: !overflow.bodyOverflows,
  }
}

/**
 * 요소 겹침 점검 — 주요 인터랙티브 요소끼리 겹치는지 확인
 */
async function checkNoElementOverlap(page: Page) {
  const overlaps = await page.evaluate(() => {
    const interactives = Array.from(
      document.querySelectorAll('button, a, input, select, textarea, [role="button"]')
    ).filter(el => {
      const style = window.getComputedStyle(el)
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0'
    })

    const overlapping: string[] = []

    for (let i = 0; i < interactives.length && i < 50; i++) {
      const r1 = interactives[i].getBoundingClientRect()
      if (r1.width === 0 || r1.height === 0) continue

      for (let j = i + 1; j < interactives.length && j < 50; j++) {
        const r2 = interactives[j].getBoundingClientRect()
        if (r2.width === 0 || r2.height === 0) continue

        // 겹침 면적 계산
        const overlapX = Math.max(0, Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left))
        const overlapY = Math.max(0, Math.min(r1.bottom, r2.bottom) - Math.max(r1.top, r2.top))
        const overlapArea = overlapX * overlapY
        const minArea = Math.min(r1.width * r1.height, r2.width * r2.height)

        // 겹침이 작은 쪽 면적의 30% 이상이면 문제
        if (minArea > 0 && overlapArea / minArea > 0.3) {
          const tag1 = interactives[i].tagName.toLowerCase()
          const tag2 = interactives[j].tagName.toLowerCase()
          const text1 = (interactives[i] as HTMLElement).innerText?.slice(0, 20) || ''
          const text2 = (interactives[j] as HTMLElement).innerText?.slice(0, 20) || ''
          overlapping.push(`${tag1}("${text1}") ↔ ${tag2}("${text2}")`)
        }
      }
    }

    return overlapping.slice(0, 5)
  })

  return {
    overlaps,
    pass: overlaps.length === 0,
  }
}

/**
 * 버튼 클릭 가능 여부 점검
 */
async function checkButtonsClickable(page: Page) {
  const result = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button, a[role="button"], [role="button"]'))
      .filter(el => {
        const style = window.getComputedStyle(el)
        return style.display !== 'none' && style.visibility !== 'hidden'
      })

    let clickable = 0
    let blocked = 0
    const blockedList: string[] = []

    buttons.forEach(btn => {
      const rect = btn.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return

      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      const topEl = document.elementFromPoint(centerX, centerY)

      if (topEl && (btn === topEl || btn.contains(topEl) || topEl.contains(btn))) {
        clickable++
      } else {
        blocked++
        const text = (btn as HTMLElement).innerText?.slice(0, 20) || btn.tagName
        blockedList.push(text)
      }
    })

    return { total: buttons.length, clickable, blocked, blockedList: blockedList.slice(0, 5) }
  })

  return {
    ...result,
    pass: result.blocked === 0,
  }
}

/**
 * 카드 제목/값 visible 점검
 */
async function checkCardContentVisible(page: Page) {
  const result = await page.evaluate(() => {
    const cards = document.querySelectorAll(
      '[class*="rounded-2xl"], [class*="bg-card"], [class*="shadow-sm"][class*="rounded"]'
    )
    let totalCards = 0
    let visibleCards = 0
    let emptyCards = 0

    cards.forEach(card => {
      const style = window.getComputedStyle(card)
      if (style.display === 'none' || style.visibility === 'hidden') return
      totalCards++

      const text = (card as HTMLElement).innerText?.trim()
      if (text && text.length > 0) {
        visibleCards++
      } else {
        emptyCards++
      }
    })

    return { totalCards, visibleCards, emptyCards }
  })

  return {
    ...result,
    pass: result.emptyCards === 0 || result.totalCards === 0,
  }
}

// ── 스크린샷 저장 헬퍼 ──
async function saveScreenshot(page: Page, name: string) {
  const sanitized = name.replace(/[/\\:*?"<>|]/g, '_')
  const filePath = path.join(SCREENSHOT_DIR, `${sanitized}.png`)
  await page.screenshot({ path: filePath, fullPage: true })
  return filePath
}

// ── baseline 비교용 스크린샷 ──
async function compareBaseline(page: Page, name: string) {
  const sanitized = name.replace(/[/\\:*?"<>|]/g, '_')
  const baselineDir = path.join(SCREENSHOT_DIR, 'baseline')
  const currentDir = path.join(SCREENSHOT_DIR, 'current')
  fs.mkdirSync(baselineDir, { recursive: true })
  fs.mkdirSync(currentDir, { recursive: true })

  const baselinePath = path.join(baselineDir, `${sanitized}.png`)
  const currentPath = path.join(currentDir, `${sanitized}.png`)

  await page.screenshot({ path: currentPath, fullPage: true })

  if (!fs.existsSync(baselinePath)) {
    // baseline 없으면 현재를 baseline으로 저장
    fs.copyFileSync(currentPath, baselinePath)
    return { hasBaseline: false, match: true }
  }

  // 파일 크기 비교 (간이 비교 — 정밀 비교는 pixelmatch 필요)
  const baselineStat = fs.statSync(baselinePath)
  const currentStat = fs.statSync(currentPath)
  const sizeDiff = Math.abs(baselineStat.size - currentStat.size)
  const threshold = baselineStat.size * 0.15 // 15% 크기 차이 허용

  return {
    hasBaseline: true,
    match: sizeDiff <= threshold,
    baselineSize: baselineStat.size,
    currentSize: currentStat.size,
    diffPercent: ((sizeDiff / baselineStat.size) * 100).toFixed(1),
  }
}

// ══════════════════════════════════════════════════════════════
// 공개 모바일 페이지 점검
// ══════════════════════════════════════════════════════════════

test.describe('공개 모바일 페이지 — 카드형 UI 점검', () => {
  for (const pg of PUBLIC_PAGES) {
    test.describe(pg.name, () => {
      test.beforeEach(async ({ page }) => {
        await page.goto(`${BASE}${pg.path}`)
        await page.waitForLoadState('networkidle')
      })

      test('테이블/dl/dt 잔존 없음', async ({ page }) => {
        const result = await checkNoTableElements(page, pg.name)
        if (!result.pass) {
          await saveScreenshot(page, `FAIL_table_${pg.name}`)
        }
        expect(result.table, `${pg.name}: table ${result.table}개 발견`).toBe(0)
        expect(result.dl, `${pg.name}: dl/dt/dd ${result.dl}개 발견`).toBe(0)
      })

      test('가로 스크롤 없음', async ({ page }) => {
        const result = await checkNoHorizontalOverflow(page)
        if (!result.pass) {
          await saveScreenshot(page, `FAIL_overflow_${pg.name}`)
        }
        expect(
          result.pass,
          `${pg.name}: 가로 overflow (viewport=${result.viewportWidth}, body=${result.bodyScrollWidth})`
        ).toBe(true)
      })

      test('요소 겹침 없음', async ({ page }) => {
        const result = await checkNoElementOverlap(page)
        if (!result.pass) {
          await saveScreenshot(page, `FAIL_overlap_${pg.name}`)
        }
        expect(result.overlaps, `${pg.name}: 겹침 ${result.overlaps.join(', ')}`).toHaveLength(0)
      })

      test('버튼 클릭 가능', async ({ page }) => {
        const result = await checkButtonsClickable(page)
        if (!result.pass) {
          await saveScreenshot(page, `FAIL_buttons_${pg.name}`)
        }
        expect(result.blocked, `${pg.name}: 차단된 버튼 ${result.blockedList.join(', ')}`).toBe(0)
      })

      test('스크린샷 baseline 비교', async ({ page }) => {
        const result = await compareBaseline(page, `public_${pg.name}`)
        if (result.hasBaseline && !result.match) {
          await saveScreenshot(page, `FAIL_baseline_${pg.name}`)
        }
        if (result.hasBaseline) {
          expect(result.match, `${pg.name}: baseline 차이 ${result.diffPercent}%`).toBe(true)
        }
      })
    })
  }
})

// ══════════════════════════════════════════════════════════════
// 인증 필요 모바일 페이지 점검
// ══════════════════════════════════════════════════════════════

test.describe('인증 모바일 페이지 — 카드형 UI 점검', () => {
  // worker JWT가 없으면 인증 페이지는 NOT TESTED
  const WORKER_JWT = process.env.WORKER_JWT

  test.beforeEach(async ({ page }) => {
    if (!WORKER_JWT) {
      test.skip(true, 'WORKER_JWT 미설정 — 인증 페이지 점검 건너뜀')
      return
    }
    await page.context().addCookies([{
      name: 'worker_token',
      value: WORKER_JWT,
      domain: new URL(BASE).hostname,
      path: '/',
    }])
  })

  for (const pg of AUTH_PAGES) {
    test.describe(pg.name, () => {
      test.beforeEach(async ({ page }) => {
        await page.goto(`${BASE}${pg.path}`)
        await page.waitForLoadState('networkidle')
        // 로그인 리다이렉트 확인
        if (page.url().includes('/login')) {
          test.skip(true, `${pg.name}: 세션 만료로 로그인 리다이렉트`)
        }
      })

      test('카드 셀렉터 존재', async ({ page }) => {
        const result = await checkCardSelectors(page)
        if (!result.pass) {
          await saveScreenshot(page, `FAIL_nocard_${pg.name}`)
        }
        expect(result.count, `${pg.name}: 카드 요소 0개`).toBeGreaterThan(0)
      })

      test('테이블/dl/dt 잔존 없음', async ({ page }) => {
        const result = await checkNoTableElements(page, pg.name)
        if (!result.pass) {
          await saveScreenshot(page, `FAIL_table_${pg.name}`)
        }
        expect(result.table, `${pg.name}: table ${result.table}개 발견`).toBe(0)
        expect(result.dl, `${pg.name}: dl/dt/dd ${result.dl}개 발견`).toBe(0)
      })

      test('카드 콘텐츠 visible', async ({ page }) => {
        const result = await checkCardContentVisible(page)
        if (!result.pass) {
          await saveScreenshot(page, `FAIL_empty_card_${pg.name}`)
        }
        expect(result.emptyCards, `${pg.name}: 빈 카드 ${result.emptyCards}개`).toBe(0)
      })

      test('가로 스크롤 없음', async ({ page }) => {
        const result = await checkNoHorizontalOverflow(page)
        if (!result.pass) {
          await saveScreenshot(page, `FAIL_overflow_${pg.name}`)
        }
        expect(result.pass, `${pg.name}: 가로 overflow`).toBe(true)
      })

      test('요소 겹침 없음', async ({ page }) => {
        const result = await checkNoElementOverlap(page)
        if (!result.pass) {
          await saveScreenshot(page, `FAIL_overlap_${pg.name}`)
        }
        expect(result.overlaps).toHaveLength(0)
      })

      test('버튼 클릭 가능', async ({ page }) => {
        const result = await checkButtonsClickable(page)
        if (!result.pass) {
          await saveScreenshot(page, `FAIL_buttons_${pg.name}`)
        }
        expect(result.blocked, `${pg.name}: 차단된 버튼`).toBe(0)
      })

      test('스크린샷 baseline 비교', async ({ page }) => {
        const result = await compareBaseline(page, `auth_${pg.name}`)
        if (result.hasBaseline && !result.match) {
          await saveScreenshot(page, `FAIL_baseline_${pg.name}`)
        }
        if (result.hasBaseline) {
          expect(result.match, `${pg.name}: baseline 차이 ${result.diffPercent}%`).toBe(true)
        }
      })
    })
  }
})
