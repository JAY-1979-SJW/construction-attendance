/**
 * 전체 페이지 전수 조사 — 역할별 접근 검증
 *
 * 실행: node scripts/e2e_page_audit.js
 * Worker 포함: WORKER_JWT=xxx node scripts/e2e_page_audit.js
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'https://attendance.haehan-ai.kr';
const PASSWORD = 'test1234';

const ACCOUNTS = {
  SUPER_ADMIN:         { email: 'jay@haehan-ai.kr',      password: PASSWORD },
  ADMIN:               { email: 'testadmin@test.com',     password: PASSWORD },
  VIEWER:              { email: 'viewer@test.com',        password: PASSWORD },
  COMPANY_ADMIN:       { email: 'company1@test.com',      password: PASSWORD },
  SITE_ADMIN:          { email: 'siteadmin@test.com',     password: PASSWORD },
  EXTERNAL_SITE_ADMIN: { email: 'extsiteadmin@test.com',  password: PASSWORD },
};

// ─── 페이지 목록 ─────────────────────────────────────────
const PUBLIC_PAGES = [
  '/', '/login', '/admin/login', '/register', '/register/company-admin',
  '/register/complete', '/register/pending', '/guide',
  '/device/register', '/device/change', '/company-pending-verification',
];

const ADMIN_PAGES = [
  '/admin', '/admin/sites', '/admin/site-locations', '/admin/site-admin-assignments',
  '/admin/site-access-groups', '/admin/site-join-requests', '/admin/site-imports',
  '/admin/companies', '/admin/company-admins', '/admin/company-admin-requests',
  '/admin/workers', '/admin/workers/new', '/admin/registrations', '/admin/corrections',
  '/admin/contracts', '/admin/contracts/new',
  '/admin/attendance', '/admin/exceptions', '/admin/presence-checks', '/admin/presence-report',
  '/admin/device-requests', '/admin/devices', '/admin/devices-anomaly',
  '/admin/document-center', '/admin/document-packages',
  '/admin/materials', '/admin/materials/inventory', '/admin/materials/requests',
  '/admin/materials/purchase-orders',
  '/admin/wage', '/admin/wage-calculations', '/admin/labor', '/admin/labor-cost-summaries',
  '/admin/month-closings', '/admin/retirement-mutual', '/admin/work-confirmations',
  '/admin/insurance-eligibility', '/admin/insurance-rates', '/admin/insurance-rates/calculate',
  '/admin/insurance-rates/sources', '/admin/subcontractor-settlements',
  '/admin/approvals', '/admin/audit-logs', '/admin/settings', '/admin/policies',
  '/admin/super-users', '/admin/safety-docs', '/admin/pilot',
  '/admin/operations/attendance-exceptions', '/admin/operations/labor-review',
  '/admin/operations/print-center', '/admin/operations/today-tasks',
];

const COMPANY_PAGES = [
  '/company', '/company/profile', '/company/workers', '/company/attendance',
  '/company/devices', '/company/documents', '/company/insurance',
  '/company/payroll', '/company/managers', '/company/notices',
  '/company/approvals', '/company/worklogs',
];

const LABOR_PAGES = [
  '/labor', '/labor/sites', '/labor/documents', '/labor/reports',
  '/labor/insurance', '/labor/wages', '/labor/settings',
];

const OPS_PAGES = [
  '/ops', '/ops/sites', '/ops/workers', '/ops/worklogs',
  '/ops/attendance', '/ops/notices',
];

const WORKER_PAGES = [
  '/attendance', '/my/sites', '/my/onboarding', '/my/documents',
  '/my/status', '/my/requests', '/daily-report', '/wage',
];

// ─── 헬퍼 ──────────────────────────────────────────────
async function loginAdmin(context, email, password) {
  const resp = await context.request.post(`${BASE}/api/admin/auth/login`, {
    data: { email, password },
  });
  if (!resp.ok()) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(`${resp.status()} ${JSON.stringify(body)}`);
  }
  // 쿠키 자동 설정됨
  return true;
}

async function testPage(page, fullUrl, timeout = 25000) {
  const start = Date.now();
  try {
    const resp = await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    const status = resp?.status() || 0;
    const finalUrl = page.url();
    const elapsed = Date.now() - start;
    const bodyText = await page.locator('body').textContent({ timeout: 3000 }).catch(() => '');

    let result = 'PASS';
    let note = '';

    if (status >= 500 || bodyText.includes('Internal Server Error') || bodyText.includes('Application error')) {
      result = 'ERROR';
      note = `HTTP ${status}`;
    } else if (bodyText.includes('찾을 수 없') || (status === 404)) {
      result = '404';
    } else if (finalUrl.includes('/login') && !fullUrl.includes('/login') && !fullUrl.includes('/register')) {
      result = 'REDIRECT';
      note = new URL(finalUrl).pathname;
    } else if (finalUrl.includes('/admin') && fullUrl.includes('/company') && !fullUrl.includes('/admin')) {
      result = 'REDIRECT';
      note = new URL(finalUrl).pathname;
    } else if (status >= 400) {
      result = 'FAIL';
      note = `HTTP ${status}`;
    }

    return { result, status, elapsed, note };
  } catch (err) {
    return { result: 'TIMEOUT', status: 0, elapsed: Date.now() - start, note: err.message.slice(0, 60) };
  }
}

// ─── 메인 ──────────────────────────────────────────────
async function main() {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  const startTime = new Date();

  console.log('='.repeat(90));
  console.log('  전수 조사 시작:', startTime.toISOString());
  console.log('  대상:', BASE);
  console.log('='.repeat(90));

  // 1. 공개 페이지
  console.log('\n[PUBLIC] 공개 페이지');
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    for (const p of PUBLIC_PAGES) {
      const r = await testPage(page, `${BASE}${p}`);
      results.push({ role: 'PUBLIC', path: p, ...r });
      const icon = r.result === 'PASS' ? 'O' : r.result === 'REDIRECT' ? '>' : 'X';
      console.log(`  [${icon}] ${r.result.padEnd(8)} ${p.padEnd(45)} ${r.note} (${r.elapsed}ms)`);
    }
    await ctx.close();
  }

  // 2. 관리자 역할별
  const ALL_ADMIN_PAGES = [
    ...ADMIN_PAGES.map(p => ({ path: p, portal: 'admin' })),
    ...COMPANY_PAGES.map(p => ({ path: p, portal: 'company' })),
    ...LABOR_PAGES.map(p => ({ path: p, portal: 'labor' })),
    ...OPS_PAGES.map(p => ({ path: p, portal: 'ops' })),
  ];

  for (const role of Object.keys(ACCOUNTS)) {
    const acc = ACCOUNTS[role];
    console.log(`\n[${role}] ${acc.email}`);

    const ctx = await browser.newContext();
    try {
      await loginAdmin(ctx, acc.email, acc.password);
      console.log('  로그인 성공');
    } catch (err) {
      console.log(`  로그인 실패: ${err.message}`);
      for (const pg of ALL_ADMIN_PAGES) {
        results.push({ role, path: pg.path, portal: pg.portal, result: 'SKIP', status: 0, elapsed: 0, note: 'login failed' });
      }
      await ctx.close();
      continue;
    }

    const page = await ctx.newPage();
    for (const pg of ALL_ADMIN_PAGES) {
      const r = await testPage(page, `${BASE}${pg.path}`);
      results.push({ role, path: pg.path, portal: pg.portal, ...r });
      const icon = r.result === 'PASS' ? 'O' : r.result === 'REDIRECT' ? '>' : 'X';
      console.log(`  [${icon}] ${r.result.padEnd(8)} ${pg.path.padEnd(50)} ${r.note} (${r.elapsed}ms)`);
    }
    await ctx.close();
  }

  // 3. Worker
  console.log('\n[WORKER]');
  const workerJwt = process.env.WORKER_JWT;
  if (workerJwt) {
    const ctx = await browser.newContext();
    await ctx.addCookies([{
      name: 'worker_token', value: workerJwt,
      domain: new URL(BASE).hostname, path: '/',
    }]);
    const page = await ctx.newPage();
    for (const p of WORKER_PAGES) {
      const r = await testPage(page, `${BASE}${p}`);
      results.push({ role: 'WORKER', path: p, portal: 'worker', ...r });
      const icon = r.result === 'PASS' ? 'O' : r.result === 'REDIRECT' ? '>' : 'X';
      console.log(`  [${icon}] ${r.result.padEnd(8)} ${p.padEnd(45)} ${r.note} (${r.elapsed}ms)`);
    }
    await ctx.close();
  } else {
    console.log('  WORKER_JWT 없음 — 서버에서 JWT 직접 생성 시도');
    // 서버에서 worker JWT 생성
    try {
      const resp = await fetch(`${BASE}/api/e2e/worker-token`, { method: 'POST' }).catch(() => null);
      if (!resp) {
        console.log('  SKIP: Worker JWT 생성 불가');
        for (const p of WORKER_PAGES) {
          results.push({ role: 'WORKER', path: p, portal: 'worker', result: 'SKIP', status: 0, elapsed: 0, note: 'no JWT' });
        }
      }
    } catch {
      for (const p of WORKER_PAGES) {
        results.push({ role: 'WORKER', path: p, portal: 'worker', result: 'SKIP', status: 0, elapsed: 0, note: 'no JWT' });
      }
    }
  }

  await browser.close();

  // ─── 결과 보고 ───
  const endTime = new Date();
  const elapsed = ((endTime - startTime) / 1000).toFixed(1);

  console.log('\n' + '='.repeat(90));
  console.log('  전수 조사 결과 — 총 소요시간:', elapsed + '초');
  console.log('='.repeat(90));

  // 역할별 요약
  const roles = [...new Set(results.map(r => r.role))];
  const counts = {};
  for (const r of results) {
    if (!counts[r.role]) counts[r.role] = {};
    counts[r.role][r.result] = (counts[r.role][r.result] || 0) + 1;
  }

  const statuses = ['PASS', 'REDIRECT', 'ERROR', 'FAIL', '404', 'TIMEOUT', 'SKIP'];
  console.log(`\n${'역할'.padEnd(24)} ${statuses.map(s => s.padStart(8)).join('')}  합계`);
  console.log('─'.repeat(90));

  let grandTotal = {};
  for (const role of roles) {
    const c = counts[role];
    const total = Object.values(c).reduce((a, b) => a + b, 0);
    const line = statuses.map(s => String(c[s] || 0).padStart(8)).join('');
    console.log(`${role.padEnd(24)} ${line}  ${total}`);
    for (const s of statuses) grandTotal[s] = (grandTotal[s] || 0) + (c[s] || 0);
  }
  console.log('─'.repeat(90));
  const gt = Object.values(grandTotal).reduce((a, b) => a + b, 0);
  console.log(`${'합계'.padEnd(24)} ${statuses.map(s => String(grandTotal[s] || 0).padStart(8)).join('')}  ${gt}`);

  // ERROR/FAIL 상세
  const problems = results.filter(r => ['ERROR', 'FAIL', 'TIMEOUT'].includes(r.result));
  if (problems.length > 0) {
    console.log(`\n### 문제 발견: ${problems.length}건 ###`);
    for (const p of problems) {
      console.log(`  [${p.result}] ${p.role}  ${p.path}  ${p.note}`);
    }
  }

  // REDIRECT 상세 (권한별 접근 제어 확인)
  const redirects = results.filter(r => r.result === 'REDIRECT');
  if (redirects.length > 0) {
    console.log(`\n### 리다이렉트 (접근 제어): ${redirects.length}건 ###`);
    const grouped = {};
    for (const r of redirects) {
      if (!grouped[r.role]) grouped[r.role] = [];
      grouped[r.role].push(r);
    }
    for (const [role, items] of Object.entries(grouped)) {
      console.log(`  ${role}:`);
      for (const r of items) {
        console.log(`    ${r.path.padEnd(50)} → ${r.note}`);
      }
    }
  }

  // JSON 저장
  const reportDir = path.join(__dirname, '..', 'test-results');
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `page-audit-${startTime.toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: startTime.toISOString(),
    duration: elapsed + 's',
    base: BASE,
    summary: { grandTotal, byRole: counts },
    results,
  }, null, 2));
  console.log(`\nJSON: ${reportPath}`);
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
