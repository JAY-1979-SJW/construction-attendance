'use client'

import { useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

function PwInput({ value, onChange, placeholder, onKeyDown }: {
  value: string; onChange: (v: string) => void; placeholder?: string; onKeyDown?: (e: React.KeyboardEvent) => void
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input type={show ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} autoComplete="new-password" onKeyDown={onKeyDown}
        className="w-full h-[50px] px-4 pr-12 text-[16px] bg-white border border-gray-200 rounded-2xl outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />
      <button type="button" onClick={() => setShow(!show)}
        className="absolute right-4 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-gray-400 p-1">
        {show ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
          : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
      </button>
    </div>
  )
}

const INPUT = "w-full h-[50px] px-4 text-[16px] bg-white border border-gray-200 rounded-2xl outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"

function Content() {
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
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ name, phone: phone.replace(/-/g, ''), password }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.message || '회원가입 실패'); setLoading(false); return }
      router.push('/m/register/pending')
    } catch { setError('서버 오류'); setLoading(false) }
  }

  return (
    <div className="px-5 py-8">
      <div className="flex items-center gap-2.5 mb-7">
        <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 22V12h6v10" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <span className="text-[16px] font-bold text-gray-900">해한<span className="text-orange-500">AI</span> 출퇴근</span>
      </div>

      <h1 className="text-[24px] font-bold text-gray-900 mb-1.5">회원가입</h1>
      <p className="text-[15px] text-gray-500 mb-6">핸드폰 번호로 간편하게 가입하세요.</p>
      {error && <div className="mb-5 rounded-2xl px-4 py-3.5 text-[14px] text-red-600 bg-red-50 border border-red-100">{error}</div>}

      <div className="space-y-3">
        <div>
          <label className="block text-[14px] font-semibold text-gray-700 mb-2">이름</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="홍길동" autoComplete="name" className={INPUT} />
        </div>
        <div>
          <label className="block text-[14px] font-semibold text-gray-700 mb-2">핸드폰 번호</label>
          <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="01012345678" autoComplete="tel" inputMode="numeric" className={INPUT} />
        </div>
        <div>
          <label className="block text-[14px] font-semibold text-gray-700 mb-2">비밀번호</label>
          <PwInput value={password} onChange={setPassword} placeholder="6자 이상" />
        </div>
        <div>
          <label className="block text-[14px] font-semibold text-gray-700 mb-2">비밀번호 확인</label>
          <PwInput value={passwordConfirm} onChange={setPasswordConfirm} placeholder="비밀번호 재입력"
            onKeyDown={e => e.key === 'Enter' && handleRegister()} />
        </div>
        <button onClick={handleRegister} disabled={loading}
          className="w-full h-[50px] text-[16px] font-bold text-white bg-orange-500 active:bg-orange-600 rounded-2xl border-none cursor-pointer disabled:opacity-50">
          {loading ? '가입 중...' : '회원가입'}
        </button>
      </div>

      <div className="flex justify-center gap-4 mt-6 text-[13px]">
        <Link href="/m/login" className="text-gray-500 no-underline">이미 계정이 있으신가요? 로그인</Link>
      </div>
    </div>
  )
}

export default function MobileRegisterPage() { return <Suspense><Content /></Suspense> }
