import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth/jwt'

const ADMIN_PUBLIC_PATHS = ['/admin/login', '/api/admin/auth/login', '/super/login', '/api/super/auth/login']
const ADMIN_PATHS = ['/admin', '/api/admin', '/super', '/api/super']

const COMPANY_PUBLIC_PATHS = ['/company/login', '/api/company/auth/login']
const COMPANY_PATHS = ['/company', '/api/company']

const PROTECTED_API_PATHS = [
  '/api/attendance',
  '/api/device',
  '/api/auth/me',
  '/api/auth/logout',
  '/api/export',
  '/api/worker',  // 근로자 전용 API (현장 목록, 내 상태 등)
]

// 회원가입/로그인은 공개 (토큰 불필요)
const PUBLIC_API_PATHS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/health',
  '/api/sites/list',
  '/api/policies',  // 정책 문서 공개 조회
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── 플랫폼 관리자 경로 (/admin) ─────────────────────────────
  if (
    ADMIN_PATHS.some((p) => pathname.startsWith(p)) &&
    !ADMIN_PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
  ) {
    const token = request.cookies.get('admin_token')?.value
    if (!token) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ success: false, message: '인증이 필요합니다.' }, { status: 401 })
      }
      const loginUrl = pathname.startsWith('/super') ? '/super/login' : '/admin/login'
      return NextResponse.redirect(new URL(loginUrl, request.url))
    }

    try {
      const payload = await verifyToken(token)
      if (!payload || payload.type !== 'admin') throw new Error('Invalid token type')
      // COMPANY_ADMIN이 /admin 또는 /super 접근 시 /company로 리다이렉트
      if (payload.role === 'COMPANY_ADMIN') {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json({ success: false, message: '업체 관리자 포털을 이용해주세요.' }, { status: 403 })
        }
        return NextResponse.redirect(new URL('/company', request.url))
      }
    } catch {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ success: false, message: '유효하지 않은 토큰입니다.' }, { status: 401 })
      }
      const loginUrl = pathname.startsWith('/super') ? '/super/login' : '/admin/login'
      return NextResponse.redirect(new URL(loginUrl, request.url))
    }
  }

  // ── 업체 관리자 경로 (/company) ──────────────────────────────
  if (
    COMPANY_PATHS.some((p) => pathname.startsWith(p)) &&
    !COMPANY_PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
  ) {
    const token = request.cookies.get('admin_token')?.value
    if (!token) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ success: false, message: '인증이 필요합니다.' }, { status: 401 })
      }
      return NextResponse.redirect(new URL('/company/login', request.url))
    }

    try {
      const payload = await verifyToken(token)
      if (!payload || payload.type !== 'admin') throw new Error('Invalid token type')
      // 플랫폼 관리자가 /company 접근 시 /admin으로 리다이렉트
      if (payload.role !== 'COMPANY_ADMIN') {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json({ success: false, message: '업체 관리자 전용 경로입니다.' }, { status: 403 })
        }
        return NextResponse.redirect(new URL('/admin', request.url))
      }
    } catch {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ success: false, message: '유효하지 않은 토큰입니다.' }, { status: 401 })
      }
      return NextResponse.redirect(new URL('/company/login', request.url))
    }
  }

  // ── Worker API 경로 ──────────────────────────────────────────
  if (PROTECTED_API_PATHS.some((p) => pathname.startsWith(p))) {
    const token = request.cookies.get('worker_token')?.value
    if (!token) {
      return NextResponse.json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 })
    }

    try {
      const payload = await verifyToken(token)
      if (!payload || payload.type !== 'worker') throw new Error('Invalid token type')
    } catch {
      return NextResponse.json({ success: false, message: '유효하지 않은 토큰입니다.' }, { status: 401 })
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
    '/super/:path*',
    '/api/super/:path*',
    '/company/:path*',
    '/api/company/:path*',
    '/api/attendance/:path*',
    '/api/device/:path*',
    '/api/auth/me',
    '/api/auth/logout',
    '/api/export/:path*',
    '/api/worker/:path*',
  ],
}
