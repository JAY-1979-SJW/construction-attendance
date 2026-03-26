/**
 * POST /api/auth/register-intent
 * 가입 의도 쿠키를 httpOnly로 서버 측에서 발급
 */
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const consent = typeof body.consent === 'string' ? body.consent : ''

  const res = NextResponse.json({ success: true })

  res.cookies.set('auth_intent', 'register', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })

  if (consent) {
    res.cookies.set('register_consent', consent, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    })
  }

  return res
}
