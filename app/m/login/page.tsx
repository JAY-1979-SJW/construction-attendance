'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

type Tab = 'phone' | 'email'

function PwInput({ value, onChange, placeholder, onKeyDown }: {
  value: string; onChange: (v: string) => void; placeholder?: string; onKeyDown?: (e: React.KeyboardEvent) => void
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input type={show ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} autoComplete="current-password" onKeyDown={onKeyDown}
        className="w-full h-[50px] px-4 pr-12 text-[16px] bg-white border border-gray-200 rounded-2xl outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />
      <button type="button" onClick={() => setShow(!show)}
        className="absolute right-4 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-gray-400 p-1">
        {show
          ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
          : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
      </button>
    </div>
  )
}

const INPUT = "w-full h-[50px] px-4 text-[16px] bg-white border border-gray-200 rounded-2xl outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"

function LoginContent() {
  const router = useRouter()
  const params = useSearchParams()
  const errorKey = params.get('error') ?? ''
  const [tab, setTab] = useState<Tab>('phone')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (errorKey) return
    fetch('/api/auth/me', { credentials: 'include' }).then(r => r.json()).then(d => {
      if (d.success) router.replace('/attendance')
    }).catch(() => {})
  }, [router, errorKey])

  const switchTab = (t: Tab) => { setTab(t); setError(''); setPassword('') }

  const handlePhoneLogin = async () => {
    if (!phone || !password) { setError('핸드폰 번호와 비밀번호를 입력하세요.'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/worker-login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ phone: phone.replace(/-/g, ''), password }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.message || '로그인 실패'); setLoading(false); return }
      if (json.data?.accountStatus === 'PENDING') { router.push('/m/register/pending'); return }
      router.push('/attendance')
    } catch { setError('서버 오류'); setLoading(false) }
  }

  const handleEmailLogin = async () => {
    if (!email || !password) { setError('이메일과 비밀번호를 입력하세요.'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.message || '로그인 실패'); setLoading(false); return }
      router.push(json.portal || '/admin')
    } catch { setError('서버 오류'); setLoading(false) }
  }

  const globalError = errorKey === 'inactive' ? '비활성화된 계정입니다.' : errorKey ? '로그인 중 오류' : ''

  return (
    <div className="px-5 py-8">
      <Logo />

      {/* 탭 */}
      <div className="flex mb-6 border-b border-gray-200">
        <button onClick={() => switchTab('phone')}
          className={`flex-1 pb-3 text-[15px] font-semibold border-b-2 transition-colors bg-transparent cursor-pointer ${tab === 'phone' ? 'border-orange-500 text-orange-500' : 'border-transparent text-gray-400'}`}>
          핸드폰 로그인
        </button>
        <button onClick={() => switchTab('email')}
          className={`flex-1 pb-3 text-[15px] font-semibold border-b-2 transition-colors bg-transparent cursor-pointer ${tab === 'email' ? 'border-orange-500 text-orange-500' : 'border-transparent text-gray-400'}`}>
          이메일 로그인
        </button>
      </div>

      {(globalError || error) && <div className="mb-5 rounded-2xl px-4 py-3.5 text-[14px] text-red-600 bg-red-50 border border-red-100">{globalError || error}</div>}

      {/* 핸드폰 로그인 탭 */}
      {tab === 'phone' && (
        <>
          <p className="text-[14px] text-gray-500 mb-4">근로자 계정으로 로그인합니다.</p>
          <div className="space-y-3">
            <div>
              <label className="block text-[14px] font-semibold text-gray-700 mb-2">핸드폰 번호</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="01012345678" autoComplete="tel" inputMode="numeric" className={INPUT} />
            </div>
            <div>
              <label className="block text-[14px] font-semibold text-gray-700 mb-2">비밀번호</label>
              <PwInput value={password} onChange={setPassword} placeholder="비밀번호" onKeyDown={e => e.key === 'Enter' && handlePhoneLogin()} />
            </div>
            <button onClick={handlePhoneLogin} disabled={loading}
              className="w-full h-[50px] text-[16px] font-bold text-white bg-orange-500 active:bg-orange-600 rounded-2xl border-none cursor-pointer disabled:opacity-50">
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </div>
          <div className="flex justify-center gap-4 mt-6 text-[13px]">
            <Link href="/m/register" className="text-gray-500 no-underline">회원가입</Link>
            <Link href="/m" className="text-gray-500 no-underline">메인으로</Link>
          </div>
        </>
      )}

      {/* 이메일 로그인 탭 */}
      {tab === 'email' && (
        <>
          <p className="text-[14px] text-gray-500 mb-4">관리자 / 사업자 계정으로 로그인합니다.</p>
          <div className="space-y-3">
            <div>
              <label className="block text-[14px] font-semibold text-gray-700 mb-2">이메일</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="admin@example.com" autoComplete="email" className={INPUT} />
            </div>
            <div>
              <label className="block text-[14px] font-semibold text-gray-700 mb-2">비밀번호</label>
              <PwInput value={password} onChange={setPassword} placeholder="비밀번호" onKeyDown={e => e.key === 'Enter' && handleEmailLogin()} />
            </div>
            <button onClick={handleEmailLogin} disabled={loading}
              className="w-full h-[50px] text-[16px] font-bold text-white bg-orange-500 active:bg-orange-600 rounded-2xl border-none cursor-pointer disabled:opacity-50">
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </div>
          <div className="flex justify-center gap-4 mt-6 text-[13px]">
            <Link href="/m/register/company-admin" className="text-gray-500 no-underline">사업자 가입 신청</Link>
            <Link href="/m" className="text-gray-500 no-underline">메인으로</Link>
          </div>
        </>
      )}
    </div>
  )
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5 mb-7">
      <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 22V12h6v10" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </div>
      <span className="text-[16px] font-bold text-gray-900">해한<span className="text-orange-500">AI</span> 출퇴근</span>
    </div>
  )
}

export default function MobileLoginPage() { return <Suspense><LoginContent /></Suspense> }
