/**
 * 경로 · 인증 정책
 *
 * 이 파일은 플랫폼 내 경로 분류와 인증 요구사항을 정의한다.
 * 실제 미들웨어 처리는 middleware.ts 가 담당한다.
 *
 * 주의: Next.js middleware의 config.matcher는 빌드 시 정적 분석이 필요하므로
 *       matcher 배열은 middleware.ts에 직접 유지한다.
 *       여기서는 런타임 경로 판별에 사용되는 배열을 관리한다.
 */

// ─── 플랫폼 관리자 경로 ──────────────────────────────────────────────────────

/** 인증 없이 접근 가능한 플랫폼 관리자 공개 경로 */
export const ADMIN_PUBLIC_PATHS = [
  '/admin/login',
  '/api/admin/auth/login',
]

/** 인증이 필요한 플랫폼 관리자 경로 접두사 */
export const ADMIN_PATHS = ['/admin', '/api/admin']

// ─── 업체 관리자 경로 ────────────────────────────────────────────────────────

/** 인증 없이 접근 가능한 업체 관리자 공개 경로 */
export const COMPANY_PUBLIC_PATHS = ['/company/login', '/api/company/auth/login']

/** 인증이 필요한 업체 관리자 경로 접두사 */
export const COMPANY_PATHS = ['/company', '/api/company']

// ─── 관리자 전용 추가 경로 (admin_token 필요) ────────────────────────────────

/** admin_token이 필요한 추가 페이지 경로 접두사 */
export const ADMIN_EXTRA_PATHS = ['/labor', '/ops']

// ─── 근로자 경로 ─────────────────────────────────────────────────────────────

/** worker_token이 필요한 페이지 경로 (모바일 라우트 그룹 + /my) */
export const WORKER_PROTECTED_PAGES = [
  '/attendance',
  '/daily-report',
  '/contracts',
  '/my',
]

/** worker_token이 필요한 API 경로 접두사 */
export const WORKER_PROTECTED_PATHS = [
  '/api/attendance',
  '/api/device',
  '/api/auth/me',
  '/api/auth/logout',
  '/api/export',
  '/api/worker',
  '/api/sites',
]

/** 토큰 불필요 공개 API 경로 */
export const PUBLIC_API_PATHS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/register-intent',
  '/api/health',
  '/api/policies',
]

// ─── 리다이렉트 규칙 ─────────────────────────────────────────────────────────

/**
 * COMPANY_ADMIN이 /admin 접근 시 → /company로 리다이렉트
 * 플랫폼 관리자가 /company 접근 시 → /admin으로 리다이렉트
 */
export const ROUTE_REDIRECT = {
  COMPANY_ADMIN_MISMATCH: '/company',  // COMPANY_ADMIN → /admin 접근 시
  PLATFORM_ADMIN_MISMATCH: '/admin',   // 플랫폼 관리자 → /company 접근 시
} as const
