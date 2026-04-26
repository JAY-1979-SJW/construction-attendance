/**
 * GOOGLE-AUTH-1 테스트 — Google 로그인/가입 브릿지 검증
 *
 * 검증 항목:
 * 1. Google Provider 등록 확인
 * 2. scope: openid email profile (민감 scope 없음)
 * 3. 신규 근로자 생성 (register 모드)
 * 4. 기존 근로자 로그인
 * 5. 관리자 이메일 → admin 처리
 * 6. 비활성 계정 차단
 * 7. 로그인 모드에서 미등록 사용자 → register 유도
 * 8. secret 원문 미노출
 * 9. Google Redirect URI 형식 검증
 * 10. GoogleSocialSection 컴포넌트 provider=google 확인
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    adminUser: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    worker: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth/nextauth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/auth/jwt', () => ({
  signToken: vi.fn().mockResolvedValue('mock-jwt-token'),
}))

const mockCookiesGet = vi.fn().mockReturnValue(undefined)
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockImplementation(() =>
    Promise.resolve({ get: mockCookiesGet })
  ),
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { prisma } = (await import('@/lib/db/prisma')) as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { auth } = (await import('@/lib/auth/nextauth')) as any

const mockWorker = prisma.worker as { findFirst: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> }
const mockAdmin = prisma.adminUser as {
  findUnique: ReturnType<typeof vi.fn>
  create: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
}
void auth

function makeRequest(cookieHeader = ''): Request {
  return new Request('https://attendance.haehan-ai.kr/api/auth/complete', {
    headers: { cookie: cookieHeader, 'user-agent': 'Mozilla/5.0' },
  })
}

// ── 1. Provider & scope 검증 ──────────────────────────────────────────────────
describe('Google Provider 설정', () => {
  it('NextAuth config에 google provider가 등록되어 있다', () => {
    const src = fs.readFileSync(
      path.resolve('lib/auth/nextauth.ts'), 'utf-8'
    )
    expect(src).toMatch(/id:\s*['"]google['"]/)
    expect(src).toMatch(/clientId.*GOOGLE_CLIENT_ID/)
    expect(src).toMatch(/clientSecret.*GOOGLE_CLIENT_SECRET/)
  })

  it('scope는 openid email profile 수준만 포함한다', () => {
    const src = fs.readFileSync(
      path.resolve('lib/auth/nextauth.ts'), 'utf-8'
    )
    expect(src).toMatch(/openid email profile/)
    // 민감/제한 scope 없음
    expect(src).not.toMatch(/drive|calendar|gmail|contacts|cloud-platform/i)
  })

  it('GoogleSocialSection 컴포넌트가 google provider로 signIn을 호출한다', () => {
    const src = fs.readFileSync(
      path.resolve('components/auth/GoogleSocialSection.tsx'), 'utf-8'
    )
    expect(src).toMatch(/signIn\(['"]google['"]\)/)
    expect(src).toMatch(/data-testid="google-login-btn"/)
  })

  it('Google Redirect URI 형식이 올바르다', () => {
    const NEXTAUTH_URL = 'https://attendance.haehan-ai.kr'
    const redirectUri = `${NEXTAUTH_URL}/api/auth/callback/google`
    expect(redirectUri).toBe('https://attendance.haehan-ai.kr/api/auth/callback/google')
  })

  it('login 페이지에 GoogleSocialSection이 포함된다', () => {
    const src = fs.readFileSync(path.resolve('app/login/page.tsx'), 'utf-8')
    expect(src).toMatch(/GoogleSocialSection/)
    expect(src).toMatch(/mode="login"/)
  })

  it('register 페이지에 GoogleSocialSection이 포함된다', () => {
    const src = fs.readFileSync(path.resolve('app/register/page.tsx'), 'utf-8')
    expect(src).toMatch(/GoogleSocialSection/)
    expect(src).toMatch(/mode="register"/)
  })
})

// ── 2. auth/complete Google 처리 (email 기반 — provider 무관) ─────────────────
describe('Google auth/complete 브릿지', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCookiesGet.mockReturnValue(undefined)
    process.env.NEXTAUTH_URL = 'https://attendance.haehan-ai.kr'
    process.env.ADMIN_EMAILS = 'admin@example.com'
  })

  it('Google 세션의 email로 기존 근로자 로그인', async () => {
    const worker = {
      id: 'w-google-1', email: 'user@gmail.com',
      name: '김구글', isActive: true, accountStatus: 'APPROVED', jobTitle: '목공',
    }
    auth.mockResolvedValue({ user: { email: 'user@gmail.com', name: '김구글' } })
    mockWorker.findFirst.mockResolvedValue(worker)

    const { GET } = await import('@/app/api/auth/complete/route')
    const res = await GET(makeRequest())

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/attendance')
  })

  it('Google 신규 사용자 register 모드 → PENDING 생성', async () => {
    mockCookiesGet.mockImplementation((name: string) =>
      name === 'auth_intent' ? { value: 'register' } : undefined
    )
    const newWorker = {
      id: 'w-google-2', email: 'new@gmail.com',
      name: '신구글', isActive: true, accountStatus: 'PENDING', jobTitle: '미설정',
    }
    auth.mockResolvedValue({ user: { email: 'new@gmail.com', name: '신구글' } })
    mockWorker.findFirst.mockResolvedValue(null)
    mockWorker.create.mockResolvedValue(newWorker)

    const { GET } = await import('@/app/api/auth/complete/route')
    const res = await GET(makeRequest('auth_intent=register'))

    expect(mockWorker.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ accountStatus: 'PENDING' }) })
    )
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/register/complete')
  })

  it('Google 로그인 모드에서 미등록 사용자 → register 유도', async () => {
    auth.mockResolvedValue({ user: { email: 'unknown@gmail.com', name: '미등록' } })
    mockWorker.findFirst.mockResolvedValue(null)

    const { GET } = await import('@/app/api/auth/complete/route')
    const res = await GET(makeRequest())

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('not_registered')
  })

  it('Google 관리자 이메일 → admin 처리', async () => {
    const admin = {
      id: 'a-google-1', email: 'admin@example.com',
      name: '구글관리자', isActive: true, role: 'SUPER_ADMIN',
    }
    auth.mockResolvedValue({ user: { email: 'admin@example.com', name: '구글관리자' } })
    mockAdmin.findUnique.mockResolvedValue(admin)
    mockAdmin.update.mockResolvedValue(admin)

    const { GET } = await import('@/app/api/auth/complete/route')
    const res = await GET(makeRequest())

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/admin')
  })

  it('비활성 Google 계정 차단', async () => {
    auth.mockResolvedValue({ user: { email: 'blocked@gmail.com', name: '차단됨' } })
    mockWorker.findFirst.mockResolvedValue({
      id: 'w-google-3', email: 'blocked@gmail.com',
      isActive: false, accountStatus: 'APPROVED', jobTitle: '목공',
    })

    const { GET } = await import('@/app/api/auth/complete/route')
    const res = await GET(makeRequest())

    expect(res.headers.get('location')).toContain('inactive')
  })
})

// ── 3. 보안 ──────────────────────────────────────────────────────────────────
describe('Google 로그인 보안', () => {
  it('GoogleSocialSection 소스에 secret 원문이 없다', () => {
    const src = fs.readFileSync(
      path.resolve('components/auth/GoogleSocialSection.tsx'), 'utf-8'
    )
    expect(src).not.toMatch(/GOCSPX-[A-Za-z0-9_-]{28}/)
    expect(src).not.toMatch(/[0-9]+-[A-Za-z0-9_-]{32}\.apps\.googleusercontent\.com/)
  })

  it('NextAuth config에 console.log(secret) 패턴이 없다', () => {
    const src = fs.readFileSync(
      path.resolve('lib/auth/nextauth.ts'), 'utf-8'
    )
    expect(src).not.toMatch(/console\.log.*secret/i)
    expect(src).not.toMatch(/console\.log.*client/i)
  })
})
