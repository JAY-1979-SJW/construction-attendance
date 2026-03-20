/**
 * CoolSMS REST API 연동 (SDK 불필요 — Node.js 내장 crypto 사용)
 *
 * 필수 환경변수:
 *   SMS_API_KEY      = CoolSMS API Key
 *   SMS_API_SECRET   = CoolSMS API Secret
 *   SMS_SENDER       = 발신번호 (사전 등록 필수, 예: 01012345678)
 *
 * CoolSMS 인증 방식: HMAC-SHA256
 *   Authorization: HMAC-SHA256 apiKey={key}, date={date}, salt={salt}, signature={sig}
 *   signature = HMAC-SHA256(apiSecret, date + salt)
 */

import crypto from 'crypto'

const COOLSMS_API_URL = 'https://api.coolsms.co.kr/messages/v4/send-one'

function buildAuthHeader(apiKey: string, apiSecret: string): string {
  const date = new Date().toISOString()
  const salt = crypto.randomBytes(16).toString('hex')
  const signature = crypto
    .createHmac('sha256', apiSecret)
    .update(date + salt)
    .digest('hex')
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`
}

export async function sendViaCoolSms(to: string, message: string): Promise<void> {
  const apiKey = process.env.COOLSMS_API_KEY
  const apiSecret = process.env.COOLSMS_API_SECRET
  const from = process.env.COOLSMS_SENDER_PHONE

  if (!apiKey || !apiSecret || !from) {
    throw new Error(
      'CoolSMS 환경변수 누락: COOLSMS_API_KEY, COOLSMS_API_SECRET, COOLSMS_SENDER_PHONE 을 확인하세요.'
    )
  }

  const body = JSON.stringify({
    message: {
      to,
      from,
      text: message,
    },
  })

  const response = await fetch(COOLSMS_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: buildAuthHeader(apiKey, apiSecret),
    },
    body,
  })

  if (!response.ok) {
    let detail = ''
    try {
      const json = await response.json()
      detail = JSON.stringify(json)
    } catch {
      detail = await response.text()
    }
    throw new Error(`CoolSMS 발송 실패 [${response.status}]: ${detail}`)
  }
}
