'use client'

import { signIn } from 'next-auth/react'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function PwInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input type={show ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full h-[50px] px-4 pr-12 text-[16px] bg-white border border-gray-200 rounded-2xl outline-none focus:border-orange-400" />
      <button type="button" onClick={() => setShow(!show)} className="absolute right-4 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-gray-400 p-1">
        {show ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
          : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
      </button>
    </div>
  )
}

type Method = 'select' | 'oauth' | 'email'

function Content() {
  const router = useRouter()
  const params = useSearchParams()
  const [method, setMethod] = useState<Method>('select')
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState(params.get('error') ? '가입 중 오류가 발생했습니다.' : '')
  const [consentTerms, setConsentTerms] = useState(false)
  const [consentPrivacy, setConsentPrivacy] = useState(false)
  const [consentMarketing, setConsentMarketing] = useState(false)
  const allReq = consentTerms && consentPrivacy
  const allChk = consentTerms && consentPrivacy && consentMarketing

  const [regEmail, setRegEmail] = useState('')
  const [regPw, setRegPw] = useState('')
  const [regPw2, setRegPw2] = useState('')
  const [regName, setRegName] = useState('')
  const [regPhone, setRegPhone] = useState('')
  const [regJob, setRegJob] = useState('')
  const [regBirth, setRegBirth] = useState('')

  function checkAll(v: boolean) { setConsentTerms(v); setConsentPrivacy(v); setConsentMarketing(v) }

  function handleOAuth(p: string) {
    if (!allReq) { setError('필수 약관에 동의해 주세요.'); return }
    setLoading(p)
    fetch('/api/auth/register-intent', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ consent: JSON.stringify({ terms: consentTerms, privacy: consentPrivacy, marketing: consentMarketing }) }) })
      .then(() => signIn(p, { callbackUrl: '/api/auth/complete' }))
  }

  async function handleEmailReg() {
    if (!allReq) { setError('필수 약관에 동의해 주세요.'); return }
    if (!regEmail || !regPw || !regName || !regJob) { setError('필수 항목을 모두 입력하세요.'); return }
    if (regPw.length < 6) { setError('비밀번호 6자 이상'); return }
    if (regPw !== regPw2) { setError('비밀번호 불일치'); return }
    setError(''); setLoading('email')
    try {
      const res = await fetch('/api/auth/worker-register', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: regEmail, password: regPw, name: regName, phone: regPhone || undefined, jobTitle: regJob, birthDate: regBirth || undefined }) })
      const j = await res.json()
      if (!res.ok) { setError(j.message || '가입 실패'); setLoading(null); return }
      router.push('/m/register/pending')
    } catch { setError('서버 오류'); setLoading(null) }
  }

  const INPUT = "w-full h-[50px] px-4 text-[16px] bg-white border border-gray-200 rounded-2xl outline-none focus:border-orange-400"

  if (method === 'select') return (
    <div className="px-5 py-8">
      <h1 className="text-[24px] font-bold text-gray-900 mb-1.5">회원가입</h1>
      <p className="text-[15px] text-gray-500 mb-7">가입 유형을 선택해 주세요.</p>
      <div className="space-y-3 mb-6">
        <Btn2 onClick={() => setMethod('oauth')} title="근로자 — 소셜 가입" desc="Google 또는 카카오로 간편 가입" />
        <Btn2 onClick={() => setMethod('email')} title="근로자 — 이메일 가입" desc="이메일과 비밀번호로 직접 가입" />
        <Link href="/m/register/company-admin" className="block w-full py-5 px-5 rounded-2xl border-2 border-gray-200 bg-white no-underline active:bg-gray-50">
          <div className="text-[16px] font-bold text-gray-900">사업자 (업체 관리자)</div>
          <div className="text-[13px] text-gray-500 mt-1">사업자등록번호로 가입</div>
        </Link>
      </div>
      <Link href="/m/login" className="block text-center text-[14px] text-gray-500 no-underline">이미 계정이 있으신가요? 로그인</Link>
    </div>
  )

  if (method === 'email') return (
    <div className="px-5 py-8">
      <button onClick={() => setMethod('select')} className="text-[14px] text-gray-400 bg-transparent border-none cursor-pointer p-0 mb-5">← 뒤로</button>
      <h1 className="text-[24px] font-bold text-gray-900 mb-5">이메일로 가입</h1>
      {error && <div className="mb-4 rounded-2xl px-4 py-3.5 text-[14px] text-red-600 bg-red-50 border border-red-100">{error}</div>}
      <div className="space-y-3 mb-5">
        <Lbl t="이메일 *"><input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} placeholder="name@example.com" className={INPUT} /></Lbl>
        <Lbl t="비밀번호 * (6자 이상)"><PwInput value={regPw} onChange={setRegPw} placeholder="비밀번호" /></Lbl>
        <Lbl t="비밀번호 확인 *"><PwInput value={regPw2} onChange={setRegPw2} placeholder="비밀번호 다시 입력" /></Lbl>
        <Lbl t="이름 (실명) *"><input value={regName} onChange={e => setRegName(e.target.value)} placeholder="홍길동" className={INPUT} /></Lbl>
        <Lbl t="직종 *"><input value={regJob} onChange={e => setRegJob(e.target.value)} placeholder="형틀목공, 전기공 등" className={INPUT} /></Lbl>
        <Lbl t="전화번호"><input value={regPhone} onChange={e => setRegPhone(e.target.value)} placeholder="01012345678" maxLength={11} inputMode="numeric" className={INPUT} /></Lbl>
        <Lbl t="생년월일"><input type="date" value={regBirth} onChange={e => setRegBirth(e.target.value)} className={INPUT} /></Lbl>
      </div>
      <Consent allChk={allChk} onAll={checkAll} items={[
        { l: '서비스 이용약관 (필수)', c: consentTerms, s: setConsentTerms },
        { l: '개인정보 수집·이용 동의 (필수)', c: consentPrivacy, s: setConsentPrivacy },
        { l: '마케팅 정보 수신 (선택)', c: consentMarketing, s: setConsentMarketing },
      ]} />
      <button onClick={handleEmailReg} disabled={!!loading || !allReq}
        className="w-full h-[50px] text-[16px] font-bold text-white bg-orange-500 active:bg-orange-600 rounded-2xl border-none cursor-pointer disabled:opacity-50 mt-4">
        {loading === 'email' ? '처리 중...' : '가입하기'}
      </button>
    </div>
  )

  // OAuth
  return (
    <div className="px-5 py-8">
      <button onClick={() => setMethod('select')} className="text-[14px] text-gray-400 bg-transparent border-none cursor-pointer p-0 mb-5">← 뒤로</button>
      <h1 className="text-[24px] font-bold text-gray-900 mb-5">소셜 계정으로 가입</h1>
      {error && <div className="mb-4 rounded-2xl px-4 py-3.5 text-[14px] text-red-600 bg-red-50 border border-red-100">{error}</div>}
      <Consent allChk={allChk} onAll={checkAll} items={[
        { l: '서비스 이용약관 (필수)', c: consentTerms, s: setConsentTerms },
        { l: '개인정보 수집·이용 동의 (필수)', c: consentPrivacy, s: setConsentPrivacy },
        { l: '마케팅 정보 수신 (선택)', c: consentMarketing, s: setConsentMarketing },
      ]} />
      <div className="space-y-2.5 mt-5">
        <button onClick={() => handleOAuth('google')} disabled={!!loading || !allReq}
          className="w-full h-[50px] rounded-2xl text-[15px] font-semibold border border-gray-200 bg-white text-gray-700 disabled:opacity-40 cursor-pointer">Google로 가입</button>
        <button onClick={() => handleOAuth('kakao')} disabled={!!loading || !allReq}
          className="w-full h-[50px] rounded-2xl text-[15px] font-semibold disabled:opacity-40 cursor-pointer border-none" style={{ background: '#FEE500', color: '#191919' }}>카카오로 가입</button>
      </div>
      {!allReq && <p className="text-[12px] text-gray-400 text-center mt-3">필수 약관에 동의하면 버튼이 활성화됩니다.</p>}
    </div>
  )
}

