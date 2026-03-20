import { prisma } from '@/lib/db/prisma'
import { generateOtp } from '@/lib/utils/random'
import { otpExpiresAt } from '@/lib/utils/date'
import { sendSms } from '@/lib/sms/sms-provider'
import type { OtpPurpose } from '@prisma/client'

// OTP 재전송 정책
const OTP_COOLDOWN_SECONDS = 60       // 동일 번호 재발송 최소 간격
const OTP_MAX_SENDS_PER_HOUR = 5      // 시간당 최대 발송 횟수

/**
 * OTP 생성 및 발송.
 * 쿨다운/발송 횟수 초과 시 Error 를 throw합니다.
 *   'OTP_COOLDOWN:<남은초>'  — 재전송 대기
 *   'OTP_RATE_LIMIT'         — 시간당 한도 초과
 */
export async function createAndSendOtp(phone: string, purpose: OtpPurpose): Promise<void> {
  const now = new Date()

  // ── 1. 시간당 재전송 한도 체크 ──────────────────────────────
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
  const recentCount = await prisma.otpVerification.count({
    where: { phone, purpose, createdAt: { gte: oneHourAgo } },
  })
  if (recentCount >= OTP_MAX_SENDS_PER_HOUR) {
    throw new Error('OTP_RATE_LIMIT')
  }

  // ── 2. 쿨다운 체크 ──────────────────────────────────────────
  const cooldownAgo = new Date(now.getTime() - OTP_COOLDOWN_SECONDS * 1000)
  const lastOtp = await prisma.otpVerification.findFirst({
    where: { phone, purpose, createdAt: { gte: cooldownAgo } },
    orderBy: { createdAt: 'desc' },
  })
  if (lastOtp) {
    const elapsed = Math.floor((now.getTime() - lastOtp.createdAt.getTime()) / 1000)
    const remaining = OTP_COOLDOWN_SECONDS - elapsed
    throw new Error(`OTP_COOLDOWN:${remaining}`)
  }

  // ── 3. 기존 미사용 OTP 만료 처리 ────────────────────────────
  await prisma.otpVerification.updateMany({
    where: { phone, purpose, verifiedAt: null, expiresAt: { gt: now } },
    data: { expiresAt: now },
  })

  // ── 4. 신규 OTP 생성 ─────────────────────────────────────────
  const code = generateOtp(6)
  const expiresMinutes = parseInt(process.env.OTP_EXPIRES_MINUTES ?? '5', 10)

  await prisma.otpVerification.create({
    data: {
      phone,
      code,
      purpose,
      expiresAt: otpExpiresAt(expiresMinutes),
    },
  })

  // ── 5. 발송 (로그에 OTP 원문 노출 없음) ─────────────────────
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

  // ── 인증 성공 즉시 무효화 ─────────────────────────────────────
  await prisma.otpVerification.update({
    where: { id: record.id },
    data: { verifiedAt: new Date() },
  })

  return { valid: true }
}
