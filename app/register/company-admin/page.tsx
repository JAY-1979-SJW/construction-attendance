'use client'

import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Step = 'method' | 'form' | 'submitting' | 'done'

function PasswordInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input type={show ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-[10px] pr-11 border border-[rgba(91,164,217,0.3)] rounded-lg text-[15px] box-border bg-[rgba(255,255,255,0.06)] text-white outline-none" />
      <button type="button" onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-[#999] hover:text-white p-1">
        {show ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        )}
      </button>
    </div>
  )
}

const INPUT_CLS = "w-full px-3 py-[10px] border border-[rgba(91,164,217,0.3)] rounded-lg text-[15px] box-border bg-[rgba(255,255,255,0.06)] text-white outline-none"

export default function CompanyAdminRegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('method')
  const [authMethod, setAuthMethod] = useState<'email' | 'social'>('email')
  const [error, setError] = useState('')
  const [socialLoading, setSocialLoading] = useState<string | null>(null)

  // 폼 상태
  const [applicantName, setApplicantName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [businessNumber, setBusinessNumber] = useState('')
  const [representativeName, setRepresentativeName] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [consentTerms, setConsentTerms] = useState(false)
  const [consentPrivacy, setConsentPrivacy] = useState(false)

  const allRequired = consentTerms && consentPrivacy

  function normalizeBizNum(val: string) { return val.replace(/[^0-9]/g, '').slice(0, 10) }
  function formatBizNum(val: string) {
    const d = normalizeBizNum(val)
    if (d.length <= 3) return d
    if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`
    return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`
  }

  const handleSocialAuth = (provider: string) => {
    setSocialLoading(provider)
    // 소셜 인증 후 돌아와서 폼 작성
    signIn(provider, { callbackUrl: '/register/company-admin?social=true' })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!allRequired) { setError('필수 동의 항목을 모두 체크해 주세요.'); return }
    const cleanBizNum = normalizeBizNum(businessNumber)
    if (cleanBizNum.length !== 10) { setError('사업자등록번호는 10자리 숫자로 입력하세요.'); return }
    if (authMethod === 'email' && !email) { setError('이메일을 입력하세요.'); return }
    if (authMethod === 'email' && password.length < 6) { setError('비밀번호는 6자 이상이어야 합니다.'); return }

    setStep('submitting')
    try {
      const res = await fetch('/api/auth/register/company-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicantName,
          phone,
          email: email || undefined,
          password: authMethod === 'email' ? password : undefined,
          companyName,
          businessNumber: cleanBizNum,
          representativeName: representativeName || undefined,
          contactPhone: contactPhone || undefined,
          jobTitle: jobTitle || undefined,
          authMethod,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.message ?? '신청에 실패했습니다.')
        setStep('form')
        return
      }
      setStep('done')
    } catch {
      setError('네트워크 오류가 발생했습니다.')
      setStep('form')
    }
  }

  // ── 완료 화면 ──
  if (step === 'done') {
    return (
      <div className="min-h-screen bg-[#f5f6fa] flex items-center justify-center p-6">
        <div className="bg-card rounded-2xl py-10 px-8 w-full max-w-[520px] shadow-[0_4px_24px_rgba(0,0,0,0.08)]">
          <div className="text-center py-5">
            <div className="text-[48px] mb-4">✅</div>
            <h2 className="text-[20px] font-bold text-white mb-3">신청이 완료되었습니다</h2>
            <p className="text-[14px] text-muted-brand leading-[1.7] mb-4">
              임시 승인 상태로 3일간 서비스를 이용할 수 있습니다.
            </p>

            <div className="bg-[#FFF3E0] border border-[#FFE0B2] rounded-xl p-4 mb-5 text-left">
              <p className="text-[14px] font-bold text-[#E65100] mb-2 m-0">3일 이내 사업자등록증을 제출해 주세요</p>
              <ul className="text-[13px] text-[#BF360C] m-0 p-0 pl-4 space-y-1">
                <li>관리자 포털 로그인 → 내 회사 정보 → 사업자등록증 업로드</li>
                <li>미제출 시 3일 후 계정이 정지됩니다</li>
                <li>제출 후 담당자 확인 → 정식 승인</li>
              </ul>
            </div>

            <div className="px-4 py-3 bg-[#f0f7ff] border border-[#bbdefb] rounded-lg mb-5">
              <p className="text-[13px] text-[#444] m-0">
                {authMethod === 'email'
                  ? '입력하신 이메일과 비밀번호로 바로 로그인할 수 있습니다.'
                  : 'Google/카카오로 로그인할 수 있습니다.'}
              </p>
            </div>

            <Link href="/login" className="block w-full py-[14px] bg-[#E06810] text-white border-none rounded-[10px] text-base font-bold cursor-pointer text-center no-underline">
              로그인하기
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── 가입 방법 선택 ──
  if (step === 'method') {
    return (
      <div className="min-h-screen bg-[#f5f6fa] flex items-center justify-center p-6">
        <div className="bg-card rounded-2xl py-10 px-8 w-full max-w-[520px] shadow-[0_4px_24px_rgba(0,0,0,0.08)]">
          <h1 className="text-[24px] font-bold text-white mb-2">사업자 가입</h1>
          <p className="text-[14px] text-muted-brand mb-8 leading-[1.6]">
            가입 방법을 선택하세요. 사업자등록번호가 필요합니다.
          </p>

          <div className="space-y-3 mb-6">
            {/* 소셜 */}
            <button onClick={() => handleSocialAuth('google')} disabled={!!socialLoading}
              className="w-full h-[52px] rounded-xl font-semibold text-[14px] flex items-center justify-center gap-3 border border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.06)] text-white hover:bg-[rgba(255,255,255,0.1)] disabled:opacity-50 cursor-pointer">
              {socialLoading === 'google' ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> :
                <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>}
              Google로 가입
            </button>
            <button onClick={() => handleSocialAuth('kakao')} disabled={!!socialLoading}
              className="w-full h-[52px] rounded-xl font-semibold text-[14px] flex items-center justify-center gap-3 disabled:opacity-50 cursor-pointer border-none"
              style={{ background: '#FEE500', color: '#191919' }}>
              {socialLoading === 'kakao' ? <span className="w-5 h-5 border-2 border-yellow-700/30 border-t-yellow-700 rounded-full animate-spin" /> :
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#191919"><path d="M12 3C6.48 3 2 6.73 2 11.35c0 2.99 1.87 5.62 4.69 7.13l-1.2 4.41 5.13-3.4c.45.06.91.09 1.38.09 5.52 0 10-3.73 10-8.32C22 6.73 17.52 3 12 3z"/></svg>}
              카카오로 가입
            </button>

            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-[rgba(255,255,255,0.1)]" />
              <span className="text-[11px] text-[#999]">또는</span>
              <div className="flex-1 h-px bg-[rgba(255,255,255,0.1)]" />
            </div>

            <button onClick={() => { setAuthMethod('email'); setStep('form') }}
              className="w-full h-[52px] rounded-xl font-semibold text-[14px] flex items-center justify-center gap-2 border border-[rgba(255,255,255,0.15)] bg-transparent text-white hover:bg-[rgba(255,255,255,0.06)] cursor-pointer">
              이메일로 가입
            </button>
          </div>

          <div className="flex flex-col gap-2 text-center">
            <Link href="/register" className="text-secondary-brand text-[13px] no-underline">근로자로 가입하기</Link>
            <Link href="/login" className="text-secondary-brand text-[13px] no-underline">이미 계정이 있으신가요? 로그인</Link>
          </div>
        </div>
      </div>
    )
  }

  // ── 정보 입력 폼 ──
  return (
    <div className="min-h-screen bg-[#f5f6fa] flex items-center justify-center p-6">
      <div className="bg-card rounded-2xl py-10 px-8 w-full max-w-[520px] shadow-[0_4px_24px_rgba(0,0,0,0.08)]">
        <button onClick={() => setStep('method')} className="text-[12px] text-[#999] hover:text-white bg-transparent border-none cursor-pointer p-0 mb-3">← 뒤로</button>
        <h1 className="text-[24px] font-bold text-white mb-2">업체 정보 입력</h1>
        <p className="text-[14px] text-muted-brand mb-6 leading-[1.6]">
          사업자등록번호 확인 후 3일간 임시 이용이 가능합니다.<br />
          3일 이내 사업자등록증을 제출해 주세요.
        </p>

        {error && (
          <div className="bg-[#fff0f0] border border-[#ffcccc] rounded-lg px-4 py-3 mb-5 text-[#c62828] text-[14px]">{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          {/* 신청인 정보 */}
          <div className="mb-6 p-4 bg-brand rounded-lg border border-[rgba(91,164,217,0.2)]">
            <div className="text-[13px] font-bold text-dim-brand mb-3">신청인 정보</div>
            <label className="block text-[13px] font-semibold text-dim-brand mb-[6px] mt-3">이름 <span className="text-[#e53935]">*</span></label>
            <input className={INPUT_CLS} value={applicantName} onChange={e => setApplicantName(e.target.value)} required maxLength={30} placeholder="홍길동" />

            <label className="block text-[13px] font-semibold text-dim-brand mb-[6px] mt-3">연락처 <span className="text-[#e53935]">*</span></label>
            <input className={INPUT_CLS} value={phone} onChange={e => setPhone(e.target.value)} required pattern="^010\d{8}$" placeholder="01012345678" maxLength={11} inputMode="numeric" />

            {authMethod === 'email' && (
              <>
                <label className="block text-[13px] font-semibold text-dim-brand mb-[6px] mt-3">이메일 <span className="text-[#e53935]">*</span></label>
                <input className={INPUT_CLS} value={email} onChange={e => setEmail(e.target.value)} type="email" required maxLength={100} placeholder="company@example.com" />

                <label className="block text-[13px] font-semibold text-dim-brand mb-[6px] mt-3">비밀번호 <span className="text-[#e53935]">*</span> (6자 이상)</label>
                <PasswordInput value={password} onChange={setPassword} placeholder="비밀번호 설정" />
              </>
            )}

            <label className="block text-[13px] font-semibold text-dim-brand mb-[6px] mt-3">직책 (선택)</label>
            <input className={INPUT_CLS} value={jobTitle} onChange={e => setJobTitle(e.target.value)} maxLength={50} placeholder="대표, 현장소장 등" />
          </div>

          {/* 업체 정보 */}
          <div className="mb-6 p-4 bg-brand rounded-lg border border-[rgba(91,164,217,0.2)]">
            <div className="text-[13px] font-bold text-dim-brand mb-3">업체 정보</div>
            <label className="block text-[13px] font-semibold text-dim-brand mb-[6px] mt-3">업체명 <span className="text-[#e53935]">*</span></label>
            <input className={INPUT_CLS} value={companyName} onChange={e => setCompanyName(e.target.value)} required maxLength={100} placeholder="(주)해한건설" />

            <label className="block text-[13px] font-semibold text-dim-brand mb-[6px] mt-3">사업자등록번호 <span className="text-[#e53935]">*</span></label>
            <input className={INPUT_CLS} value={formatBizNum(businessNumber)} onChange={e => setBusinessNumber(normalizeBizNum(e.target.value))} required placeholder="000-00-00000" maxLength={12} inputMode="numeric" />

            <label className="block text-[13px] font-semibold text-dim-brand mb-[6px] mt-3">대표자명 (선택)</label>
            <input className={INPUT_CLS} value={representativeName} onChange={e => setRepresentativeName(e.target.value)} maxLength={30} placeholder="홍길동" />

            <label className="block text-[13px] font-semibold text-dim-brand mb-[6px] mt-3">업체 연락처 (선택)</label>
            <input className={INPUT_CLS} value={contactPhone} onChange={e => setContactPhone(e.target.value)} maxLength={20} placeholder="02-1234-5678" />
          </div>

          {/* 동의 + 안내 */}
          <div className="mb-6 p-4 bg-brand rounded-lg border border-[rgba(91,164,217,0.2)]">
            <label className="flex items-start gap-2 text-[13px] mb-2 cursor-pointer">
              <input type="checkbox" checked={consentTerms} onChange={e => setConsentTerms(e.target.checked)} className="mt-0.5" />
              <span className="text-dim-brand"><span className="text-[#e53935]">[필수]</span> 서비스 이용약관 동의</span>
            </label>
            <label className="flex items-start gap-2 text-[13px] mb-3 cursor-pointer">
              <input type="checkbox" checked={consentPrivacy} onChange={e => setConsentPrivacy(e.target.checked)} className="mt-0.5" />
              <span className="text-dim-brand"><span className="text-[#e53935]">[필수]</span> 개인정보 수집·이용 동의</span>
            </label>

            <div className="bg-[#FFF3E0] border border-[#FFE0B2] rounded-lg p-3">
              <p className="text-[12px] text-[#E65100] font-bold m-0 mb-1">사업자등록증 제출 안내</p>
              <p className="text-[12px] text-[#BF360C] m-0 leading-[1.6]">
                가입 후 3일 이내에 사업자등록증을 업로드해 주세요.<br />
                미제출 시 계정이 정지되며, 제출 후 정식 승인됩니다.
              </p>
            </div>
          </div>

          <button type="submit" disabled={step === 'submitting' || !allRequired}
            className="block w-full py-[14px] bg-[#E06810] text-white border-none rounded-[10px] text-base font-bold cursor-pointer disabled:opacity-60">
            {step === 'submitting' ? '신청 중...' : '가입 신청'}
          </button>
        </form>

        <div className="flex flex-col gap-2 mt-5 text-center">
          <Link href="/register" className="text-secondary-brand text-[13px] no-underline">근로자로 가입하기</Link>
          <Link href="/login" className="text-secondary-brand text-[13px] no-underline">이미 계정이 있으신가요? 로그인</Link>
        </div>
      </div>
    </div>
  )
}
