import { prisma } from '@/lib/db/prisma'
import { generateOtp } from '@/lib/utils/random'
import { otpExpiresAt } from '@/lib/utils/date'
import { sendSms } from '@/lib/sms/sms-provider'
import type { OtpPurpose } from '@prisma/client'

export async function createAndSendOtp(phone: string, purpose: OtpPurpose): Promise<void> {
  const code = generateOtp(6)
  const expiresMinutes = parseInt(process.env.OTP_EXPIRES_MINUTES ?? '5', 10)

  // 기존 미사용 OTP 만료 처리
  await prisma.otpVerification.updateMany({
    where: { phone, purpose, verifiedAt: null, expiresAt: { gt: new Date() } },
    data: { expiresAt: new Date() },
  })

  await prisma.otpVerification.create({
    data: {
      phone,
      code,
      purpose,
      expiresAt: otpExpiresAt(expiresMinutes),
    },
  })

  await sendSms(phone, `[해한 현장 출퇴근] 인증번호: ${code} (${expiresMinutes}분 유효)`)
}

export async function verifyOtp(
  phone: string,
  code: string,
  purpose: OtpPurpose
): Promise<{ valid: boolean; reason?: string }> {
  const record = await prisma.otpVerification.findFirst({
    where: {
      phone,
      code,
      purpose,
      verifiedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!record) {
    return { valid: false, reason: '인증번호가 올바르지 않거나 만료되었습니다.' }
  }

  await prisma.otpVerification.update({
    where: { id: record.id },
    data: { verifiedAt: new Date() },
  })

  return { valid: true }
}
