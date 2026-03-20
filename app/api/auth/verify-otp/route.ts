import { NextRequest, NextResponse } from 'next/server'
import { verifyOtpSchema } from '@/lib/validators/auth'
import { verifyOtp } from '@/lib/auth/otp'
import { prisma } from '@/lib/db/prisma'
import { signToken } from '@/lib/auth/jwt'
import { badRequest, internalError } from '@/lib/utils/response'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = verifyOtpSchema.safeParse(body)

    if (!parsed.success) {
      return badRequest(parsed.error.errors[0].message)
    }

    const { phone, code, purpose } = parsed.data

    const { valid, reason } = await verifyOtp(phone, code, purpose)
    if (!valid) {
      return badRequest(reason ?? '인증 실패')
    }

    if (purpose === 'DEVICE_CHANGE') {
      // device change flow: 인증만 확인, 토큰 발급 없음
      return NextResponse.json({ success: true, data: { verified: true }, message: 'OTP 인증 완료. 기기 변경을 진행하세요.' })
    }

    // LOGIN flow
    const worker = await prisma.worker.findUnique({
      where: { phone },
      include: {
        devices: { where: { isActive: true }, orderBy: { isPrimary: 'desc' } },
      },
    })

    if (!worker || !worker.isActive) {
      return badRequest('계정을 찾을 수 없습니다.')
    }

    // 임시 세션 토큰 (device 등록 전)
    const tempToken = await signToken({
      sub: worker.id,
      type: 'worker',
    })

    const hasDevice = worker.devices.length > 0

    const response = NextResponse.json({
      success: true,
      data: {
        workerId: worker.id,
        workerName: worker.name,
        hasDevice,
        needsDeviceRegister: !hasDevice,
      },
      message: '인증 완료',
    })

    response.cookies.set('worker_token', tempToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7일
      path: '/',
    })

    return response
  } catch (err) {
    console.error('[verify-otp]', err)
    return internalError()
  }
}
