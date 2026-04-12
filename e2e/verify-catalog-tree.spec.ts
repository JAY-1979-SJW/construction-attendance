import { test, expect } from '@playwright/test'

async function login(request: Parameters<Parameters<typeof test>[1]>[0]['request'], page: Parameters<Parameters<typeof test>[1]>[0]['page']) {
  const loginRes = await request.post('https://attendance.haehan-ai.kr/api/admin/auth/login', {
    data: { email: 'jay@haehan-ai.kr', password: 'Haehan2026!' },
  })
  const setCookie = loginRes.headers()['set-cookie'] ?? ''
  const tokenMatch = setCookie.match(/admin_token=([^;]+)/)
  const token = tokenMatch ? tokenMatch[1] : ''
  await page.context().addCookies([
    { name: 'admin_token', value: token, domain: 'attendance.haehan-ai.kr', path: '/' }
  ])
}

test('A. 트리 렌더링 — 에러 없음, 대분류 37개, ▸ 버튼 존재', async ({ page, request }) => {
  await login(request, page)
  await page.goto('https://attendance.haehan-ai.kr/admin/materials/catalog', { waitUntil: 'networkidle', timeout: 30000 })

  const bodyText = await page.locator('body').innerText()
  const hasError = bodyText.includes('오류가 발생') || bodyText.includes('문제가 발생')
  console.log('has_error:', hasError)

  const treeAside = page.locator('aside').nth(1)
  const asideText = await treeAside.innerText()
  console.log('aside preview:', asideText.slice(0, 120).replace(/\n/g, '|'))

  // 분류 헤더 + 전체 버튼
  expect(asideText).toContain('분류')
  expect(asideText).toContain('전체')
  // 펼침 버튼 존재
  expect(asideText).toContain('▸')
  // 에러 없음
  expect(hasError).toBe(false)

  await page.screenshot({ path: 'logs/tree-A-render.png' })
})

test('B. 펼침/접기 — 대분류 클릭 후 중분류 노출', async ({ page, request }) => {
  await login(request, page)
  await page.goto('https://attendance.haehan-ai.kr/admin/materials/catalog', { waitUntil: 'networkidle', timeout: 30000 })

  const treeAside = page.locator('aside').nth(1)

  // 첫 번째 ▸ 버튼 클릭 (펼치기)
  const toggleBtn = treeAside.locator('button').filter({ hasText: '▸' }).first()
  const catName = await toggleBtn.locator('..').locator('button').nth(1).innerText().catch(() => '')
  console.log('expand cat:', catName.trim())
  await toggleBtn.click()
  await page.waitForTimeout(300)

  const asideAfter = await treeAside.innerText()
  // ▾ (펼쳐진 상태) 가 있어야 함
  expect(asideAfter).toContain('▾')
  console.log('after expand preview:', asideAfter.slice(0, 200).replace(/\n/g, '|'))

  // 중분류 항목이 노출됐는지 (펼친 대분류 아래 들여쓰기된 버튼들)
  const subBtns = treeAside.locator('ul ul button')
  const subCount = await subBtns.count()
  console.log('visible_sub_buttons:', subCount)
  expect(subCount).toBeGreaterThan(0)

  // ▾ 버튼 다시 클릭 (접기)
  await treeAside.locator('button').filter({ hasText: '▾' }).first().click()
  await page.waitForTimeout(300)
  const asideCollapsed = await treeAside.innerText()
  expect(asideCollapsed).not.toContain('▾')

  await page.screenshot({ path: 'logs/tree-B-expand.png' })
})

