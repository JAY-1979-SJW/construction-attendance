import { NextRequest } from 'next/server'
import { sendOtpSchema } from '@/lib/validators/auth'
import { createAndSendOtp } from '@/lib/auth/otp'
import { prisma } from '@/lib/db/prisma'
import { ok, badRequest, internalError } from '@/lib/utils/response'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = sendOtpSchema.safeParse(body)

    if (!parsed.success) {
      return badRequest(parsed.error.errors[0].message)
    }

    const { phone, purpose } = parsed.data

    // 근로자 존재 여부 확인 (로그인 목적이고 미등록이면 안내)
    if (purpose === 'LOGIN') {
      const worker = await prisma.worker.findUnique({ where: { phone } })
      if (!worker || !worker.isActive) {
        return badRequest('등록되지 않은 휴대폰 번호입니다. 현장 관리자에게 등록을 요청하세요.')
      }
    }

    await createAndSendOtp(phone, purpose)

    return ok(null, `인증번호가 발송되었습니다. (${process.env.OTP_EXPIRES_MINUTES ?? 5}분 유효)`)
  } catch (err) {
    console.error('[send-otp]', err)
    return internalError()
  }
}
