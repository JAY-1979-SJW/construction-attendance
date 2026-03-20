/**
 * SMS Provider 인터페이스
 * SMS_MODE 환경변수로 실제 provider 전환
 *
 * SMS_MODE=mock   → 콘솔 출력 (개발/테스트)
 * SMS_MODE=coolsms → CoolSMS 연동
 * SMS_MODE=ncloud → NCloud SENS 연동
 */

export async function sendSms(to: string, message: string): Promise<void> {
  const mode = process.env.SMS_MODE ?? 'mock'

  if (mode === 'mock') {
    console.log(`[SMS MOCK] To: ${to} | Message: ${message}`)
    return
  }

  if (mode === 'coolsms') {
    await sendViaCoolSms(to, message)
    return
  }

  if (mode === 'ncloud') {
    await sendViaNCloud(to, message)
    return
  }

  throw new Error(`Unknown SMS_MODE: ${mode}`)
}

async function sendViaCoolSms(to: string, message: string): Promise<void> {
  // TODO: CoolSMS SDK 연동
  // npm install coolsms-node-sdk
  // const coolsms = require('coolsms-node-sdk').default
  // const messageService = new coolsms(process.env.COOLSMS_API_KEY, process.env.COOLSMS_API_SECRET)
  // await messageService.sendOne({ to, from: process.env.COOLSMS_SENDER_PHONE, text: message })
  throw new Error('CoolSMS integration not implemented. Install coolsms-node-sdk and uncomment above.')
}

async function sendViaNCloud(to: string, message: string): Promise<void> {
  // TODO: NCloud SENS 연동
  // https://api.ncloud-docs.com/docs/ai-application-service-sens-smsv2
  throw new Error('NCloud SENS integration not implemented.')
}