function Btn2({ onClick, title, desc }: { onClick: () => void; title: string; desc: string }) {
  return <button onClick={onClick} className="w-full py-5 px-5 rounded-2xl border-2 border-gray-200 bg-white text-left active:bg-gray-50 cursor-pointer">
    <div className="text-[16px] font-bold text-gray-900">{title}</div><div className="text-[13px] text-gray-500 mt-1">{desc}</div></button>
}
function Lbl({ t, children }: { t: string; children: React.ReactNode }) { return <div><label className="block text-[14px] font-semibold text-gray-700 mb-2">{t}</label>{children}</div> }
function Consent({ allChk, onAll, items }: { allChk: boolean; onAll: (v: boolean) => void; items: { l: string; c: boolean; s: (v: boolean) => void }[] }) {
  return (
    <div className="p-4 bg-white rounded-2xl border border-gray-200">
      <label className="flex items-center gap-2.5 cursor-pointer pb-3 mb-3 border-b border-gray-100">
        <input type="checkbox" checked={allChk} onChange={e => onAll(e.target.checked)} className="w-5 h-5 accent-orange-500" />
        <span className="text-[15px] font-bold text-gray-900">전체 동의</span>
      </label>
      {items.map(i => <label key={i.l} className="flex items-center gap-2.5 cursor-pointer mb-2 text-[14px] text-gray-700">
        <input type="checkbox" checked={i.c} onChange={e => i.s(e.target.checked)} className="w-[18px] h-[18px] accent-orange-500" />{i.l}</label>)}
    </div>
  )
}

export default function MobileRegisterPage() { return <Suspense><Content /></Suspense> }