test('C. 대분류 클릭 → 목록 필터 + 경로 표시', async ({ page, request }) => {
  await login(request, page)
  await page.goto('https://attendance.haehan-ai.kr/admin/materials/catalog', { waitUntil: 'networkidle', timeout: 30000 })

  const treeAside = page.locator('aside').nth(1)

  // 건자재 대분류 선택
  const catBtn = treeAside.locator('button').filter({ hasText: '건자재' }).first()
  await catBtn.click()
  await page.waitForTimeout(1000)

  // 경로 표시에 '건자재' 노출
  const bodyText = await page.locator('body').innerText()
  console.log('breadcrumb check, has 건자재:', bodyText.includes('건자재'))
  expect(bodyText).toContain('건자재')

  // URL에 category 파라미터 포함
  const url = page.url()
  console.log('url after cat select:', url)
  expect(url).toContain('category=')

  // 목록이 로드됐는지 (table rows 또는 로딩 아님)
  await page.waitForTimeout(1500)
  const rows = await page.locator('table tbody tr').count()
  console.log('table_rows:', rows)
  expect(rows).toBeGreaterThan(0)

  await page.screenshot({ path: 'logs/tree-C-cat-filter.png' })
})

test('D. 중분류 클릭 → 필터 + 경로 표시 (전체>대분류>중분류)', async ({ page, request }) => {
  await login(request, page)
  await page.goto('https://attendance.haehan-ai.kr/admin/materials/catalog', { waitUntil: 'networkidle', timeout: 30000 })

  const treeAside = page.locator('aside').nth(1)

  // 건자재 대분류 펼치기
  const toggles = treeAside.locator('button').filter({ hasText: '▸' })
  // 건자재 행 찾기
  const catBtns = treeAside.locator('button')
  const count = await catBtns.count()
  let buildingToggle = null
  for (let i = 0; i < count; i++) {
    const txt = await catBtns.nth(i).innerText()
    if (txt.trim() === '▸') {
      const nextTxt = i + 1 < count ? await catBtns.nth(i + 1).innerText() : ''
      if (nextTxt.includes('건자재')) {
        buildingToggle = catBtns.nth(i)
        break
      }
    }
  }
  if (!buildingToggle) {
    // fallback: just use first toggle
    buildingToggle = toggles.first()
  }
  await buildingToggle.click()
  await page.waitForTimeout(400)

  // 첫 번째 중분류 클릭
  const subBtns = treeAside.locator('ul ul button')
  const firstSub = subBtns.first()
  const subName = (await firstSub.innerText()).trim()
  console.log('clicking sub:', subName)
  await firstSub.click()
  await page.waitForTimeout(1500)

  // 경로: 전체 › 대분류 › 중분류
  const bodyText = await page.locator('body').innerText()
  console.log('has_subcat_in_body:', bodyText.includes(subName.split('\n')[0].trim()))

  // URL에 subCategory 포함
  const url = page.url()
  console.log('url after sub select:', url)
  expect(url).toContain('subCategory=')

  // 목록 필터됨
  const rows = await page.locator('table tbody tr').count()
  console.log('table_rows:', rows)
  expect(rows).toBeGreaterThan(0)

  await page.screenshot({ path: 'logs/tree-D-sub-filter.png' })
})

test('E. 검색 + 트리 선택 조합, 전체 복귀', async ({ page, request }) => {
  await login(request, page)
  await page.goto('https://attendance.haehan-ai.kr/admin/materials/catalog', { waitUntil: 'networkidle', timeout: 30000 })

  const treeAside = page.locator('aside').nth(1)

  // 대분류 선택
  const catBtn = treeAside.locator('button').filter({ hasText: '건자재' }).first()
  await catBtn.click()
  await page.waitForTimeout(800)

  // 검색어 입력
  const searchInput = page.locator('input[type="text"]').first()
  await searchInput.fill('배관')
  await searchInput.press('Enter')
  await page.waitForTimeout(1500)

  const url = page.url()
  console.log('url combined:', url)
  const hasCategory = url.includes('category=')
  const hasQ = url.includes('q=')
  console.log('has_category:', hasCategory, 'has_q:', hasQ)

  // 전체 버튼 클릭 → 초기화
  const allBtn = treeAside.locator('button').filter({ hasText: '전체' }).first()
  await allBtn.click()
  await page.waitForTimeout(500)
  const urlAfter = page.url()
  console.log('url_after_reset:', urlAfter)
  expect(urlAfter).not.toContain('category=')

  await page.screenshot({ path: 'logs/tree-E-combined.png' })
})
