/**
 * POST /api/auth/worker-register
 * 근로자 이메일/비밀번호 회원가입
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db/prisma'
import { signToken } from '@/lib/auth/jwt'
import { badRequest, conflict, internalError } from '@/lib/utils/response'

const schema = z.object({
  email:      z.string().email('올바른 이메일을 입력하세요'),
  password:   z.string().min(6, '비밀번호는 6자 이상이어야 합니다'),
  name:       z.string().min(2, '이름은 2자 이상').max(30),
  phone:      z.string().regex(/^010\d{8}$/, '올바른 휴대폰 번호를 입력하세요').optional(),
  jobTitle:   z.string().min(1, '직종을 입력하세요').max(50),
  birthDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '생년월일 형식: YYYY-MM-DD').optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const { email, password, name, phone, jobTitle, birthDate } = parsed.data

    // 이메일 중복 확인
    const existing = await prisma.worker.findFirst({
      where: { email },
      select: { id: true },
    })
    if (existing) return conflict('이미 등록된 이메일입니다.')

    // 전화번호 중복 확인
    if (phone) {
      const phoneExists = await prisma.worker.findFirst({
        where: { phone },
        select: { id: true },
      })
      if (phoneExists) return conflict('이미 등록된 전화번호입니다.')
    }

    const passwordHash = await bcrypt.hash(password, 12)

    const worker = await prisma.worker.create({
      data: {
        email,
        passwordHash,
        name,
        phone: phone ?? null,
        jobTitle,
        birthDate: birthDate ?? null,
        accountStatus: 'PENDING',
      },
    })

    // JWT 발급 (프로필 완성은 이미 되어 있으므로 바로 토큰 발급)
    const token = await signToken({
      sub: worker.id,
      type: 'worker',
    })

    const response = NextResponse.json({
      success: true,
      data: { id: worker.id, name: worker.name, email: worker.email },
      message: '회원가입이 완료되었습니다. 관리자 승인 후 출퇴근을 사용할 수 있습니다.',
    })
    response.cookies.set('worker_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7일
      path: '/',
    })

    return response
  } catch (err) {
    console.error('[auth/worker-register]', err)
    return internalError()
  }
}
