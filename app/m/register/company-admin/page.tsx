'use client'

import { signIn } from 'next-auth/react'
import { useState } from 'react'
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

type Step = 'method' | 'form' | 'submitting' | 'done'
const INPUT = "w-full h-[50px] px-4 text-[16px] bg-white border border-gray-200 rounded-2xl outline-none focus:border-orange-400"

export default function MobileCompanyAdminRegister() {
  const [step, setStep] = useState<Step>('method')
  const [authMethod, setAuthMethod] = useState<'email' | 'social'>('email')
  const [error, setError] = useState('')
  const [socialLoading, setSocialLoading] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [company, setCompany] = useState('')
  const [bizNum, setBizNum] = useState('')
  const [rep, setRep] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [consentTerms, setConsentTerms] = useState(false)
  const [consentPrivacy, setConsentPrivacy] = useState(false)
  const allReq = consentTerms && consentPrivacy

  function normBiz(v: string) { return v.replace(/\D/g, '').slice(0, 10) }
  function fmtBiz(v: string) { const d = normBiz(v); return d.length <= 3 ? d : d.length <= 5 ? `${d.slice(0,3)}-${d.slice(3)}` : `${d.slice(0,3)}-${d.slice(3,5)}-${d.slice(5)}` }

  const handleSocial = (p: string) => { setSocialLoading(p); signIn(p, { callbackUrl: '/m/register/company-admin?social=true' }) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError('')
    if (!allReq) { setError('필수 약관에 동의하세요.'); return }
    if (normBiz(bizNum).length !== 10) { setError('사업자등록번호 10자리를 입력하세요.'); return }
    if (authMethod === 'email' && (!email || password.length < 6)) { setError('이메일과 비밀번호(6자 이상)를 입력하세요.'); return }
    setStep('submitting')
    try {
      const res = await fetch('/api/auth/register/company-admin', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicantName: name, phone, email: email || undefined, password: authMethod === 'email' ? password : undefined, companyName: company, businessNumber: normBiz(bizNum), representativeName: rep || undefined, contactPhone: contactPhone || undefined, jobTitle: jobTitle || undefined, authMethod }) })
      const d = await res.json()
      if (!res.ok || !d.success) { setError(d.message ?? '신청 실패'); setStep('form'); return }
      setStep('done')
    } catch { setError('네트워크 오류'); setStep('form') }
  }

  if (step === 'done') return (
    <div className="px-5 py-10 text-center">
      <div className="text-[48px] mb-4">✅</div>
      <h1 className="text-[22px] font-bold text-gray-900 mb-3">신청 완료</h1>
      <p className="text-[15px] text-gray-500 leading-[1.7] mb-5">임시 승인 상태로 3일간 이용 가능합니다.</p>
      <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-5 text-left">
        <p className="text-[14px] font-bold text-orange-600 mb-2 m-0">3일 이내 사업자등록증 제출</p>
        <ul className="text-[13px] text-orange-700 m-0 p-0 pl-4 space-y-1">
          <li>로그인 → 내 회사 정보 → 사업자등록증 업로드</li>
          <li>미제출 시 계정 정지</li>
        </ul>
      </div>
      <Link href="/m/login" className="block w-full py-4 bg-orange-500 text-white rounded-2xl no-underline text-[16px] font-bold active:bg-orange-600">로그인</Link>
    </div>
  )

  if (step === 'method') return (
    <div className="px-5 py-8">
      <h1 className="text-[24px] font-bold text-gray-900 mb-2">사업자 가입</h1>
      <p className="text-[15px] text-gray-500 mb-7">사업자등록번호가 필요합니다.</p>
      <div className="space-y-2.5 mb-5">
        <button onClick={() => handleSocial('google')} disabled={!!socialLoading}
          className="w-full h-[50px] rounded-2xl text-[15px] font-semibold border border-gray-200 bg-white text-gray-700 disabled:opacity-50 cursor-pointer">Google로 가입</button>
        <button onClick={() => handleSocial('kakao')} disabled={!!socialLoading}
          className="w-full h-[50px] rounded-2xl text-[15px] font-semibold disabled:opacity-50 cursor-pointer border-none" style={{ background: '#FEE500', color: '#191919' }}>카카오로 가입</button>
        <div className="flex items-center gap-3 my-3"><div className="flex-1 h-px bg-gray-200" /><span className="text-[12px] text-gray-400">또는</span><div className="flex-1 h-px bg-gray-200" /></div>
        <button onClick={() => { setAuthMethod('email'); setStep('form') }}
          className="w-full h-[50px] rounded-2xl text-[15px] font-semibold border border-gray-200 bg-white text-gray-700 cursor-pointer">이메일로 가입</button>
      </div>
      <div className="flex justify-center gap-4 text-[13px]">
        <Link href="/m/register" className="text-gray-500 no-underline">근로자 가입</Link>
        <Link href="/m/login" className="text-gray-500 no-underline">로그인</Link>
      </div>
    </div>
  )

  return (
    <div className="px-5 py-8">
      <button onClick={() => setStep('method')} className="text-[14px] text-gray-400 bg-transparent border-none cursor-pointer p-0 mb-5">← 뒤로</button>
      <h1 className="text-[24px] font-bold text-gray-900 mb-2">업체 정보 입력</h1>
      <p className="text-[14px] text-gray-500 mb-6">3일 이내 사업자등록증을 제출해 주세요.</p>
      {error && <div className="mb-4 rounded-2xl px-4 py-3.5 text-[14px] text-red-600 bg-red-50 border border-red-100">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="text-[14px] font-bold text-gray-900 mt-2 mb-1">신청인</div>
        <input value={name} onChange={e => setName(e.target.value)} required placeholder="이름 *" className={INPUT} />
        <input value={phone} onChange={e => setPhone(e.target.value)} required placeholder="연락처 * (01012345678)" maxLength={11} inputMode="numeric" className={INPUT} />
        {authMethod === 'email' && <>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="이메일 *" className={INPUT} />
          <PwInput value={password} onChange={setPassword} placeholder="비밀번호 * (6자 이상)" />
        </>}
        <input value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="직책 (선택)" className={INPUT} />

        <div className="text-[14px] font-bold text-gray-900 mt-4 mb-1">업체</div>
        <input value={company} onChange={e => setCompany(e.target.value)} required placeholder="업체명 *" className={INPUT} />
        <input value={fmtBiz(bizNum)} onChange={e => setBizNum(normBiz(e.target.value))} required placeholder="사업자등록번호 * (000-00-00000)" maxLength={12} inputMode="numeric" className={INPUT} />
        <input value={rep} onChange={e => setRep(e.target.value)} placeholder="대표자명 (선택)" className={INPUT} />
        <input value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="업체 연락처 (선택)" className={INPUT} />

        <div className="pt-2">
          <label className="flex items-center gap-2.5 cursor-pointer mb-2 text-[14px] text-gray-700">
            <input type="checkbox" checked={consentTerms} onChange={e => setConsentTerms(e.target.checked)} className="w-5 h-5 accent-orange-500" />
            <span className="text-red-500">[필수]</span> 서비스 이용약관 동의</label>
          <label className="flex items-center gap-2.5 cursor-pointer mb-3 text-[14px] text-gray-700">
            <input type="checkbox" checked={consentPrivacy} onChange={e => setConsentPrivacy(e.target.checked)} className="w-5 h-5 accent-orange-500" />
            <span className="text-red-500">[필수]</span> 개인정보 수집·이용 동의</label>
        </div>

        <button type="submit" disabled={step === 'submitting' || !allReq}
          className="w-full h-[50px] text-[16px] font-bold text-white bg-orange-500 active:bg-orange-600 rounded-2xl border-none cursor-pointer disabled:opacity-50">
          {step === 'submitting' ? '신청 중...' : '가입 신청'}
        </button>
      </form>
    </div>
  )
}
