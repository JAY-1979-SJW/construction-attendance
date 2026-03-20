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
    // OTP 원문을 운영 로그에 남기지 않기 위해 to만 기록
    console.log(`[SMS MOCK] To: ${to} | 메시지 발송 완료 (개발 모드)`)
    return
  }

  if (mode === 'coolsms') {
    await sendViaCoolSms(to, message)
    return
  }

  throw new Error(`지원하지 않는 SMS_MODE: ${mode}. 허용값: mock, coolsms`)
}
