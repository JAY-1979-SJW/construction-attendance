'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AuthPageShell } from '@/components/auth/AuthPageShell'
import { AuthCard, AuthBrand, AuthTitle, AuthError, AuthFooter } from '@/components/auth/AuthCard'

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

  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (errorKey) return
    fetch('/api/auth/me', { credentials: 'include' }).then(r => r.json()).then(d => {
      if (d.success) router.replace('/attendance')
    }).catch(() => {})
  }, [router, errorKey])

  const handleLogin = async () => {
    if (!phone || !password) { setError('핸드폰 번호와 비밀번호를 입력하세요.'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/worker-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone: phone.replace(/-/g, ''), password }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.message || '로그인에 실패했습니다.')
        setLoading(false)
        return
      }
      if (json.data?.accountStatus === 'PENDING') {
        router.push('/register/pending')
        return
      }
      router.push('/attendance')
    } catch {
      setError('서버 오류가 발생했습니다.')
      setLoading(false)
    }
  }

  return (
    <AuthPageShell>
      <AuthCard>
        <AuthBrand />
        <AuthTitle title="로그인" description="핸드폰 번호와 비밀번호를 입력하세요." />
        <AuthError message={errorKey === 'inactive' ? '비활성화된 계정입니다.' : errorKey ? '로그인 중 오류가 발생했습니다.' : error} />

        <div className="space-y-4">
          <div>
            <label className="block text-[13px] font-semibold text-body-brand mb-[6px]">핸드폰 번호</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="01012345678" autoComplete="tel" inputMode="numeric"
              className="w-full h-12 px-4 text-[15px] text-fore-brand bg-card border border-brand rounded-[10px] outline-none placeholder:text-muted2-brand focus:border-accent focus:ring-2 focus:ring-[rgba(249,115,22,0.12)]" />
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-body-brand mb-[6px]">비밀번호</label>
            <PasswordInput value={password} onChange={setPassword} placeholder="비밀번호 입력" onKeyDown={e => e.key === 'Enter' && handleLogin()} />
          </div>
          <button onClick={handleLogin} disabled={loading}
            className="w-full h-12 text-[15px] font-semibold text-white bg-brand-accent hover:bg-brand-accent-hover rounded-[12px] transition-colors shadow-[0_2px_10px_rgba(249,115,22,0.25)] disabled:opacity-50 border-none cursor-pointer">
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </div>

        <AuthFooter links={[
          { label: '회원가입', href: '/register' },
          { label: '메인으로 돌아가기', href: '/' },
        ]} />
      </AuthCard>
    </AuthPageShell>
  )
}

export default function LoginPage() {
  return <Suspense><LoginContent /></Suspense>
}
