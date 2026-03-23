'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Step = 'form' | 'submitting' | 'done'

export default function CompanyAdminRegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('form')
  const [error, setError] = useState('')

  // 폼 상태
  const [applicantName, setApplicantName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [businessNumber, setBusinessNumber] = useState('')
  const [representativeName, setRepresentativeName] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [consentTerms, setConsentTerms] = useState(false)
  const [consentPrivacy, setConsentPrivacy] = useState(false)

  const allRequired = consentTerms && consentPrivacy

  // 사업자등록번호 형식 정규화 (하이픈 제거)
  function normalizeBizNum(val: string) {
    return val.replace(/[^0-9]/g, '').slice(0, 10)
  }

  function formatBizNum(val: string) {
    const digits = normalizeBizNum(val)
    if (digits.length <= 3) return digits
    if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!allRequired) {
      setError('필수 동의 항목을 모두 체크해 주세요.')
      return
    }

    const cleanBizNum = normalizeBizNum(businessNumber)
    if (cleanBizNum.length !== 10) {
      setError('사업자등록번호는 10자리 숫자로 입력하세요.')
      return
    }

    setStep('submitting')
    try {
      const res = await fetch('/api/auth/register/company-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicantName,
          phone,
          email: email || undefined,
          companyName,
          businessNumber: cleanBizNum,
          representativeName: representativeName || undefined,
          contactPhone: contactPhone || undefined,
          jobTitle: jobTitle || undefined,
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
      setError('네트워크 오류가 발생했습니다. 다시 시도해 주세요.')
      setStep('form')
    }
  }

  if (step === 'done') {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 12px', color: '#1a1a2e' }}>
              업체 관리자 신청이 완료되었습니다
            </h2>
            <p style={{ fontSize: '14px', color: '#666', lineHeight: 1.7, margin: '0 0 24px' }}>
              담당자가 사업자등록증 및 신청 내용을 검토 후<br />
              연락드릴 예정입니다. (영업일 기준 1~3일)
            </p>
            <div style={s.infoBox}>
              <p style={{ fontSize: '13px', color: '#444', margin: 0 }}>
                승인 후 이메일 또는 연락처로 로그인 정보가 발송됩니다.<br />
                문의사항이 있으시면 서비스 담당자에게 연락해 주세요.
              </p>
            </div>
            <Link href="/" style={{ ...s.btn, display: 'block', textAlign: 'center', textDecoration: 'none', marginTop: '20px' }}>
              홈으로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <h1 style={s.title}>업체 관리자 신청</h1>
        <p style={s.subtitle}>
          사업자등록증 확인 후 관리자가 승인합니다.<br />
          승인 후 업체 포털(/company)을 이용하실 수 있습니다.
        </p>

        {error && <div style={s.errorBox}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={s.section}>
            <div style={s.sectionTitle}>신청인 정보</div>

            <label style={s.label}>신청인 이름 <span style={s.required}>*</span></label>
            <input style={s.input} value={applicantName} onChange={e => setApplicantName(e.target.value)} required maxLength={30} placeholder="홍길동" />

            <label style={s.label}>연락처 <span style={s.required}>*</span></label>
            <input style={s.input} value={phone} onChange={e => setPhone(e.target.value)} required pattern="^010\d{8}$" placeholder="01012345678" maxLength={11} inputMode="numeric" />

            <label style={s.label}>이메일 (선택 — 로그인 계정으로 사용될 수 있습니다)</label>
            <input style={s.input} value={email} onChange={e => setEmail(e.target.value)} type="email" maxLength={100} placeholder="company@example.com" />

            <label style={s.label}>직책 (선택)</label>
            <input style={s.input} value={jobTitle} onChange={e => setJobTitle(e.target.value)} maxLength={50} placeholder="대표, 현장소장, 총무팀장 등" />
          </div>

          <div style={s.section}>
            <div style={s.sectionTitle}>업체 정보</div>

            <label style={s.label}>업체명 <span style={s.required}>*</span></label>
            <input style={s.input} value={companyName} onChange={e => setCompanyName(e.target.value)} required maxLength={100} placeholder="(주)해한건설" />

            <label style={s.label}>사업자등록번호 <span style={s.required}>*</span></label>
            <input
              style={s.input}
              value={formatBizNum(businessNumber)}
              onChange={e => setBusinessNumber(normalizeBizNum(e.target.value))}
              required
              placeholder="000-00-00000"
              maxLength={12}
              inputMode="numeric"
            />

            <label style={s.label}>대표자명 (선택)</label>
            <input style={s.input} value={representativeName} onChange={e => setRepresentativeName(e.target.value)} maxLength={30} placeholder="홍길동" />

            <label style={s.label}>업체 연락처 (선택)</label>
            <input style={s.input} value={contactPhone} onChange={e => setContactPhone(e.target.value)} maxLength={20} placeholder="02-1234-5678" />
          </div>

          <div style={s.section}>
            <div style={s.sectionTitle}>동의</div>

            <label style={s.consentRow}>
              <input type="checkbox" checked={consentTerms} onChange={e => setConsentTerms(e.target.checked)} />
              <span><span style={s.required}>[필수]</span> 서비스 이용약관 동의</span>
            </label>
            <label style={s.consentRow}>
              <input type="checkbox" checked={consentPrivacy} onChange={e => setConsentPrivacy(e.target.checked)} />
              <span><span style={s.required}>[필수]</span> 개인정보 수집·이용 동의</span>
            </label>

            <div style={s.noticeBox}>
              <p style={{ fontSize: '12px', color: '#555', margin: 0, lineHeight: 1.6 }}>
                * 사업자등록번호는 중복 검토에 사용됩니다.<br />
                * 승인 후 임시 비밀번호가 발급됩니다.<br />
                * 심사 기간: 영업일 기준 1~3일
              </p>
            </div>
          </div>

          <button
            type="submit"
            style={{ ...s.btn, opacity: step === 'submitting' ? 0.6 : 1 }}
            disabled={step === 'submitting'}
          >
            {step === 'submitting' ? '신청 중...' : '업체 관리자 신청'}
          </button>
        </form>

        <div style={s.footer}>
          <Link href="/register" style={s.link}>근로자로 가입하기</Link>
          <Link href="/login" style={s.link}>이미 계정이 있으신가요? 로그인</Link>
        </div>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page:        { minHeight: '100vh', background: '#f5f6fa', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' },
  card:        { background: 'white', borderRadius: '16px', padding: '40px 32px', width: '100%', maxWidth: '520px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' },
  title:       { fontSize: '24px', fontWeight: 700, margin: '0 0 8px', color: '#1a1a2e' },
  subtitle:    { fontSize: '14px', color: '#666', margin: '0 0 24px', lineHeight: 1.6 },
  errorBox:    { background: '#fff0f0', border: '1px solid #ffcccc', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', color: '#c62828', fontSize: '14px' },
  section:     { marginBottom: '24px', padding: '16px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e8e8e8' },
  sectionTitle:{ fontSize: '13px', fontWeight: 700, color: '#333', marginBottom: '12px' },
  label:       { display: 'block', fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '6px', marginTop: '12px' },
  required:    { color: '#e53935' },
  input:       { width: '100%', padding: '10px 12px', border: '1px solid rgba(91,164,217,0.3)', borderRadius: '8px', fontSize: '15px', boxSizing: 'border-box' },
  consentRow:  { display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: '#444', marginBottom: '8px', cursor: 'pointer' },
  noticeBox:   { marginTop: '12px', padding: '10px 12px', background: '#fffde7', border: '1px solid #ffe082', borderRadius: '6px' },
  infoBox:     { padding: '14px 16px', background: '#f0f7ff', border: '1px solid #bbdefb', borderRadius: '8px', margin: '12px 0' },
  btn:         { display: 'block', width: '100%', padding: '14px', background: '#E06810', color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: 700, cursor: 'pointer', marginTop: '8px' },
  footer:      { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '20px', textAlign: 'center' },
  link:        { color: '#5BA4D9', fontSize: '13px', textDecoration: 'none' },
}
