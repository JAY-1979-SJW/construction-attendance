'use client'

import { signIn } from 'next-auth/react'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

interface PolicyDoc {
  id: string
  documentType: string
  title: string
  version: string
  contentMd: string
  isRequired: boolean
}

function RegisterContent() {
  const [loading, setLoading] = useState<string | null>(null)
  const params = useSearchParams()
  const errorKey = params.get('error') ?? ''

  const [policyDocs, setPolicyDocs] = useState<PolicyDoc[]>([])
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null)
  const [consentTerms, setConsentTerms] = useState(false)
  const [consentPrivacy, setConsentPrivacy] = useState(false)
  const [consentLocation, setConsentLocation] = useState(false)
  const [consentMarketing, setConsentMarketing] = useState(false)
  const [error, setError] = useState('')

  const allRequired = consentTerms && consentPrivacy && consentLocation

  useEffect(() => {
    fetch('/api/policies/active')
      .then(r => r.json())
      .then(d => { if (d.success) setPolicyDocs(d.documents ?? []) })
      .catch(() => {})
  }, [])

  const ERROR_MSG: Record<string, string> = {
    no_email: '이메일 정보를 가져올 수 없습니다.',
    inactive: '비활성화된 계정입니다. 관리자에게 문의하세요.',
    server: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
    already_registered: '이미 가입된 계정입니다. 로그인해 주세요.',
  }

  function getDoc(type: string) {
    return policyDocs.find(d => d.documentType === type)
  }

  function handleSignUp(provider: string) {
    if (!allRequired) {
      setError('필수 동의 항목을 모두 체크해 주세요.')
      return
    }
    setError('')
    setLoading(provider)

    // 회원가입 의도 + 약관 동의 정보를 쿠키에 저장 (OAuth 콜백에서 읽음)
    const consent = JSON.stringify({
      terms: consentTerms,
      privacy: consentPrivacy,
      location: consentLocation,
      marketing: consentMarketing,
      documentIds: Object.fromEntries(policyDocs.map(d => [d.documentType, d.id])),
    })
    document.cookie = `auth_intent=register; path=/; max-age=600; SameSite=Lax`
    document.cookie = `register_consent=${encodeURIComponent(consent)}; path=/; max-age=600; SameSite=Lax`

    signIn(provider, { callbackUrl: '/api/auth/complete' })
  }

  const termsDoc = getDoc('TERMS_OF_SERVICE')
  const privacyDoc = getDoc('PRIVACY_POLICY')
  const locationDoc = getDoc('LOCATION_POLICY')
  const marketingDoc = getDoc('MARKETING_NOTICE')

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl px-8 py-10 w-full max-w-[520px] shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-[#E5E7EB] border-t-[3px] border-t-[#F97316]">
        <div className="text-center mb-5">
          <Image src="/logo/logo_main.png" alt="해한Ai Engineering" width={240} height={180} className="w-[180px] h-auto mx-auto block rounded-2xl" priority />
        </div>
        <h1 className="text-2xl font-extrabold text-[#111827] tracking-[-0.5px] mb-2">근로자 회원가입</h1>
        <p className="text-sm text-[#6B7280] leading-[1.6] mb-7">
          카카오 또는 Google 계정으로 간편 가입 후<br />관리자 승인을 받으면 출퇴근이 가능합니다.
        </p>

        {(error || errorKey) && (
          <div className="bg-[rgba(220,38,38,0.08)] border border-[rgba(220,38,38,0.3)] rounded-[10px] px-4 py-3 mb-5 text-[#dc2626] text-sm">
            {error || ERROR_MSG[errorKey] || '가입 중 오류가 발생했습니다.'}
          </div>
        )}

        {/* 약관 동의 */}
        <div className="mb-6 p-[18px] bg-[#F9FAFB] rounded-xl border border-[#E5E7EB]">
          <div className="text-[13px] font-bold mb-[14px] text-[#374151] tracking-[0.5px]">약관 동의</div>

          {[
            { key: 'TERMS_OF_SERVICE', label: '서비스 이용약관', doc: termsDoc, checked: consentTerms, set: setConsentTerms, required: true },
            { key: 'PRIVACY_POLICY', label: '개인정보 수집·이용 동의', doc: privacyDoc, checked: consentPrivacy, set: setConsentPrivacy, required: true },
            { key: 'LOCATION_POLICY', label: '위치정보 이용 동의 (GPS 출퇴근)', doc: locationDoc, checked: consentLocation, set: setConsentLocation, required: true },
            { key: 'MARKETING_NOTICE', label: '마케팅 정보 수신 동의', doc: marketingDoc, checked: consentMarketing, set: setConsentMarketing, required: false },
          ].map(item => (
            <div key={item.key} className="mb-[10px] border-b border-[#ECEFF3] pb-[10px]">
              <div className="flex items-start justify-between gap-2 text-[13px] text-[#374151]">
                <label className="flex items-start gap-2 cursor-pointer flex-1">
                  <input type="checkbox" checked={item.checked} onChange={e => item.set(e.target.checked)} />
                  <span>
                    <span className={item.required ? 'text-[#F97316]' : 'text-[#9CA3AF]'}>[{item.required ? '필수' : '선택'}]</span>{' '}
                    {item.doc ? `${item.doc.title} (v${item.doc.version})` : item.label}
                  </span>
                </label>
                {item.doc && (
                  <button type="button" className="text-[12px] text-[#F97316] bg-[#FFF7ED] border border-[rgba(249,115,22,0.3)] rounded-[6px] px-[10px] py-[3px] cursor-pointer whitespace-nowrap" onClick={() => setExpandedDoc(expandedDoc === item.key ? null : item.key)}>
                    {expandedDoc === item.key ? '닫기' : '내용 보기'}
                  </button>
                )}
              </div>
              {expandedDoc === item.key && item.doc && (
                <div className="mt-2 text-[12px] text-[#4B5563] bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-3 max-h-[200px] overflow-y-auto whitespace-pre-wrap leading-[1.6]">{item.doc.contentMd}</div>
              )}
            </div>
          ))}

          {!allRequired && (
            <p className="text-[12px] text-[#9CA3AF] mt-2">* 필수 항목에 모두 동의해야 가입이 가능합니다.</p>
          )}
        </div>

        {/* 소셜 가입 버튼 */}
        <div className="space-y-3">
          <button
            onClick={() => handleSignUp('kakao')}
            disabled={!!loading}
            className="w-full h-12 rounded-[10px] font-semibold text-[14px] flex items-center justify-center gap-3 transition-all disabled:opacity-60"
            style={{ background: '#FEE500', color: '#191919' }}
          >
            {loading === 'kakao'
              ? <span className="w-5 h-5 border-2 border-yellow-400 border-t-yellow-700 rounded-full animate-spin" />
              : <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="#191919">
                  <path d="M12 3C6.48 3 2 6.73 2 11.35c0 2.99 1.87 5.62 4.69 7.13l-1.2 4.41 5.13-3.4c.45.06.91.09 1.38.09 5.52 0 10-3.73 10-8.32C22 6.73 17.52 3 12 3z"/>
                </svg>
            }
            카카오로 가입하기
          </button>

          <button
            onClick={() => handleSignUp('google')}
            disabled={!!loading}
            className="w-full h-12 rounded-[10px] font-semibold text-[14px] flex items-center justify-center gap-3 transition-all border border-[#E5E7EB] bg-white text-[#111827] hover:bg-[#F9FAFB] disabled:opacity-60 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
          >
            {loading === 'google'
              ? <span className="w-5 h-5 border-2 border-[#E5E7EB] border-t-[#6B7280] rounded-full animate-spin" />
              : <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
            }
            Google로 가입하기
          </button>
        </div>

        <div className="flex flex-col gap-2 mt-6 text-center">
          <Link href="/login" className="text-[#F97316] text-[13px] no-underline">이미 계정이 있으신가요? 로그인</Link>
          <Link href="/register/company-admin" className="text-[#6B7280] text-[13px] no-underline hover:text-[#F97316]">업체 관리자로 신청하기</Link>
        </div>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterContent />
    </Suspense>
  )
}
