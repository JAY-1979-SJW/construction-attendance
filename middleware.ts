import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth/jwt'
import {
  ADMIN_PUBLIC_PATHS,
  ADMIN_PATHS,
  ADMIN_EXTRA_PATHS,
  COMPANY_PUBLIC_PATHS,
  COMPANY_PATHS,
  WORKER_PROTECTED_PAGES,
  WORKER_PROTECTED_PATHS,
  ROUTE_REDIRECT,
} from '@/lib/policies/route-policy'

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
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }

    try {
      const payload = await verifyToken(token)
      if (!payload || payload.type !== 'admin') throw new Error('Invalid token type')
      // COMPANY_ADMIN도 /admin 포털 사용 가능 (데이터 범위는 각 API에서 회사 scope로 제한)
      // 기존에는 /company 포털로 강제 리다이렉트했으나, 현장 개설·근로자 관리·문서정책 등
      // 핵심 운영 기능이 /admin에만 있으므로 접근을 허용한다.
      // VIEWER는 읽기 전용 — API mutation 요청 차단
      if (payload.role === 'VIEWER' && pathname.startsWith('/api/') && request.method !== 'GET') {
        return NextResponse.json({ success: false, message: 'VIEWER 역할은 읽기 전용입니다.' }, { status: 403 })
      }
    } catch {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ success: false, message: '유효하지 않은 토큰입니다.' }, { status: 401 })
      }
      return NextResponse.redirect(new URL('/admin/login', request.url))
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
      // 플랫폼 관리자가 /company 접근 시 → ROUTE_REDIRECT.PLATFORM_ADMIN_MISMATCH
      if (payload.role !== 'COMPANY_ADMIN') {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json({ success: false, message: '업체 관리자 전용 경로입니다.' }, { status: 403 })
        }
        return NextResponse.redirect(new URL(ROUTE_REDIRECT.PLATFORM_ADMIN_MISMATCH, request.url))
      }
    } catch {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ success: false, message: '유효하지 않은 토큰입니다.' }, { status: 401 })
      }
      return NextResponse.redirect(new URL('/company/login', request.url))
    }
  }

  // ── 관리자 전용 추가 경로 (/labor, /ops) ─────────────────────
  if (ADMIN_EXTRA_PATHS.some((p) => pathname.startsWith(p))) {
    const token = request.cookies.get('admin_token')?.value
    if (!token) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }

    try {
      const payload = await verifyToken(token)
      if (!payload || payload.type !== 'admin') throw new Error('Invalid token type')
    } catch {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
  }

  // ── 근로자 페이지 경로 (/attendance, /daily-report, /contracts, /my) ──
  if (WORKER_PROTECTED_PAGES.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    const token = request.cookies.get('worker_token')?.value
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    try {
      const payload = await verifyToken(token)
      if (!payload || payload.type !== 'worker') throw new Error('Invalid token type')
    } catch {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // ── Worker API 경로 ──────────────────────────────────────────
  if (WORKER_PROTECTED_PATHS.some((p) => pathname.startsWith(p))) {
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

  // ── 모바일 감지 → /m/ 리다이렉트 ─────────────────────────────
  const MOBILE_REDIRECT_PAGES = ['/', '/login', '/register', '/register/company-admin', '/register/complete', '/register/pending', '/guide']
  if (MOBILE_REDIRECT_PAGES.includes(pathname) && !pathname.startsWith('/m/') && !pathname.startsWith('/api/')) {
    const ua = request.headers.get('user-agent') ?? ''
    const isMobile = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)
    if (isMobile) {
      const mobilePath = pathname === '/' ? '/m' : `/m${pathname}`
      return NextResponse.redirect(new URL(mobilePath, request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/',
    '/login',
    '/register',
    '/register/:path*',
    '/guide',
    '/admin/:path*',
    '/api/admin/:path*',
    '/company/:path*',
    '/api/company/:path*',
    '/labor/:path*',
    '/ops/:path*',
    '/attendance',
    '/attendance/:path*',
    '/daily-report',
    '/daily-report/:path*',
    '/contracts/:path*',
    '/my',
    '/my/:path*',
    '/onboarding',
    '/onboarding/:path*',
    '/wage',
    '/wage/:path*',
    '/api/attendance/:path*',
    '/api/device/:path*',
    '/api/auth/me',
    '/api/auth/logout',
    '/api/export/:path*',
    '/api/worker/:path*',
    '/api/sites/:path*',
  ],
}
