'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

/* ── 건설현장 주요 직종 ────────────────────────────── */
const JOB_CATEGORIES = [
  { group: '건축', items: ['형틀목공', '철근공', '콘크리트공', '조적공', '미장공', '방수공', '도장공', '타일공', '석공', '창호공', '유리공', '지붕잇기공'] },
  { group: '토목', items: ['토공', '포장공', '측량사', '굴삭기운전원', '항타공'] },
  { group: '설비', items: ['배관공', '용접공', '덕트공', '보온공', '위생설비공'] },
  { group: '전기/소방', items: ['전기공', '소방설비공', '통신공', '자동제어공'] },
  { group: '기타', items: ['비계공', '해체공', '운반공', '잡공', '안전관리자', '보건관리자', '현장소장', '현장대리인', '사무원'] },
]

/* ── 스텝 인디케이터 ─────────────────────────────── */
function StepBar({ current }: { current: number }) {
  const steps = ['약관동의', '소셜인증', '정보입력', '승인대기']
  return (
    <div className="flex items-center justify-between mb-8 px-2">
      {steps.map((label, i) => {
        const step = i + 1
        const done = step < current
        const active = step === current
        return (
          <div key={label} className="flex flex-col items-center flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold mb-1 transition-colors ${
              done ? 'bg-[#16a34a] text-white' : active ? 'bg-[#F97316] text-white' : 'bg-[#E5E7EB] text-[#9CA3AF]'
            }`}>
              {done ? '✓' : step}
            </div>
            <span className={`text-[11px] ${active ? 'text-[#F97316] font-semibold' : done ? 'text-[#16a34a]' : 'text-[#9CA3AF]'}`}>{label}</span>
          </div>
        )
      })}
    </div>
  )
}

/* ── 전화번호 자동 포맷 (숫자만 유지) ─────────────── */
function formatPhone(raw: string): string {
  return raw.replace(/[^0-9]/g, '').slice(0, 11)
}
function displayPhone(digits: string): string {
  if (digits.length <= 3) return digits
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}

export default function RegisterCompletePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [email, setEmail] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [customJob, setCustomJob] = useState('')

  const effectiveJob = jobTitle === '__custom__' ? customJob.trim() : jobTitle

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (!d.success) { router.push('/login'); return }
        setName(d.data.name ?? '')
        setEmail(d.data.email ?? null)
        setPhone(d.data.phone ?? '')
        if (d.data.jobTitle && d.data.jobTitle !== '미설정') {
          const allItems = JOB_CATEGORIES.flatMap(c => c.items)
          if (allItems.includes(d.data.jobTitle)) {
            setJobTitle(d.data.jobTitle)
          } else {
            setJobTitle('__custom__')
            setCustomJob(d.data.jobTitle)
          }
        }
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false))
  }, [router])

  function handlePhoneChange(raw: string) {
    setPhone(formatPhone(raw))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!name.trim()) { setError('이름을 입력해 주세요.'); return }
    if (!/^010\d{8}$/.test(phone)) { setError('전화번호는 010으로 시작하는 11자리 숫자를 입력해 주세요.'); return }
    if (!effectiveJob) { setError('직종을 선택해 주세요.'); return }

    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone, jobTitle: effectiveJob }),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        if (data.message?.includes('전화번호')) {
          setError('이미 등록된 전화번호입니다. 본인 번호가 맞다면 관리자에게 문의해 주세요.')
        } else {
          setError(data.message ?? '저장에 실패했습니다.')
        }
        setSubmitting(false)
        return
      }

      router.push('/register/pending')
    } catch {
      setError('네트워크 오류가 발생했습니다.')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
        <p className="text-[#6B7280]">로딩 중...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl px-8 py-9 w-full max-w-[480px] shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-[#E5E7EB] border-t-[3px] border-t-[#F97316]">
        <div className="text-center mb-4">
          <Image src="/logo/logo_main.png" alt="해한Ai Engineering" width={240} height={180} className="w-[140px] h-auto mx-auto block rounded-2xl" priority />
        </div>

        <StepBar current={3} />

        {email && (
          <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg">
            <span className="text-[#16a34a] text-[14px]">✓</span>
            <span className="text-[13px] text-[#374151]">{email}</span>
          </div>
        )}

        <h1 className="text-[18px] font-extrabold text-[#111827] tracking-[-0.5px] mb-1">추가 정보 입력</h1>
        <p className="text-[13px] text-[#6B7280] leading-[1.6] mb-5">출퇴근 관리에 필요한 최소 정보만 입력합니다.</p>

        {error && (
          <div className="bg-[rgba(220,38,38,0.08)] border border-[rgba(220,38,38,0.3)] rounded-[10px] px-4 py-3 mb-4 text-[#dc2626] text-[13px]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* 이름 */}
          <label className="block text-[13px] font-semibold text-[#374151] mb-[6px]">
            이름 <span className="text-[#F97316]">*</span>
          </label>
          <input
            className="w-full px-[14px] py-[11px] border border-[#E5E7EB] rounded-[10px] text-[15px] box-border bg-white text-[#111827] outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[rgba(249,115,22,0.1)] mb-4"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            minLength={2}
            maxLength={30}
            placeholder="실명을 입력하세요"
          />

          {/* 전화번호 */}
          <label className="block text-[13px] font-semibold text-[#374151] mb-[6px]">
            휴대폰번호 <span className="text-[#F97316]">*</span>
          </label>
          <input
            className="w-full px-[14px] py-[11px] border border-[#E5E7EB] rounded-[10px] text-[15px] box-border bg-white text-[#111827] outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[rgba(249,115,22,0.1)] mb-1"
            value={displayPhone(phone)}
            onChange={e => handlePhoneChange(e.target.value)}
            required
            placeholder="010-1234-5678"
            maxLength={13}
            inputMode="numeric"
          />
          <p className="text-[11px] text-[#9CA3AF] mb-4">관리자 연락 및 출퇴근 알림에 사용됩니다.</p>

          {/* 직종 */}
          <label className="block text-[13px] font-semibold text-[#374151] mb-[6px]">
            직종 <span className="text-[#F97316]">*</span>
          </label>
          <select
            className="w-full px-[14px] py-[11px] border border-[#E5E7EB] rounded-[10px] text-[15px] box-border bg-white text-[#111827] outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[rgba(249,115,22,0.1)] mb-1 appearance-none"
            value={jobTitle}
            onChange={e => { setJobTitle(e.target.value); if (e.target.value !== '__custom__') setCustomJob('') }}
            required={jobTitle !== '__custom__'}
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%239CA3AF' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center' }}
          >
            <option value="">직종을 선택하세요</option>
            {JOB_CATEGORIES.map(cat => (
              <optgroup key={cat.group} label={cat.group}>
                {cat.items.map(job => <option key={job} value={job}>{job}</option>)}
              </optgroup>
            ))}
            <option value="__custom__">직접 입력</option>
          </select>

          {jobTitle === '__custom__' && (
            <input
              className="w-full px-[14px] py-[11px] border border-[#E5E7EB] rounded-[10px] text-[15px] box-border bg-white text-[#111827] outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[rgba(249,115,22,0.1)] mt-2"
              value={customJob}
              onChange={e => setCustomJob(e.target.value)}
              required
              maxLength={50}
              placeholder="직종명을 직접 입력하세요"
              autoFocus
            />
          )}
          <div className="mb-5" />

          <button
            type="submit"
            disabled={submitting}
            className="block w-full py-[13px] bg-[#F97316] text-white border-none rounded-[10px] text-[15px] font-bold cursor-pointer shadow-[0_4px_14px_rgba(249,115,22,0.35)] disabled:opacity-60"
          >
            {submitting ? '처리 중...' : '가입 완료'}
          </button>
        </form>
      </div>
    </div>
  )
}
