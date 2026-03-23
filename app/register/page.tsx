'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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
      <div style={s.page}>
        <div style={s.card}>
          <p style={{ textAlign: 'center', color: '#A0AEC0' }}>로딩 중...</p>
        </div>
      </div>
    )
  }

  const termsDoc = getDoc('TERMS_OF_SERVICE')
  const privacyDoc = getDoc('PRIVACY_POLICY')
  const locationDoc = getDoc('LOCATION_POLICY')
  const marketingDoc = getDoc('MARKETING_NOTICE')

  return (
    <div style={s.page}>
      <div style={s.card}>
        <h1 style={s.title}>근로자 회원가입</h1>
        <p style={s.subtitle}>가입 후 관리자 승인을 받아야 출퇴근이 가능합니다.</p>

        {error && <div style={s.errorBox}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <label style={s.label}>이름 <span style={s.required}>*</span></label>
          <input style={s.input} value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={30} placeholder="홍길동" />

          <label style={s.label}>휴대폰번호 <span style={s.required}>*</span></label>
          <input style={s.input} value={phone} onChange={e => setPhone(e.target.value)} required pattern="^010\d{8}$" placeholder="01012345678" maxLength={11} inputMode="numeric" />

          <label style={s.label}>직종 <span style={s.required}>*</span></label>
          <input style={s.input} value={jobTitle} onChange={e => setJobTitle(e.target.value)} required maxLength={50} placeholder="형틀목수, 철근공, 조적공 등" />

          <label style={s.label}>아이디 (선택)</label>
          <input style={s.input} value={username} onChange={e => setUsername(e.target.value)} minLength={4} maxLength={30} placeholder="4자 이상 영문·숫자" />

          <label style={s.label}>이메일 (선택)</label>
          <input style={s.input} value={email} onChange={e => setEmail(e.target.value)} type="email" maxLength={100} placeholder="example@email.com" />

          {/* 약관 동의 */}
          <div style={s.consentSection}>
            <div style={s.consentTitle}>약관 동의</div>

            {/* 서비스 이용약관 */}
            <div style={s.consentBlock}>
              <div style={s.consentRow}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', flex: 1 }}>
                  <input type="checkbox" checked={consentTerms} onChange={e => setConsentTerms(e.target.checked)} />
                  <span>
                    <span style={s.required}>[필수]</span>{' '}
                    {termsDoc ? `${termsDoc.title} (v${termsDoc.version})` : '서비스 이용약관 동의'}
                  </span>
                </label>
                {termsDoc && (
                  <button type="button" style={s.viewBtn} onClick={() => setExpandedDoc(expandedDoc === 'TERMS_OF_SERVICE' ? null : 'TERMS_OF_SERVICE')}>
                    {expandedDoc === 'TERMS_OF_SERVICE' ? '닫기' : '내용 보기'}
                  </button>
                )}
              </div>
              {expandedDoc === 'TERMS_OF_SERVICE' && termsDoc && (
                <div style={s.docContent}>{termsDoc.contentMd}</div>
              )}
            </div>

            {/* 개인정보처리방침 */}
            <div style={s.consentBlock}>
              <div style={s.consentRow}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', flex: 1 }}>
                  <input type="checkbox" checked={consentPrivacy} onChange={e => setConsentPrivacy(e.target.checked)} />
                  <span>
                    <span style={s.required}>[필수]</span>{' '}
                    {privacyDoc ? `${privacyDoc.title} (v${privacyDoc.version})` : '개인정보 수집·이용 동의'}
                  </span>
                </label>
                {privacyDoc && (
                  <button type="button" style={s.viewBtn} onClick={() => setExpandedDoc(expandedDoc === 'PRIVACY_POLICY' ? null : 'PRIVACY_POLICY')}>
                    {expandedDoc === 'PRIVACY_POLICY' ? '닫기' : '내용 보기'}
                  </button>
                )}
              </div>
              {expandedDoc === 'PRIVACY_POLICY' && privacyDoc && (
                <div style={s.docContent}>{privacyDoc.contentMd}</div>
              )}
            </div>

            {/* 위치정보 이용 동의 */}
            <div style={s.consentBlock}>
              <div style={s.consentRow}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', flex: 1 }}>
                  <input type="checkbox" checked={consentLocation} onChange={e => setConsentLocation(e.target.checked)} />
                  <span>
                    <span style={s.required}>[필수]</span>{' '}
                    {locationDoc ? `${locationDoc.title} (v${locationDoc.version})` : '위치정보 이용 동의 (GPS 출퇴근에 필요)'}
                  </span>
                </label>
                {locationDoc && (
                  <button type="button" style={s.viewBtn} onClick={() => setExpandedDoc(expandedDoc === 'LOCATION_POLICY' ? null : 'LOCATION_POLICY')}>
                    {expandedDoc === 'LOCATION_POLICY' ? '닫기' : '내용 보기'}
                  </button>
                )}
              </div>
              {expandedDoc === 'LOCATION_POLICY' && locationDoc && (
                <div style={s.docContent}>{locationDoc.contentMd}</div>
              )}
            </div>

            {/* 마케팅 수신 동의 (선택) */}
            <div style={s.consentBlock}>
              <div style={s.consentRow}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', flex: 1 }}>
                  <input type="checkbox" checked={consentMarketing} onChange={e => setConsentMarketing(e.target.checked)} />
                  <span>
                    <span style={{ color: '#A0AEC0' }}>[선택]</span>{' '}
                    {marketingDoc ? `${marketingDoc.title} (v${marketingDoc.version})` : '마케팅 정보 수신 동의'}
                  </span>
                </label>
                {marketingDoc && (
                  <button type="button" style={s.viewBtn} onClick={() => setExpandedDoc(expandedDoc === 'MARKETING_NOTICE' ? null : 'MARKETING_NOTICE')}>
                    {expandedDoc === 'MARKETING_NOTICE' ? '닫기' : '내용 보기'}
                  </button>
                )}
              </div>
              {expandedDoc === 'MARKETING_NOTICE' && marketingDoc && (
                <div style={s.docContent}>{marketingDoc.contentMd}</div>
              )}
            </div>

            {!allRequired && (
              <p style={{ fontSize: '12px', color: '#718096', margin: '8px 0 0' }}>
                * 필수 항목에 모두 동의해야 가입이 가능합니다.
              </p>
            )}
          </div>

          <button
            type="submit"
            style={{ ...s.btn, opacity: step === 'submitting' ? 0.6 : 1 }}
            disabled={step === 'submitting'}
          >
            {step === 'submitting' ? '가입 중...' : '회원가입'}
          </button>
        </form>

        <div style={s.footer}>
          <Link href="/login" style={s.link}>이미 계정이 있으신가요? 로그인</Link>
          <Link href="/register/company-admin" style={s.link}>업체 관리자로 신청하기 →</Link>
        </div>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page:         { minHeight: '100vh', background: '#f5f6fa', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' },
  card:         { background: '#243144', borderRadius: '16px', padding: '40px 32px', width: '100%', maxWidth: '520px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' },
  title:        { fontSize: '24px', fontWeight: 700, margin: '0 0 8px', color: '#ffffff' },
  subtitle:     { fontSize: '14px', color: '#A0AEC0', margin: '0 0 28px', lineHeight: 1.6 },
  errorBox:     { background: '#fff0f0', border: '1px solid #ffcccc', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', color: '#c62828', fontSize: '14px' },
  label:        { display: 'block', fontSize: '13px', fontWeight: 600, color: '#CBD5E0', marginBottom: '6px', marginTop: '16px' },
  required:     { color: '#e53935' },
  input:        { width: '100%', padding: '10px 12px', border: '1px solid rgba(91,164,217,0.3)', borderRadius: '8px', fontSize: '15px', boxSizing: 'border-box' },
  consentSection: { margin: '20px 0', padding: '16px', background: '#1B2838', borderRadius: '8px', border: '1px solid #e8e8e8' },
  consentTitle: { fontSize: '13px', fontWeight: 700, marginBottom: '12px', color: '#CBD5E0' },
  consentBlock: { marginBottom: '10px', borderBottom: '1px solid #eee', paddingBottom: '10px' },
  consentRow:   { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', fontSize: '13px', color: '#444' },
  viewBtn:      { fontSize: '12px', color: '#5BA4D9', background: 'none', border: '1px solid #1976d2', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', whiteSpace: 'nowrap' },
  docContent:   { marginTop: '8px', fontSize: '12px', color: '#A0AEC0', background: '#243144', border: '1px solid rgba(91,164,217,0.3)', borderRadius: '6px', padding: '12px', maxHeight: '200px', overflowY: 'auto', whiteSpace: 'pre-wrap', lineHeight: 1.6 },
  btn:          { display: 'block', width: '100%', padding: '14px', background: '#F47920', color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: 700, cursor: 'pointer', marginTop: '20px' },
  footer:       { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '20px', textAlign: 'center' },
  link:         { color: '#5BA4D9', fontSize: '13px', textDecoration: 'none' },
}
