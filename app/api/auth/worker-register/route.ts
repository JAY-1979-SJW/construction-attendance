/**
 * POST /api/auth/worker-register
 * 근로자 핸드폰번호/비밀번호 회원가입
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db/prisma'
import { signToken } from '@/lib/auth/jwt'
import { badRequest, conflict, internalError } from '@/lib/utils/response'

const schema = z.object({
  phone:    z.string().regex(/^010\d{8}$/, '올바른 휴대폰 번호를 입력하세요 (예: 01012345678)'),
  password: z.string().min(6, '비밀번호는 6자 이상이어야 합니다'),
  name:     z.string().min(2, '이름은 2자 이상').max(30),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const { phone, password, name } = parsed.data

    // 전화번호 중복 확인
    const existing = await prisma.worker.findFirst({
      where: { phone },
      select: { id: true },
    })
    if (existing) return conflict('이미 등록된 전화번호입니다.')

    const passwordHash = await bcrypt.hash(password, 12)

    const worker = await prisma.worker.create({
      data: {
        name,
        phone,
        passwordHash,
        jobTitle: '미설정',
        accountStatus: 'PENDING',
      },
    })

    const ua = req.headers.get('user-agent') ?? ''
    const isMobile = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)
    const tokenExpiry = isMobile ? '3650d' : '30d'
    const cookieMaxAge = isMobile ? 60 * 60 * 24 * 3650 : 60 * 60 * 24 * 30

    const token = await signToken({ sub: worker.id, type: 'worker' }, tokenExpiry)
    const refreshToken = await signToken({ sub: worker.id, type: 'refresh' }, '3650d')

    const response = NextResponse.json({
      success: true,
      data: { id: worker.id, name: worker.name, phone: worker.phone },
      message: '회원가입이 완료되었습니다. 관리자 승인 후 이용할 수 있습니다.',
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
    console.error('[auth/worker-register]', err)
    return internalError()
  }
}
