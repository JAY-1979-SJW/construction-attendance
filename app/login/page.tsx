'use client'

import { signIn } from 'next-auth/react'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AuthPageShell } from '@/components/auth/AuthPageShell'
import { AuthCard, AuthBrand, AuthTitle, AuthError, AuthFooter } from '@/components/auth/AuthCard'

type Role = null | 'worker' | 'business'

const ERROR_MSG: Record<string, string> = {
  no_email: '이메일 정보를 가져올 수 없습니다.',
  inactive: '비활성화된 계정입니다. 관리자에게 문의하세요.',
  server: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
}

function PasswordInput({ value, onChange, placeholder, onKeyDown }: {
  value: string; onChange: (v: string) => void; placeholder?: string; onKeyDown?: (e: React.KeyboardEvent) => void
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input type={show ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} autoComplete="current-password" onKeyDown={onKeyDown}
        className="w-full h-12 px-4 pr-12 text-[15px] text-fore-brand bg-card border border-brand rounded-[10px] outline-none placeholder:text-muted2-brand focus:border-accent focus:ring-2 focus:ring-[rgba(249,115,22,0.12)]" />
      <button type="button" onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-muted-brand hover:text-fore-brand p-1">
        {show ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        )}
      </button>
    </div>
  )
}

function LoginContent() {
  const router = useRouter()
  const params = useSearchParams()
  const errorKey = params.get('error') ?? ''

  const [role, setRole] = useState<Role>(null)
  const [loading, setLoading] = useState<string | null>(null)

  // 이메일/비번 상태
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleOAuth = (provider: string) => {
    setLoading(provider)
    signIn(provider, { callbackUrl: '/api/auth/complete' })
  }

  const handleEmailLogin = async () => {
    if (!email || !password) { setError('이메일과 비밀번호를 입력하세요.'); return }
    setLoading('email')
    setError('')
    try {
      const res = await fetch('/api/auth/worker-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.message || '로그인에 실패했습니다.')
        setLoading(null)
        return
      }
      // 승인 대기 중인 경우
      if (json.data?.accountStatus === 'PENDING') {
        router.push('/register/pending')
        return
      }
      router.push('/attendance')
    } catch {
      setError('서버 오류가 발생했습니다.')
      setLoading(null)
    }
  }

  const handleBusinessLogin = async () => {
    if (!email || !password) { setError('이메일과 비밀번호를 입력하세요.'); return }
    setLoading('business')
    setError('')
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.message || '로그인에 실패했습니다.')
        setLoading(null)
        return
      }
      router.push(json.portal || '/admin')
    } catch {
      setError('서버 오류가 발생했습니다.')
      setLoading(null)
    }
  }

  // ── 역할 미선택: 역할 선택 화면 ──
  if (!role) {
    return (
      <AuthPageShell>
        <AuthCard>
          <AuthBrand />
          <AuthTitle title="로그인" description="근로자 또는 사업자를 선택해 주세요." />
          <AuthError message={ERROR_MSG[errorKey] ?? (errorKey ? '로그인 중 오류가 발생했습니다.' : '')} />

          <div className="space-y-3">
            <button
              onClick={() => setRole('worker')}
              className="w-full py-5 rounded-[14px] border-2 border-brand bg-card text-left px-5 hover:border-accent hover:bg-accent-light transition-all cursor-pointer"
            >
              <div className="text-[16px] font-bold text-fore-brand mb-1">근로자</div>
              <div className="text-[12px] text-muted-brand">현장 출퇴근, 작업일보, 서류 제출</div>
            </button>
            <button
              onClick={() => setRole('business')}
              className="w-full py-5 rounded-[14px] border-2 border-brand bg-card text-left px-5 hover:border-accent hover:bg-accent-light transition-all cursor-pointer"
            >
              <div className="text-[16px] font-bold text-fore-brand mb-1">사업자 (업체 관리자)</div>
              <div className="text-[12px] text-muted-brand">근로자 관리, 출퇴근 현황, 급여·보험</div>
            </button>
          </div>

          <div className="mt-5 text-center">
            <a href="/guide" className="text-[13px] text-accent font-medium no-underline hover:underline">
              가입 없이 둘러보기 →
            </a>
          </div>

          <AuthFooter links={[
            { label: '회원가입', href: '/register' },
            { label: '메인으로 돌아가기', href: '/' },
          ]} />
        </AuthCard>
      </AuthPageShell>
    )
  }

  // ── 사업자 로그인 ──
  if (role === 'business') {
    return (
      <AuthPageShell>
        <AuthCard>
          <AuthBrand />
          <div className="mb-5">
            <button onClick={() => { setRole(null); setError('') }} className="text-[12px] text-muted-brand hover:text-accent bg-transparent border-none cursor-pointer p-0">← 뒤로</button>
          </div>
          <AuthTitle title="사업자 로그인" description="업체 관리자 이메일과 비밀번호로 로그인합니다." />
          <AuthError message={error} />

          <div className="space-y-4">
            <div>
              <label className="block text-[13px] font-semibold text-body-brand mb-[6px]">이메일</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="company@example.com" autoComplete="email"
                className="w-full h-12 px-4 text-[15px] text-fore-brand bg-card border border-brand rounded-[10px] outline-none placeholder:text-muted2-brand focus:border-accent focus:ring-2 focus:ring-[rgba(249,115,22,0.12)]" />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-body-brand mb-[6px]">비밀번호</label>
              <PasswordInput value={password} onChange={setPassword} placeholder="비밀번호 입력" onKeyDown={e => e.key === 'Enter' && handleBusinessLogin()} />
            </div>
            <button onClick={handleBusinessLogin} disabled={!!loading}
              className="w-full h-12 text-[15px] font-semibold text-white bg-brand-accent hover:bg-brand-accent-hover rounded-[12px] transition-colors shadow-[0_2px_10px_rgba(249,115,22,0.25)] disabled:opacity-50 border-none cursor-pointer">
              {loading === 'business' ? '로그인 중...' : '로그인'}
            </button>
          </div>

          <AuthFooter links={[
            { label: '사업자 가입 신청', href: '/register/company-admin' },
          ]} />
        </AuthCard>
      </AuthPageShell>
    )
  }

  // ── 근로자 로그인 (이메일/비번 + OAuth) ──
  return (
    <AuthPageShell>
      <AuthCard>
        <AuthBrand />
        <div className="mb-5">
          <button onClick={() => { setRole(null); setError('') }} className="text-[12px] text-muted-brand hover:text-accent bg-transparent border-none cursor-pointer p-0">← 뒤로</button>
        </div>
        <AuthTitle title="근로자 로그인" description="이메일/비밀번호 또는 소셜 계정으로 로그인합니다." />
        <AuthError message={error || (ERROR_MSG[errorKey] ?? (errorKey ? '로그인 중 오류가 발생했습니다.' : ''))} />

        {/* 이메일/비밀번호 */}
        <div className="space-y-3 mb-5">
          <div>
            <label className="block text-[13px] font-semibold text-body-brand mb-[6px]">이메일</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="name@example.com" autoComplete="email"
              className="w-full h-12 px-4 text-[15px] text-fore-brand bg-card border border-brand rounded-[10px] outline-none placeholder:text-muted2-brand focus:border-accent focus:ring-2 focus:ring-[rgba(249,115,22,0.12)]" />
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-body-brand mb-[6px]">비밀번호</label>
            <PasswordInput value={password} onChange={setPassword} placeholder="비밀번호 입력" onKeyDown={e => e.key === 'Enter' && handleEmailLogin()} />
          </div>
          <button onClick={handleEmailLogin} disabled={!!loading}
            className="w-full h-12 text-[15px] font-semibold text-white bg-brand-accent hover:bg-brand-accent-hover rounded-[12px] transition-colors shadow-[0_2px_10px_rgba(249,115,22,0.25)] disabled:opacity-50 border-none cursor-pointer">
            {loading === 'email' ? '로그인 중...' : '이메일로 로그인'}
          </button>
        </div>

        {/* 구분선 */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-brand" />
          <span className="text-[11px] text-muted2-brand">또는</span>
          <div className="flex-1 h-px bg-brand" />
        </div>

        {/* OAuth */}
        <div className="space-y-3">
          <button onClick={() => handleOAuth('google')} disabled={!!loading}
            className="w-full h-12 rounded-[10px] font-semibold text-[14px] flex items-center justify-center gap-3 transition-all border border-brand bg-card text-fore-brand hover:bg-surface disabled:opacity-60 shadow-[0_1px_3px_rgba(0,0,0,0.06)] cursor-pointer">
            {loading === 'google'
              ? <span className="w-5 h-5 border-2 border-brand border-t-muted-brand rounded-full animate-spin" />
              : <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
            }
            Google로 로그인
          </button>

          <button onClick={() => handleOAuth('kakao')} disabled={!!loading}
            className="w-full h-12 rounded-[10px] font-semibold text-[14px] flex items-center justify-center gap-3 transition-all disabled:opacity-60 cursor-pointer border-none"
            style={{ background: '#FEE500', color: '#191919' }}>
            {loading === 'kakao'
              ? <span className="w-5 h-5 border-2 border-yellow-400 border-t-yellow-700 rounded-full animate-spin" />
              : <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="#191919">
                  <path d="M12 3C6.48 3 2 6.73 2 11.35c0 2.99 1.87 5.62 4.69 7.13l-1.2 4.41 5.13-3.4c.45.06.91.09 1.38.09 5.52 0 10-3.73 10-8.32C22 6.73 17.52 3 12 3z"/>
                </svg>
            }
            카카오로 로그인
          </button>
        </div>

        <p className="text-center text-[11px] text-muted2-brand mt-5">
          위치 정보는 출퇴근 판정에만 사용됩니다
        </p>

        <AuthFooter links={[
          { label: '회원가입', href: '/register' },
          { label: '사용 가이드', href: '/guide' },
        ]} />
      </AuthCard>
    </AuthPageShell>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
