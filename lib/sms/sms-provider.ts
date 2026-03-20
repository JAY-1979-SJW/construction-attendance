/**
 * SMS Provider 인터페이스
 *
 * 환경변수로 provider 전환:
 *   SMS_MODE=mock     → 콘솔 출력 (개발/테스트)
 *   SMS_MODE=coolsms  → CoolSMS REST API 연동
 *
 * 환경변수 (SMS_MODE=coolsms 시 필수):
 *   SMS_API_KEY      = CoolSMS API Key
 *   SMS_API_SECRET   = CoolSMS API Secret
 *   SMS_SENDER       = 발신번호 (01012345678 형식)
 */

import { sendViaCoolSms } from './coolsms'

export async function sendSms(to: string, message: string): Promise<void> {
  const mode = process.env.SMS_MODE ?? 'mock'

  if (mode === 'mock') {
    // 전화번호 마스킹 (뒤 4자리만 표시), OTP 원문 로그 제외
    const masked = to.length > 4 ? `${to.slice(0, -4).replace(/./g, '*')}${to.slice(-4)}` : '****'
    console.log(`[SMS MOCK] To: ${masked} | 메시지 발송 완료 (개발 모드)`)
    return
  }

  if (mode === 'coolsms') {
    await sendViaCoolSms(to, message)
    return
  }

  throw new Error(`지원하지 않는 SMS_MODE: ${mode}. 허용값: mock, coolsms`)
}
