import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth/jwt'

const ADMIN_PUBLIC_PATHS = ['/admin/login', '/api/admin/auth/login']
const ADMIN_PATHS = ['/admin', '/api/admin']
const PROTECTED_API_PATHS = [
  '/api/attendance',
  '/api/device',
  '/api/auth/me',
  '/api/auth/logout',
  '/api/export',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Admin 경로 보호 (로그인 페이지/API는 제외)
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
      if (!payload || payload.type !== 'admin') {
        throw new Error('Invalid token type')
      }
    } catch {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ success: false, message: '유효하지 않은 토큰입니다.' }, { status: 401 })
      }
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
  }

  // Worker API 경로 보호
  if (PROTECTED_API_PATHS.some((p) => pathname.startsWith(p))) {
    const token = request.cookies.get('worker_token')?.value
    if (!token) {
      return NextResponse.json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 })
    }

    try {
      const payload = await verifyToken(token)
      if (!payload || payload.type !== 'worker') {
        throw new Error('Invalid token type')
      }
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
    '/api/attendance/:path*',
    '/api/device/:path*',
    '/api/auth/me',
    '/api/auth/logout',
    '/api/export/:path*',
  ],
}
