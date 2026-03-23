import nodemailer from 'nodemailer'

// ─── SMTP 트랜스포터 ──────────────────────────────────────────────────────────
// 환경변수:
//   EMAIL_HOST        — SMTP 서버 호스트 (예: smtp.gmail.com)
//   EMAIL_PORT        — SMTP 포트 (기본 587)
//   EMAIL_SECURE      — 'true' 이면 SSL(465), 기본 false(STARTTLS)
//   EMAIL_USER        — SMTP 계정
//   EMAIL_PASS        — SMTP 비밀번호 or 앱 비밀번호
//   EMAIL_FROM        — 발신자 표시 이름+주소 (예: "현장출근관리 <no-reply@example.com>")

function createTransporter() {
  const host = process.env.EMAIL_HOST
  const user = process.env.EMAIL_USER
  const pass = process.env.EMAIL_PASS

  if (!host || !user || !pass) return null

  return nodemailer.createTransport({
    host,
    port: parseInt(process.env.EMAIL_PORT ?? '587', 10),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: { user, pass },
  })
}

export type EmailPayload = {
  to: string
  subject: string
  html: string
  text?: string
}

// 이메일 발송 실패 시 예외를 throw 하지 않고 false 반환 — 이메일 장애가 API를 막지 않도록 함
export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  try {
    const transporter = createTransporter()
    if (!transporter) {
      console.warn('[email] SMTP 설정이 없습니다. 이메일을 발송하지 않습니다.')
      return false
    }

    const from = process.env.EMAIL_FROM ?? process.env.EMAIL_USER ?? 'no-reply@localhost'

    await transporter.sendMail({
      from,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    })

    return true
  } catch (err) {
    console.error('[email] 발송 실패:', err)
    return false
  }
}
