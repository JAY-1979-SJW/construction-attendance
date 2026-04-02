'use client'

import { signIn } from 'next-auth/react'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

type Role = null | 'worker' | 'business'

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
  const [role, setRole] = useState<Role>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  // 이미 로그인된 경우 출퇴근 페이지로 자동 이동
  useEffect(() => {
    if (errorKey) return
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.success) router.replace('/attendance')
    }).catch(() => {})
  }, [router, errorKey])

  const handleOAuth = (p: string) => { setLoading(p); signIn(p, { callbackUrl: '/api/auth/complete' }) }

  const handleEmailLogin = async () => {
    if (!email || !password) { setError('이메일과 비밀번호를 입력하세요.'); return }
    setLoading('email'); setError('')
    try {
      const res = await fetch('/api/auth/worker-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
      const json = await res.json()
      if (!res.ok) { setError(json.message || '로그인 실패'); setLoading(null); return }
      if (json.data?.accountStatus === 'PENDING') { router.push('/m/register/pending'); return }
      router.push('/attendance')
    } catch { setError('서버 오류'); setLoading(null) }
  }

  const handleBusinessLogin = async () => {
    if (!email || !password) { setError('이메일과 비밀번호를 입력하세요.'); return }
    setLoading('biz'); setError('')
    try {
      const res = await fetch('/api/admin/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
      const json = await res.json()
      if (!res.ok) { setError(json.message || '로그인 실패'); setLoading(null); return }
      router.push(json.portal || '/admin')
    } catch { setError('서버 오류'); setLoading(null) }
  }

  const errMsg = error || (errorKey === 'no_email' ? '이메일 정보를 가져올 수 없습니다.' : errorKey === 'inactive' ? '비활성화된 계정입니다.' : errorKey ? '로그인 중 오류' : '')

  // ── 역할 선택 ──
  if (!role) return (
    <div className="px-5 py-8">
      <Logo />
      <h1 className="text-[24px] font-bold text-gray-900 mb-1.5">로그인</h1>
      <p className="text-[15px] text-gray-500 mb-7">사용자 유형을 선택해 주세요.</p>
      {errMsg && <Err msg={errMsg} />}
      <div className="space-y-3 mb-6">
        <RoleBtn onClick={() => setRole('worker')} title="근로자" desc="현장 출퇴근, 작업일보, 서류 제출" />
        <RoleBtn onClick={() => setRole('business')} title="사업자" desc="근로자 관리, 출퇴근 현황, 급여·보험" />
      </div>
      <Link href="/m/guide" className="block text-center text-[14px] text-orange-500 font-semibold no-underline py-3 active:opacity-70">가입 없이 둘러보기 →</Link>
      <div className="flex justify-center gap-4 mt-4 text-[13px]">
        <Link href="/m/register" className="text-gray-500 no-underline">회원가입</Link>
        <Link href="/m" className="text-gray-500 no-underline">메인으로</Link>
      </div>
    </div>
  )

  // ── 사업자 ──
  if (role === 'business') return (
    <div className="px-5 py-8">
      <Back onClick={() => { setRole(null); setError('') }} />
      <Logo />
      <h1 className="text-[24px] font-bold text-gray-900 mb-1.5">사업자 로그인</h1>
      <p className="text-[15px] text-gray-500 mb-6">이메일과 비밀번호로 로그인합니다.</p>
      {errMsg && <Err msg={errMsg} />}
      <div className="space-y-3">
        <Lbl text="이메일"><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="company@example.com" className={INPUT} /></Lbl>
        <Lbl text="비밀번호"><PwInput value={password} onChange={setPassword} placeholder="비밀번호" onKeyDown={e => e.key === 'Enter' && handleBusinessLogin()} /></Lbl>
        <Btn onClick={handleBusinessLogin} loading={loading === 'biz'}>로그인</Btn>
      </div>
      <div className="text-center mt-5"><Link href="/m/register/company-admin" className="text-[13px] text-gray-500 no-underline">사업자 가입 신청</Link></div>
    </div>
  )

  // ── 근로자 ──
  return (
    <div className="px-5 py-8">
      <Back onClick={() => { setRole(null); setError('') }} />
      <Logo />
      <h1 className="text-[24px] font-bold text-gray-900 mb-1.5">근로자 로그인</h1>
      <p className="text-[15px] text-gray-500 mb-5">이메일 또는 소셜 계정으로 로그인합니다.</p>
      {errMsg && <Err msg={errMsg} />}

      <div className="space-y-3 mb-5">
        <Lbl text="이메일"><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" className={INPUT} /></Lbl>
        <Lbl text="비밀번호"><PwInput value={password} onChange={setPassword} placeholder="비밀번호" onKeyDown={e => e.key === 'Enter' && handleEmailLogin()} /></Lbl>
        <Btn onClick={handleEmailLogin} loading={loading === 'email'}>이메일로 로그인</Btn>
      </div>

      <div className="flex items-center gap-3 my-6">
        <div className="flex-1 h-px bg-gray-200" /><span className="text-[12px] text-gray-400">또는</span><div className="flex-1 h-px bg-gray-200" />
      </div>

      <div className="space-y-2.5">
        <button onClick={() => handleOAuth('google')} disabled={!!loading}
          className="w-full h-[50px] rounded-2xl text-[15px] font-semibold flex items-center justify-center gap-3 border border-gray-200 bg-white text-gray-700 active:bg-gray-50 disabled:opacity-50 cursor-pointer">
          Google로 로그인
        </button>
        <button onClick={() => handleOAuth('kakao')} disabled={!!loading}
          className="w-full h-[50px] rounded-2xl text-[15px] font-semibold flex items-center justify-center gap-3 disabled:opacity-50 cursor-pointer border-none"
          style={{ background: '#FEE500', color: '#191919' }}>
          카카오로 로그인
        </button>
      </div>

      <p className="text-center text-[12px] text-gray-400 mt-5">위치 정보는 출퇴근 판정에만 사용됩니다</p>
      <div className="flex justify-center gap-4 mt-3 text-[13px]">
        <Link href="/m/register" className="text-gray-500 no-underline">회원가입</Link>
        <Link href="/m/guide" className="text-gray-500 no-underline">사용 가이드</Link>
      </div>
    </div>
  )
}

// ── 모바일 공통 UI ──
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
function Back({ onClick }: { onClick: () => void }) { return <button onClick={onClick} className="text-[14px] text-gray-400 active:text-gray-600 bg-transparent border-none cursor-pointer p-0 mb-5">← 뒤로</button> }
function Err({ msg }: { msg: string }) { return <div className="mb-5 rounded-2xl px-4 py-3.5 text-[14px] text-red-600 bg-red-50 border border-red-100">{msg}</div> }
function Lbl({ text, children }: { text: string; children: React.ReactNode }) { return <div><label className="block text-[14px] font-semibold text-gray-700 mb-2">{text}</label>{children}</div> }
function Btn({ children, onClick, loading }: { children: React.ReactNode; onClick: () => void; loading?: boolean }) {
  return <button onClick={onClick} disabled={loading} className="w-full h-[50px] text-[16px] font-bold text-white bg-orange-500 active:bg-orange-600 rounded-2xl border-none cursor-pointer disabled:opacity-50">{loading ? '처리 중...' : children}</button>
}
function RoleBtn({ onClick, title, desc }: { onClick: () => void; title: string; desc: string }) {
  return (
    <button onClick={onClick} className="w-full py-5 px-5 rounded-2xl border-2 border-gray-200 bg-white text-left active:bg-gray-50 cursor-pointer">
      <div className="text-[16px] font-bold text-gray-900">{title}</div>
      <div className="text-[13px] text-gray-500 mt-1">{desc}</div>
    </button>
  )
}

export default function MobileLoginPage() { return <Suspense><LoginContent /></Suspense> }
