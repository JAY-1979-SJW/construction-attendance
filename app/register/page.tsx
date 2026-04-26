'use client'

import { useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { AuthPageShell } from '@/components/auth/AuthPageShell'
import { AuthCard, AuthBrand, AuthTitle, AuthError, AuthFooter } from '@/components/auth/AuthCard'
import { KakaoSocialSection } from '@/components/auth/KakaoSocialSection'
import { GoogleSocialSection } from '@/components/auth/GoogleSocialSection'

function PasswordInput({ value, onChange, placeholder, onKeyDown }: {
  value: string; onChange: (v: string) => void; placeholder?: string; onKeyDown?: (e: React.KeyboardEvent) => void
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input type={show ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} autoComplete="new-password" onKeyDown={onKeyDown}
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

function RegisterContent() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRegister = async () => {
    if (!name || !phone || !password) { setError('모든 항목을 입력하세요.'); return }
    if (password !== passwordConfirm) { setError('비밀번호가 일치하지 않습니다.'); return }
    if (password.length < 6) { setError('비밀번호는 6자 이상이어야 합니다.'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/worker-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, phone: phone.replace(/-/g, ''), password }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.message || '회원가입에 실패했습니다.'); setLoading(false); return }
      router.push('/register/pending')
    } catch {
      setError('서버 오류가 발생했습니다.')
      setLoading(false)
    }
  }

  const INPUT = "w-full h-12 px-4 text-[15px] text-fore-brand bg-card border border-brand rounded-[10px] outline-none placeholder:text-muted2-brand focus:border-accent focus:ring-2 focus:ring-[rgba(249,115,22,0.12)]"

  return (
    <AuthPageShell>
      <AuthCard>
        <AuthBrand />
        <AuthTitle title="회원가입" description="핸드폰 번호로 간편하게 가입하세요." />
        <AuthError message={error} />

        <div className="space-y-4">
          <div>
            <label className="block text-[13px] font-semibold text-body-brand mb-[6px]">이름</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="홍길동" autoComplete="name" className={INPUT} />
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-body-brand mb-[6px]">핸드폰 번호</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="01012345678" autoComplete="tel" inputMode="numeric" className={INPUT} />
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-body-brand mb-[6px]">비밀번호</label>
            <PasswordInput value={password} onChange={setPassword} placeholder="6자 이상" />
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-body-brand mb-[6px]">비밀번호 확인</label>
            <PasswordInput value={passwordConfirm} onChange={setPasswordConfirm} placeholder="비밀번호 재입력"
              onKeyDown={e => e.key === 'Enter' && handleRegister()} />
          </div>
          <button onClick={handleRegister} disabled={loading}
            className="w-full h-12 text-[15px] font-semibold text-white bg-brand-accent hover:bg-brand-accent-hover rounded-[12px] transition-colors shadow-[0_2px_10px_rgba(249,115,22,0.25)] disabled:opacity-50 border-none cursor-pointer">
            {loading ? '가입 중...' : '회원가입'}
          </button>
        </div>

        <KakaoSocialSection mode="register" />
        <GoogleSocialSection mode="register" />
        <AuthFooter links={[
          { label: '이미 계정이 있으신가요? 로그인', href: '/login' },
        ]} />
      </AuthCard>
    </AuthPageShell>
  )
}

export default function RegisterPage() {
  return <Suspense><RegisterContent /></Suspense>
}
