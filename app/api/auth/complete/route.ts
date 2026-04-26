/**
 * OAuth 완료 후 브릿지 핸들러
 * NextAuth 세션(이메일)을 읽어 기존 JWT 쿠키(worker_token / admin_token)로 변환
 *
 * auth_intent=register 쿠키가 있으면 → 신규 가입 모드
 *   → Worker를 PENDING 상태로 생성 → /register/complete 리다이렉트
 * 그 외 → 일반 로그인 모드
 */
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { auth } from '@/lib/auth/nextauth'
import { prisma } from '@/lib/db/prisma'
import { signToken } from '@/lib/auth/jwt'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '')
  .split(',').map(e => e.trim()).filter(Boolean)

const BASE_URL = (process.env.NEXTAUTH_URL ?? 'http://localhost:3002').replace(/\/$/, '')

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.redirect(`${BASE_URL}/login?error=no_session`)
  }

  // Kakao가 email 동의 미제공 시 kakao_id 기반 synthetic email로 fallback
  const email = session.user.email
    ?? (session.user.id ? `kakao_${session.user.id}@kakao.local` : null)

  if (!email) {
    return NextResponse.redirect(`${BASE_URL}/login?error=no_email`)
  }

  const name = session.user.name ?? '사용자'

  const ua = req.headers.get('user-agent') ?? ''
  const isMobile = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)
  const workerTokenExpiry = isMobile ? '3650d' : '30d'
  const workerCookieMaxAge = isMobile ? 60 * 60 * 24 * 3650 : 60 * 60 * 24 * 30

  // 쿠키에서 가입 의도 확인
  const cookieStore = await cookies()
  const authIntent = cookieStore.get('auth_intent')?.value
  const isRegisterMode = authIntent === 'register'

  try {
    // ── 관리자 ─────────────────────────────────────────────
    if (ADMIN_EMAILS.includes(email)) {
      let admin = await prisma.adminUser.findUnique({ where: { email } })
      if (!admin) {
        admin = await prisma.adminUser.create({
          data: {
            name,
            email,
            passwordHash: 'oauth_no_password',
            role: 'SUPER_ADMIN',
            isActive: true,
          },
        })
      }
      if (!admin.isActive) {
        return NextResponse.redirect(`${BASE_URL}/login?error=inactive`)
      }
      await prisma.adminUser.update({
        where: { id: admin.id },
        data: { lastLoginAt: new Date() },
      })
      const token = await signToken({ sub: admin.id, type: 'admin', role: admin.role })
      const res = NextResponse.redirect(`${BASE_URL}/admin`)
      res.cookies.set('admin_token', token, {
        httpOnly: true, secure: true, sameSite: 'lax',
        maxAge: 60 * 60 * 24, path: '/', // 1일 (JWT 만료와 일치)
      })
      clearIntentCookies(res)
      return res
    }

    // ── 근로자 ─────────────────────────────────────────────
    const existingWorker = await prisma.worker.findFirst({ where: { email } })

    if (existingWorker) {
      // 기존 계정 → 로그인
      if (!existingWorker.isActive || existingWorker.accountStatus === 'REJECTED') {
        return NextResponse.redirect(`${BASE_URL}/login?error=inactive`)
      }

      // 가입 모드인데 이미 계정 있음 → 로그인 페이지로
      if (isRegisterMode) {
        const res = NextResponse.redirect(`${BASE_URL}/register?error=already_registered`)
        clearIntentCookies(res)
        return res
      }

      // 프로필 미완성 (jobTitle이 미설정이면) → 프로필 완성 페이지
      if (existingWorker.jobTitle === '미설정') {
        const token = await signToken({ sub: existingWorker.id, type: 'worker' }, workerTokenExpiry)
        const refreshTok = await signToken({ sub: existingWorker.id, type: 'refresh' }, '3650d')
        const res = NextResponse.redirect(`${BASE_URL}/register/complete`)
        res.cookies.set('worker_token', token, {
          httpOnly: true, secure: true, sameSite: 'lax',
          maxAge: workerCookieMaxAge, expires: new Date(Date.now() + workerCookieMaxAge * 1000), path: '/',
        })
        res.cookies.set('worker_rt', refreshTok, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 3650, expires: new Date(Date.now() + 60 * 60 * 24 * 3650 * 1000), path: '/' })
        clearIntentCookies(res)
        return res
      }

      // 승인 대기 중이면 pending 페이지
      if (existingWorker.accountStatus === 'PENDING') {
        const token = await signToken({ sub: existingWorker.id, type: 'worker' }, workerTokenExpiry)
        const refreshTok = await signToken({ sub: existingWorker.id, type: 'refresh' }, '3650d')
        const res = NextResponse.redirect(`${BASE_URL}/register/pending`)
        res.cookies.set('worker_token', token, {
          httpOnly: true, secure: true, sameSite: 'lax',
          maxAge: workerCookieMaxAge, expires: new Date(Date.now() + workerCookieMaxAge * 1000), path: '/',
        })
        res.cookies.set('worker_rt', refreshTok, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 3650, expires: new Date(Date.now() + 60 * 60 * 24 * 3650 * 1000), path: '/' })
        clearIntentCookies(res)
        return res
      }

      const token = await signToken({ sub: existingWorker.id, type: 'worker' }, workerTokenExpiry)
      const refreshTok = await signToken({ sub: existingWorker.id, type: 'refresh' }, '3650d')
      const res = NextResponse.redirect(`${BASE_URL}/attendance`)
      res.cookies.set('worker_token', token, {
        httpOnly: true, secure: true, sameSite: 'lax',
        maxAge: workerCookieMaxAge, path: '/',
      })
      res.cookies.set('worker_rt', refreshTok, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 3650, expires: new Date(Date.now() + 60 * 60 * 24 * 3650 * 1000), path: '/' })
      clearIntentCookies(res)
      return res
    }

    // ── 신규 근로자 생성 ──────────────────────────────────
    // 가입 모드가 아닌 경우(로그인만 시도) → 가입 페이지로 리다이렉트
    // 승인 흐름 우회 방지: 명시적 가입 절차를 거쳐야만 계정 생성
    if (!isRegisterMode) {
      const res = NextResponse.redirect(`${BASE_URL}/register?error=not_registered`)
      clearIntentCookies(res)
      return res
    }

    const worker = await prisma.worker.create({
      data: {
        name,
        email,
        phone: null,
        jobTitle: '미설정',
        accountStatus: 'PENDING',
        isActive: true,
      },
    })

    const token = await signToken({ sub: worker.id, type: 'worker' }, workerTokenExpiry)
    const refreshTok = await signToken({ sub: worker.id, type: 'refresh' }, '3650d')
    const res = NextResponse.redirect(`${BASE_URL}/register/complete`)
    res.cookies.set('worker_token', token, {
      httpOnly: true, secure: true, sameSite: 'lax',
      maxAge: workerCookieMaxAge, path: '/',
    })
    res.cookies.set('worker_rt', refreshTok, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 3650, expires: new Date(Date.now() + 60 * 60 * 24 * 3650 * 1000), path: '/' })
    clearIntentCookies(res)
    return res
  } catch (err) {
    console.error('[auth/complete]', err)
    return NextResponse.redirect(`${BASE_URL}/login?error=server`)
  }
}

function clearIntentCookies(res: NextResponse) {
  res.cookies.set('auth_intent', '', { maxAge: 0, path: '/' })
  res.cookies.set('register_consent', '', { maxAge: 0, path: '/' })
}
