/**
 * POST /api/auth/worker-login
 * 근로자 핸드폰번호/비밀번호 로그인
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db/prisma'
import { signToken } from '@/lib/auth/jwt'
import { badRequest, unauthorized, internalError } from '@/lib/utils/response'
import { checkRateLimit, resetRateLimit } from '@/lib/auth/rate-limit'

const schema = z.object({
  phone:    z.string().regex(/^010\d{8}$/, '올바른 휴대폰 번호를 입력하세요'),
  password: z.string().min(1),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const { phone, password } = parsed.data
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

    // Rate limiting
    const ipCheck = checkRateLimit(`worker-login:ip:${ip}`, { maxAttempts: 10, windowMs: 60_000 })
    const phoneCheck = checkRateLimit(`worker-login:phone:${phone}`, { maxAttempts: 5, windowMs: 60_000 })

    if (!ipCheck.allowed || !phoneCheck.allowed) {
      const retrySec = Math.ceil(Math.max(ipCheck.retryAfterMs, phoneCheck.retryAfterMs) / 1000)
      return NextResponse.json(
        { success: false, message: `로그인 시도가 너무 많습니다. ${retrySec}초 후 다시 시도해주세요.` },
        { status: 429 }
      )
    }

    const worker = await prisma.worker.findFirst({
      where: { phone },
      select: { id: true, name: true, phone: true, passwordHash: true, isActive: true, accountStatus: true },
    })

    if (!worker || !worker.passwordHash) {
      return unauthorized('핸드폰 번호 또는 비밀번호가 올바르지 않습니다.')
    }

    if (!worker.isActive) {
      return unauthorized('비활성화된 계정입니다. 관리자에게 문의하세요.')
    }

    const valid = await bcrypt.compare(password, worker.passwordHash)
    if (!valid) {
      return unauthorized('핸드폰 번호 또는 비밀번호가 올바르지 않습니다.')
    }

    // 성공 → rate limit 초기화
    resetRateLimit(`worker-login:ip:${ip}`)
    resetRateLimit(`worker-login:phone:${phone}`)

    const ua = req.headers.get('user-agent') ?? ''
    const isMobile = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)
    const tokenExpiry = isMobile ? '3650d' : '30d'
    const cookieMaxAge = isMobile ? 60 * 60 * 24 * 3650 : 60 * 60 * 24 * 30

    const token = await signToken({ sub: worker.id, type: 'worker' }, tokenExpiry)
    const refreshToken = await signToken({ sub: worker.id, type: 'refresh' }, '3650d')

    const response = NextResponse.json({
      success: true,
      data: { id: worker.id, name: worker.name, phone: worker.phone, accountStatus: worker.accountStatus },
    })
    response.cookies.set('worker_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: cookieMaxAge,
      expires: new Date(Date.now() + cookieMaxAge * 1000),
      path: '/',
    })
    response.cookies.set('worker_rt', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 3650,
      expires: new Date(Date.now() + 60 * 60 * 24 * 3650 * 1000),
      path: '/',
    })

    return response
  } catch (err) {
    console.error('[auth/worker-login]', err)
    return internalError()
  }
}
