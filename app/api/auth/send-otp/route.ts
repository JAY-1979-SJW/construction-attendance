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
    if (err instanceof Error) {
      // 재전송 쿨다운
      if (err.message.startsWith('OTP_COOLDOWN:')) {
        const seconds = err.message.split(':')[1]
        return badRequest(`잠시 후 다시 시도해주세요. (${seconds}초 후 재전송 가능)`, 'OTP_COOLDOWN')
      }
      // 시간당 발송 한도 초과
      if (err.message === 'OTP_RATE_LIMIT') {
        return badRequest('인증번호 발송 횟수를 초과했습니다. 1시간 후 다시 시도해주세요.', 'OTP_RATE_LIMIT')
      }
      // 운영 환경에서 SMS 키 누락 → 명확히 실패 (애매하게 넘어가지 않음)
      if (err.message.includes('환경변수 누락')) {
        console.error('[send-otp] SMS 설정 오류:', err.message)
        return internalError('SMS 발송 설정이 올바르지 않습니다. 관리자에게 문의하세요.')
      }
    }
    // 전화번호는 로그에 남기되, OTP 원문은 절대 출력 안 함
    console.error('[send-otp]', err instanceof Error ? err.message : err)
    return internalError()
  }
}
