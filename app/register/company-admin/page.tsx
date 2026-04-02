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
      <div className="min-h-screen bg-[#f5f6fa] flex items-center justify-center p-6">
        <div className="bg-card rounded-2xl py-10 px-8 w-full max-w-[520px] shadow-[0_4px_24px_rgba(0,0,0,0.08)]">
          <div className="text-center py-5">
            <div className="text-[48px] mb-4">✅</div>
            <h2 className="text-[20px] font-bold text-white mb-3">
              업체 관리자 신청이 완료되었습니다
            </h2>
            <p className="text-[14px] text-muted-brand leading-[1.7] mb-6">
              담당자가 사업자등록증 및 신청 내용을 검토 후<br />
              연락드릴 예정입니다. (영업일 기준 1~3일)
            </p>
            <div className="px-4 py-[14px] bg-[#f0f7ff] border border-[#bbdefb] rounded-lg mb-3">
              <p className="text-[13px] text-[#444] m-0">
                승인 후 이메일 또는 연락처로 로그인 정보가 발송됩니다.<br />
                문의사항이 있으시면 서비스 담당자에게 연락해 주세요.
              </p>
            </div>
            <Link href="/" className="block w-full py-[14px] bg-[#E06810] text-white border-none rounded-[10px] text-base font-bold cursor-pointer mt-5 text-center no-underline">
              홈으로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f5f6fa] flex items-center justify-center p-6">
      <div className="bg-card rounded-2xl py-10 px-8 w-full max-w-[520px] shadow-[0_4px_24px_rgba(0,0,0,0.08)]">
        <h1 className="text-[24px] font-bold text-white mb-2">업체 관리자 신청</h1>
        <p className="text-[14px] text-muted-brand mb-6 leading-[1.6]">
          사업자등록증 확인 후 관리자가 승인합니다.<br />
          승인 후 업체 포털(/company)을 이용하실 수 있습니다.
        </p>

        {error && (
          <div className="bg-[#fff0f0] border border-[#ffcccc] rounded-lg px-4 py-3 mb-5 text-[#c62828] text-[14px]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-6 p-4 bg-brand rounded-lg border border-[rgba(91,164,217,0.2)]">
            <div className="text-[13px] font-bold text-dim-brand mb-3">신청인 정보</div>

            <label className="block text-[13px] font-semibold text-dim-brand mb-[6px] mt-3">신청인 이름 <span className="text-[#e53935]">*</span></label>
            <input className="w-full px-3 py-[10px] border border-[rgba(91,164,217,0.3)] rounded-lg text-[15px] box-border bg-[rgba(255,255,255,0.06)] text-white outline-none" value={applicantName} onChange={e => setApplicantName(e.target.value)} required maxLength={30} placeholder="홍길동" />

            <label className="block text-[13px] font-semibold text-dim-brand mb-[6px] mt-3">연락처 <span className="text-[#e53935]">*</span></label>
            <input className="w-full px-3 py-[10px] border border-[rgba(91,164,217,0.3)] rounded-lg text-[15px] box-border bg-[rgba(255,255,255,0.06)] text-white outline-none" value={phone} onChange={e => setPhone(e.target.value)} required pattern="^010\d{8}$" placeholder="01012345678" maxLength={11} inputMode="numeric" />

            <label className="block text-[13px] font-semibold text-dim-brand mb-[6px] mt-3">이메일 (선택 — 로그인 계정으로 사용될 수 있습니다)</label>
            <input className="w-full px-3 py-[10px] border border-[rgba(91,164,217,0.3)] rounded-lg text-[15px] box-border bg-[rgba(255,255,255,0.06)] text-white outline-none" value={email} onChange={e => setEmail(e.target.value)} type="email" maxLength={100} placeholder="company@example.com" />

            <label className="block text-[13px] font-semibold text-dim-brand mb-[6px] mt-3">직책 (선택)</label>
            <input className="w-full px-3 py-[10px] border border-[rgba(91,164,217,0.3)] rounded-lg text-[15px] box-border bg-[rgba(255,255,255,0.06)] text-white outline-none" value={jobTitle} onChange={e => setJobTitle(e.target.value)} maxLength={50} placeholder="대표, 현장소장, 총무팀장 등" />
          </div>

          <div className="mb-6 p-4 bg-brand rounded-lg border border-[rgba(91,164,217,0.2)]">
            <div className="text-[13px] font-bold text-dim-brand mb-3">업체 정보</div>

            <label className="block text-[13px] font-semibold text-dim-brand mb-[6px] mt-3">업체명 <span className="text-[#e53935]">*</span></label>
            <input className="w-full px-3 py-[10px] border border-[rgba(91,164,217,0.3)] rounded-lg text-[15px] box-border bg-[rgba(255,255,255,0.06)] text-white outline-none" value={companyName} onChange={e => setCompanyName(e.target.value)} required maxLength={100} placeholder="(주)해한건설" />

            <label className="block text-[13px] font-semibold text-dim-brand mb-[6px] mt-3">사업자등록번호 <span className="text-[#e53935]">*</span></label>
            <input
              className="w-full px-3 py-[10px] border border-[rgba(91,164,217,0.3)] rounded-lg text-[15px] box-border bg-[rgba(255,255,255,0.06)] text-white outline-none"
              value={formatBizNum(businessNumber)}
              onChange={e => setBusinessNumber(normalizeBizNum(e.target.value))}
              required
              placeholder="000-00-00000"
              maxLength={12}
              inputMode="numeric"
            />

            <label className="block text-[13px] font-semibold text-dim-brand mb-[6px] mt-3">대표자명 (선택)</label>
            <input className="w-full px-3 py-[10px] border border-[rgba(91,164,217,0.3)] rounded-lg text-[15px] box-border bg-[rgba(255,255,255,0.06)] text-white outline-none" value={representativeName} onChange={e => setRepresentativeName(e.target.value)} maxLength={30} placeholder="홍길동" />

            <label className="block text-[13px] font-semibold text-dim-brand mb-[6px] mt-3">업체 연락처 (선택)</label>
            <input className="w-full px-3 py-[10px] border border-[rgba(91,164,217,0.3)] rounded-lg text-[15px] box-border bg-[rgba(255,255,255,0.06)] text-white outline-none" value={contactPhone} onChange={e => setContactPhone(e.target.value)} maxLength={20} placeholder="02-1234-5678" />
          </div>

          <div className="mb-6 p-4 bg-brand rounded-lg border border-[rgba(91,164,217,0.2)]">
            <div className="text-[13px] font-bold text-dim-brand mb-3">동의</div>

            <label className="flex items-start gap-2 text-[13px] text-[#444] mb-2 cursor-pointer">
              <input type="checkbox" checked={consentTerms} onChange={e => setConsentTerms(e.target.checked)} />
              <span className="text-dim-brand"><span className="text-[#e53935]">[필수]</span> 서비스 이용약관 동의</span>
            </label>
            <label className="flex items-start gap-2 text-[13px] text-[#444] mb-2 cursor-pointer">
              <input type="checkbox" checked={consentPrivacy} onChange={e => setConsentPrivacy(e.target.checked)} />
              <span className="text-dim-brand"><span className="text-[#e53935]">[필수]</span> 개인정보 수집·이용 동의</span>
            </label>

            <div className="mt-3 px-3 py-[10px] bg-[#fffde7] border border-[#ffe082] rounded-md">
              <p className="text-[12px] text-muted-brand m-0 leading-[1.6]">
                * 사업자등록번호는 중복 검토에 사용됩니다.<br />
                * 승인 후 임시 비밀번호가 발급됩니다.<br />
                * 심사 기간: 영업일 기준 1~3일
              </p>
            </div>
          </div>

          <button
            type="submit"
            className="block w-full py-[14px] bg-[#E06810] text-white border-none rounded-[10px] text-base font-bold cursor-pointer mt-2 disabled:opacity-60"
            disabled={step === 'submitting'}
          >
            {step === 'submitting' ? '신청 중...' : '업체 관리자 신청'}
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
