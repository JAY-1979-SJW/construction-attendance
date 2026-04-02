'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

/* ── 직종 대분류 → 세부 ─────────────────────────── */
const JOB_CATEGORIES: Record<string, string[]> = {
  '건축': ['형틀목공', '철근공', '콘크리트공', '조적공', '미장공', '방수공', '도장공', '타일공', '석공', '창호공', '유리공', '지붕잇기공'],
  '토목': ['토공', '포장공', '측량사', '굴삭기운전원', '항타공'],
  '설비': ['배관공', '용접공', '덕트공', '보온공', '위생설비공'],
  '전기/소방': ['전기공', '소방설비공', '통신공', '자동제어공'],
  '기타': ['비계공', '해체공', '운반공', '잡공', '안전관리자', '보건관리자', '현장소장', '현장대리인', '사무원'],
}
const CATEGORIES = Object.keys(JOB_CATEGORIES)

function findCategory(job: string): string | null {
  for (const [cat, items] of Object.entries(JOB_CATEGORIES)) {
    if (items.includes(job)) return cat
  }
  return null
}

/* ── 스텝 인디케이터 ─────────────────────────────── */
function StepBar({ current }: { current: number }) {
  const steps = ['약관동의', '소셜인증', '정보입력', '승인대기']
  return (
    <div className="flex items-center justify-between mb-7 px-1">
      {steps.map((label, i) => {
        const step = i + 1
        const done = step < current
        const active = step === current
        return (
          <div key={label} className="flex flex-col items-center flex-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold mb-1 ${
              done ? 'bg-[#16a34a] text-white' : active ? 'bg-brand-accent text-white' : 'bg-brand-deeper text-muted2-brand'
            }`}>
              {done ? '✓' : step}
            </div>
            <span className={`text-[10px] ${active ? 'text-accent font-semibold' : done ? 'text-status-working' : 'text-muted2-brand'}`}>{label}</span>
          </div>
        )
      })}
    </div>
  )
}

/* ── 전화번호 포맷 ───────────────────────────────── */
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
  const [category, setCategory] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [customJob, setCustomJob] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [foreignerYn, setForeignerYn] = useState(false)
  const [orgType, setOrgType] = useState<string>('DIRECT')
  const [address, setAddress] = useState('')

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
          const cat = findCategory(d.data.jobTitle)
          if (cat) {
            setCategory(cat)
            setJobTitle(d.data.jobTitle)
          } else {
            setCategory('기타')
            setJobTitle('__custom__')
            setCustomJob(d.data.jobTitle)
          }
        }
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false))
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!name.trim()) { setError('이름을 입력해 주세요.'); return }
    if (!effectiveJob) { setError('직종을 선택해 주세요.'); return }
    if (phone && !/^010\d{8}$/.test(phone)) { setError('전화번호는 010으로 시작하는 11자리를 입력하세요.'); return }

    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone || null,
          jobTitle: effectiveJob,
          birthDate: birthDate || null,
          foreignerYn,
          organizationType: orgType,
          address: address.trim() || null,
        }),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        if (data.message?.includes('전화번호')) {
          setError('이미 등록된 전화번호입니다. 관리자에게 문의해 주세요.')
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
    return <div className="min-h-screen bg-brand flex items-center justify-center"><p className="text-muted-brand">로딩 중...</p></div>
  }

  const subJobs = category ? (JOB_CATEGORIES[category] ?? []) : []

  return (
    <div className="min-h-screen bg-brand flex items-center justify-center p-6">
      <div className="bg-card rounded-2xl px-8 py-8 w-full max-w-[440px] shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-brand border-t-[3px] border-t-accent">
        <div className="text-center mb-3">
          <Image src="/logo/logo_main.png" alt="해한Ai" width={240} height={180} className="w-[120px] h-auto mx-auto block rounded-2xl" priority />
        </div>

        <StepBar current={3} />

        {email && (
          <div className="flex items-center gap-2 mb-4 px-3 py-[7px] bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg">
            <span className="text-status-working text-[13px]">✓</span>
            <span className="text-[13px] text-body-brand">{email}</span>
          </div>
        )}

        {error && (
          <div className="bg-[rgba(220,38,38,0.08)] border border-[rgba(220,38,38,0.3)] rounded-[10px] px-4 py-[10px] mb-4 text-status-rejected text-[13px]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* 이름 */}
          <label className="block text-[13px] font-semibold text-body-brand mb-[5px]">이름 <span className="text-accent">*</span></label>
          <input
            className="w-full px-3 py-[10px] border border-brand rounded-[10px] text-[15px] bg-card text-fore-brand outline-none focus:border-accent mb-4 box-border"
            value={name} onChange={e => setName(e.target.value)}
            required minLength={2} maxLength={30} placeholder="실명"
          />

          {/* 직종: 대분류 → 세부 */}
          <label className="block text-[13px] font-semibold text-body-brand mb-[5px]">직종 <span className="text-accent">*</span></label>
          <div className="flex gap-2 flex-wrap mb-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat} type="button"
                onClick={() => { setCategory(cat); setJobTitle(''); setCustomJob('') }}
                className={`px-3 py-[6px] rounded-full text-[13px] font-medium border transition-colors ${
                  category === cat
                    ? 'bg-brand-accent text-white border-accent'
                    : 'bg-white text-body-brand border-brand hover:border-accent'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {category && (
            <div className="flex gap-[6px] flex-wrap mb-1">
              {subJobs.map(job => (
                <button
                  key={job} type="button"
                  onClick={() => { setJobTitle(job); setCustomJob('') }}
                  className={`px-[10px] py-[5px] rounded-lg text-[12px] border transition-colors ${
                    jobTitle === job
                      ? 'bg-accent-light text-accent border-accent font-semibold'
                      : 'bg-surface text-body-brand border-brand hover:border-accent'
                  }`}
                >
                  {job}
                </button>
              ))}
              <button
                type="button"
                onClick={() => { setJobTitle('__custom__'); setCustomJob('') }}
                className={`px-[10px] py-[5px] rounded-lg text-[12px] border transition-colors ${
                  jobTitle === '__custom__'
                    ? 'bg-accent-light text-accent border-accent font-semibold'
                    : 'bg-surface text-muted2-brand border-brand hover:border-accent'
                }`}
              >
                직접입력
              </button>
            </div>
          )}

          {jobTitle === '__custom__' && (
            <input
              className="w-full px-3 py-[10px] border border-brand rounded-[10px] text-[14px] bg-card text-fore-brand outline-none focus:border-accent mt-1 box-border"
              value={customJob} onChange={e => setCustomJob(e.target.value)}
              required maxLength={50} placeholder="직종명 입력" autoFocus
            />
          )}
          <div className="mb-4" />

          {/* 전화번호 (선택) */}
          <label className="block text-[13px] font-semibold text-body-brand mb-[5px]">
            전화번호 <span className="text-muted2-brand font-normal text-[11px]">선택</span>
          </label>
          <input
            className="w-full px-3 py-[10px] border border-brand rounded-[10px] text-[15px] bg-card text-fore-brand outline-none focus:border-accent mb-1 box-border"
            value={displayPhone(phone)} onChange={e => setPhone(formatPhone(e.target.value))}
            placeholder="010-1234-5678" maxLength={13} inputMode="numeric"
          />
          <p className="text-[11px] text-muted2-brand mb-5">나중에 입력해도 됩니다.</p>

          {/* 생년월일 */}
          <label className="block text-[13px] font-semibold text-body-brand mb-[5px]">
            생년월일 <span className="text-muted2-brand font-normal text-[11px]">선택</span>
          </label>
          <input
            type="date"
            className="w-full px-3 py-[10px] border border-brand rounded-[10px] text-[15px] bg-card text-fore-brand outline-none focus:border-accent mb-4 box-border"
            value={birthDate} onChange={e => setBirthDate(e.target.value)}
          />

          {/* 외국인 여부 */}
          <label className="flex items-center gap-2 mb-4 cursor-pointer">
            <input type="checkbox" checked={foreignerYn} onChange={e => setForeignerYn(e.target.checked)}
              className="w-4 h-4 accent-brand-accent" />
            <span className="text-[13px] text-body-brand">외국인 근로자입니다</span>
          </label>

          {/* 소속 구분 */}
          <label className="block text-[13px] font-semibold text-body-brand mb-[5px]">소속 구분</label>
          <div className="flex gap-2 flex-wrap mb-4">
            {([
              { value: 'DIRECT', label: '직영' },
              { value: 'DAILY_WORKER', label: '일용직' },
              { value: 'OUTSOURCED', label: '외주팀' },
              { value: 'SUBCONTRACTOR', label: '협력업체' },
            ] as const).map(opt => (
              <button
                key={opt.value} type="button"
                onClick={() => setOrgType(opt.value)}
                className={`px-3 py-[6px] rounded-full text-[13px] font-medium border transition-colors ${
                  orgType === opt.value
                    ? 'bg-brand-accent text-white border-accent'
                    : 'bg-white text-body-brand border-brand hover:border-accent'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* 주소 */}
          <label className="block text-[13px] font-semibold text-body-brand mb-[5px]">
            주소 <span className="text-muted2-brand font-normal text-[11px]">선택</span>
          </label>
          <input
            className="w-full px-3 py-[10px] border border-brand rounded-[10px] text-[15px] bg-card text-fore-brand outline-none focus:border-accent mb-5 box-border"
            value={address} onChange={e => setAddress(e.target.value)}
            placeholder="시/군/구 까지 입력" maxLength={200}
          />

          <button
            type="submit" disabled={submitting}
            className="block w-full py-[12px] bg-brand-accent text-white border-none rounded-[10px] text-[15px] font-bold cursor-pointer shadow-[0_4px_14px_rgba(249,115,22,0.25)] disabled:opacity-60"
          >
            {submitting ? '처리 중...' : '가입 완료'}
          </button>
        </form>
      </div>
    </div>
  )
}
