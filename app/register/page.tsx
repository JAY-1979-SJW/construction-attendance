'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

type Step = 'loading' | 'form' | 'submitting' | 'done'

interface PolicyDoc {
  id: string
  documentType: string
  title: string
  version: string
  contentMd: string
  isRequired: boolean
}

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('loading')
  const [error, setError] = useState('')
  const [policyDocs, setPolicyDocs] = useState<PolicyDoc[]>([])
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null)

  // 폼 상태
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [consentTerms, setConsentTerms] = useState(false)
  const [consentPrivacy, setConsentPrivacy] = useState(false)
  const [consentLocation, setConsentLocation] = useState(false)
  const [consentMarketing, setConsentMarketing] = useState(false)

  const allRequired = consentTerms && consentPrivacy && consentLocation

  useEffect(() => {
    fetch('/api/policies/active')
      .then(r => r.json())
      .then(d => {
        if (d.success) setPolicyDocs(d.documents ?? [])
      })
      .catch(() => {})
      .finally(() => setStep('form'))
  }, [])

  function getDoc(type: string) {
    return policyDocs.find(d => d.documentType === type)
  }

  function getDocumentIds(): Record<string, string> {
    const ids: Record<string, string> = {}
    for (const doc of policyDocs) {
      ids[doc.documentType] = doc.id
    }
    return ids
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!allRequired) {
      setError('필수 동의 항목을 모두 체크해 주세요.')
      return
    }

    const deviceToken = `web-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const deviceName = navigator.userAgent.substring(0, 80)

    setStep('submitting')
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, phone, jobTitle,
          username: username || undefined,
          email: email || undefined,
          deviceToken, deviceName,
          consentTerms, consentPrivacy, consentLocation, consentMarketing,
          documentIds: getDocumentIds(),
        }),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        setError(data.message ?? '가입에 실패했습니다.')
        setStep('form')
        return
      }

      if (data.status === 'ALREADY_REGISTERED') {
        setError(data.message)
        setStep('form')
        return
      }

      router.push('/register/pending')
    } catch {
      setError('네트워크 오류가 발생했습니다. 다시 시도해 주세요.')
      setStep('form')
    }
  }

  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-[linear-gradient(160deg,#0d1b2a_0%,#1B2838_60%,#141E2A_100%)] flex items-center justify-center p-6">
        <div className="bg-[#243144] rounded-2xl px-8 py-10 w-full max-w-[520px] shadow-[0_8px_40px_rgba(0,0,0,0.4)] border border-[rgba(91,164,217,0.15)] border-t-[3px] border-t-[#F47920]">
          <p className="text-center text-[#A0AEC0]">로딩 중...</p>
        </div>
      </div>
    )
  }

  const termsDoc = getDoc('TERMS_OF_SERVICE')
  const privacyDoc = getDoc('PRIVACY_POLICY')
  const locationDoc = getDoc('LOCATION_POLICY')
  const marketingDoc = getDoc('MARKETING_NOTICE')

  return (
    <div className="min-h-screen bg-[linear-gradient(160deg,#0d1b2a_0%,#1B2838_60%,#141E2A_100%)] flex items-center justify-center p-6">
      <div className="bg-[#243144] rounded-2xl px-8 py-10 w-full max-w-[520px] shadow-[0_8px_40px_rgba(0,0,0,0.4)] border border-[rgba(91,164,217,0.15)] border-t-[3px] border-t-[#F47920]">
        <div className="text-center mb-5">
          <Image src="/logo/logo_main.png" alt="해한Ai Engineering" width={240} height={180} className="w-[180px] h-auto mx-auto block rounded-2xl" priority />
        </div>
        <h1 className="text-2xl font-extrabold text-white tracking-[-0.5px] mb-2">근로자 회원가입</h1>
        <p className="text-sm text-[#A0AEC0] leading-[1.6] mb-7">가입 후 관리자 승인을 받아야 출퇴근이 가능합니다.</p>

        {error && (
          <div className="bg-[rgba(229,57,53,0.12)] border border-[rgba(229,57,53,0.4)] rounded-[10px] px-4 py-3 mb-5 text-[#ef9a9a] text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label className="block text-[13px] font-semibold text-[#A0AEC0] mb-[6px] mt-4">이름 <span className="text-[#F47920]">*</span></label>
          <input className="w-full px-[14px] py-3 border border-[rgba(91,164,217,0.25)] rounded-[10px] text-[15px] box-border bg-[rgba(255,255,255,0.06)] text-white outline-none" value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={30} placeholder="홍길동" />

          <label className="block text-[13px] font-semibold text-[#A0AEC0] mb-[6px] mt-4">휴대폰번호 <span className="text-[#F47920]">*</span></label>
          <input className="w-full px-[14px] py-3 border border-[rgba(91,164,217,0.25)] rounded-[10px] text-[15px] box-border bg-[rgba(255,255,255,0.06)] text-white outline-none" value={phone} onChange={e => setPhone(e.target.value)} required pattern="^010\d{8}$" placeholder="01012345678" maxLength={11} inputMode="numeric" />

          <label className="block text-[13px] font-semibold text-[#A0AEC0] mb-[6px] mt-4">직종 <span className="text-[#F47920]">*</span></label>
          <input className="w-full px-[14px] py-3 border border-[rgba(91,164,217,0.25)] rounded-[10px] text-[15px] box-border bg-[rgba(255,255,255,0.06)] text-white outline-none" value={jobTitle} onChange={e => setJobTitle(e.target.value)} required maxLength={50} placeholder="형틀목수, 철근공, 조적공 등" />

          <label className="block text-[13px] font-semibold text-[#A0AEC0] mb-[6px] mt-4">아이디 (선택)</label>
          <input className="w-full px-[14px] py-3 border border-[rgba(91,164,217,0.25)] rounded-[10px] text-[15px] box-border bg-[rgba(255,255,255,0.06)] text-white outline-none" value={username} onChange={e => setUsername(e.target.value)} minLength={4} maxLength={30} placeholder="4자 이상 영문·숫자" />

          <label className="block text-[13px] font-semibold text-[#A0AEC0] mb-[6px] mt-4">이메일 (선택)</label>
          <input className="w-full px-[14px] py-3 border border-[rgba(91,164,217,0.25)] rounded-[10px] text-[15px] box-border bg-[rgba(255,255,255,0.06)] text-white outline-none" value={email} onChange={e => setEmail(e.target.value)} type="email" maxLength={100} placeholder="example@email.com" />

          {/* 약관 동의 */}
          <div className="my-5 p-[18px] bg-[rgba(255,255,255,0.04)] rounded-xl border border-[rgba(91,164,217,0.15)]">
            <div className="text-[13px] font-bold mb-[14px] text-[#A0AEC0] tracking-[0.5px]">약관 동의</div>

            {/* 서비스 이용약관 */}
            <div className="mb-[10px] border-b border-[rgba(91,164,217,0.12)] pb-[10px]">
              <div className="flex items-start justify-between gap-2 text-[13px] text-[#CBD5E0]">
                <label className="flex items-start gap-2 cursor-pointer flex-1">
                  <input type="checkbox" checked={consentTerms} onChange={e => setConsentTerms(e.target.checked)} />
                  <span>
                    <span className="text-[#F47920]">[필수]</span>{' '}
                    {termsDoc ? `${termsDoc.title} (v${termsDoc.version})` : '서비스 이용약관 동의'}
                  </span>
                </label>
                {termsDoc && (
                  <button type="button" className="text-[12px] text-[#5BA4D9] bg-[rgba(91,164,217,0.1)] border border-[rgba(91,164,217,0.3)] rounded-[6px] px-[10px] py-[3px] cursor-pointer whitespace-nowrap" onClick={() => setExpandedDoc(expandedDoc === 'TERMS_OF_SERVICE' ? null : 'TERMS_OF_SERVICE')}>
                    {expandedDoc === 'TERMS_OF_SERVICE' ? '닫기' : '내용 보기'}
                  </button>
                )}
              </div>
              {expandedDoc === 'TERMS_OF_SERVICE' && termsDoc && (
                <div className="mt-2 text-[12px] text-[#A0AEC0] bg-[#1B2838] border border-[rgba(91,164,217,0.15)] rounded-lg p-3 max-h-[200px] overflow-y-auto whitespace-pre-wrap leading-[1.6]">{termsDoc.contentMd}</div>
              )}
            </div>

            {/* 개인정보처리방침 */}
            <div className="mb-[10px] border-b border-[rgba(91,164,217,0.12)] pb-[10px]">
              <div className="flex items-start justify-between gap-2 text-[13px] text-[#CBD5E0]">
                <label className="flex items-start gap-2 cursor-pointer flex-1">
                  <input type="checkbox" checked={consentPrivacy} onChange={e => setConsentPrivacy(e.target.checked)} />
                  <span>
                    <span className="text-[#F47920]">[필수]</span>{' '}
                    {privacyDoc ? `${privacyDoc.title} (v${privacyDoc.version})` : '개인정보 수집·이용 동의'}
                  </span>
                </label>
                {privacyDoc && (
                  <button type="button" className="text-[12px] text-[#5BA4D9] bg-[rgba(91,164,217,0.1)] border border-[rgba(91,164,217,0.3)] rounded-[6px] px-[10px] py-[3px] cursor-pointer whitespace-nowrap" onClick={() => setExpandedDoc(expandedDoc === 'PRIVACY_POLICY' ? null : 'PRIVACY_POLICY')}>
                    {expandedDoc === 'PRIVACY_POLICY' ? '닫기' : '내용 보기'}
                  </button>
                )}
              </div>
              {expandedDoc === 'PRIVACY_POLICY' && privacyDoc && (
                <div className="mt-2 text-[12px] text-[#A0AEC0] bg-[#1B2838] border border-[rgba(91,164,217,0.15)] rounded-lg p-3 max-h-[200px] overflow-y-auto whitespace-pre-wrap leading-[1.6]">{privacyDoc.contentMd}</div>
              )}
            </div>

            {/* 위치정보 이용 동의 */}
            <div className="mb-[10px] border-b border-[rgba(91,164,217,0.12)] pb-[10px]">
              <div className="flex items-start justify-between gap-2 text-[13px] text-[#CBD5E0]">
                <label className="flex items-start gap-2 cursor-pointer flex-1">
                  <input type="checkbox" checked={consentLocation} onChange={e => setConsentLocation(e.target.checked)} />
                  <span>
                    <span className="text-[#F47920]">[필수]</span>{' '}
                    {locationDoc ? `${locationDoc.title} (v${locationDoc.version})` : '위치정보 이용 동의 (GPS 출퇴근에 필요)'}
                  </span>
                </label>
                {locationDoc && (
                  <button type="button" className="text-[12px] text-[#5BA4D9] bg-[rgba(91,164,217,0.1)] border border-[rgba(91,164,217,0.3)] rounded-[6px] px-[10px] py-[3px] cursor-pointer whitespace-nowrap" onClick={() => setExpandedDoc(expandedDoc === 'LOCATION_POLICY' ? null : 'LOCATION_POLICY')}>
                    {expandedDoc === 'LOCATION_POLICY' ? '닫기' : '내용 보기'}
                  </button>
                )}
              </div>
              {expandedDoc === 'LOCATION_POLICY' && locationDoc && (
                <div className="mt-2 text-[12px] text-[#A0AEC0] bg-[#1B2838] border border-[rgba(91,164,217,0.15)] rounded-lg p-3 max-h-[200px] overflow-y-auto whitespace-pre-wrap leading-[1.6]">{locationDoc.contentMd}</div>
              )}
            </div>

            {/* 마케팅 수신 동의 (선택) */}
            <div className="mb-[10px] border-b border-[rgba(91,164,217,0.12)] pb-[10px]">
              <div className="flex items-start justify-between gap-2 text-[13px] text-[#CBD5E0]">
                <label className="flex items-start gap-2 cursor-pointer flex-1">
                  <input type="checkbox" checked={consentMarketing} onChange={e => setConsentMarketing(e.target.checked)} />
                  <span>
                    <span className="text-[#A0AEC0]">[선택]</span>{' '}
                    {marketingDoc ? `${marketingDoc.title} (v${marketingDoc.version})` : '마케팅 정보 수신 동의'}
                  </span>
                </label>
                {marketingDoc && (
                  <button type="button" className="text-[12px] text-[#5BA4D9] bg-[rgba(91,164,217,0.1)] border border-[rgba(91,164,217,0.3)] rounded-[6px] px-[10px] py-[3px] cursor-pointer whitespace-nowrap" onClick={() => setExpandedDoc(expandedDoc === 'MARKETING_NOTICE' ? null : 'MARKETING_NOTICE')}>
                    {expandedDoc === 'MARKETING_NOTICE' ? '닫기' : '내용 보기'}
                  </button>
                )}
              </div>
              {expandedDoc === 'MARKETING_NOTICE' && marketingDoc && (
                <div className="mt-2 text-[12px] text-[#A0AEC0] bg-[#1B2838] border border-[rgba(91,164,217,0.15)] rounded-lg p-3 max-h-[200px] overflow-y-auto whitespace-pre-wrap leading-[1.6]">{marketingDoc.contentMd}</div>
              )}
            </div>

            {!allRequired && (
              <p className="text-[12px] text-[#718096] mt-2">
                * 필수 항목에 모두 동의해야 가입이 가능합니다.
              </p>
            )}
          </div>

          <button
            type="submit"
            className="block w-full py-[15px] bg-[#F47920] text-white border-none rounded-[10px] text-base font-bold cursor-pointer mt-5 shadow-[0_4px_14px_rgba(244,121,32,0.35)] disabled:opacity-60"
            disabled={step === 'submitting'}
          >
            {step === 'submitting' ? '가입 중...' : '회원가입'}
          </button>
        </form>

        <div className="flex flex-col gap-2 mt-5 text-center">
          <Link href="/login" className="text-[#5BA4D9] text-[13px] no-underline">이미 계정이 있으신가요? 로그인</Link>
          <Link href="/register/company-admin" className="text-[#5BA4D9] text-[13px] no-underline">업체 관리자로 신청하기 →</Link>
        </div>
      </div>
    </div>
  )
}
