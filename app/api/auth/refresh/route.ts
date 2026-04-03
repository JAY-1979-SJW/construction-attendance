/**
 * POST /api/auth/refresh
 * localStorage에 저장된 refresh token으로 worker_token 쿠키 재발급
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { verifyToken, signToken } from '@/lib/auth/jwt'
import { unauthorized, internalError } from '@/lib/utils/response'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const refreshToken: string | undefined = body?.refreshToken

    if (!refreshToken) return unauthorized('refresh token이 없습니다.')

    const payload = await verifyToken(refreshToken)
    if (!payload || payload.type !== 'refresh' || !payload.sub) {
      return unauthorized('유효하지 않은 refresh token입니다.')
    }

    const worker = await prisma.worker.findUnique({
      where: { id: payload.sub },
      select: { id: true, isActive: true, accountStatus: true },
    })

    if (!worker || !worker.isActive) {
      return unauthorized('비활성화된 계정입니다.')
    }

    const ua = req.headers.get('user-agent') ?? ''
    const isMobile = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)
    const tokenExpiry = isMobile ? '3650d' : '30d'
    const cookieMaxAge = isMobile ? 60 * 60 * 24 * 3650 : 60 * 60 * 24 * 30

    const newToken = await signToken({ sub: worker.id, type: 'worker' }, tokenExpiry)

    const response = NextResponse.json({ success: true })
    response.cookies.set('worker_token', newToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: cookieMaxAge,
      expires: new Date(Date.now() + cookieMaxAge * 1000),
      path: '/',
    })
    return response
  } catch (err) {
    console.error('[auth/refresh]', err)
    return internalError()
  }
}
