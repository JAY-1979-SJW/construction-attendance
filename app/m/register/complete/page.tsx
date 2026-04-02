'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const JOBS: Record<string, string[]> = {
  '건축': ['형틀목공', '철근공', '콘크리트공', '조적공', '미장공', '방수공', '도장공', '타일공'],
  '토목': ['토공', '포장공', '측량사', '굴삭기운전원'],
  '설비': ['배관공', '용접공', '덕트공', '보온공'],
  '전기/소방': ['전기공', '소방설비공', '통신공'],
  '기타': ['비계공', '해체공', '잡공', '안전관리자', '현장소장', '사무원'],
}

const INPUT = "w-full h-[50px] px-4 text-[16px] bg-white border border-gray-200 rounded-2xl outline-none focus:border-orange-400"
const SELECT = "w-full h-[50px] px-3 text-[16px] bg-white border border-gray-200 rounded-2xl outline-none focus:border-orange-400"

export default function MobileRegisterComplete() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [cat, setCat] = useState('')
  const [job, setJob] = useState('')
  const [custom, setCustom] = useState('')
  const [birth, setBirth] = useState('')

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.success) { router.push('/m/login'); return }
      setEmail(d.data.email ?? ''); setName(d.data.name ?? '')
    }).catch(() => router.push('/m/login')).finally(() => setLoading(false))
  }, [router])

  const effectiveJob = job === '__custom__' ? custom.trim() : job

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError('')
    if (!name.trim()) { setError('이름을 입력하세요.'); return }
    if (!effectiveJob) { setError('직종을 선택하세요.'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone: phone || null, jobTitle: effectiveJob, birthDate: birth || null }) })
      const d = await res.json()
      if (!res.ok || !d.success) { setError(d.message ?? '저장 실패'); setSubmitting(false); return }
      router.push('/m/register/pending')
    } catch { setError('네트워크 오류'); setSubmitting(false) }
  }

  if (loading) return <div className="flex items-center justify-center min-h-[60vh] text-gray-500">로딩 중...</div>

  return (
    <div className="px-5 py-8">
      {/* 스텝 */}
      <div className="flex items-center justify-between mb-7">
        {['약관', '인증', '정보입력', '대기'].map((s, i) => (
          <div key={s} className="flex flex-col items-center flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold mb-1 ${
              i < 2 ? 'bg-green-500 text-white' : i === 2 ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-400'
            }`}>{i < 2 ? '✓' : i + 1}</div>
            <span className={`text-[11px] ${i === 2 ? 'text-orange-500 font-semibold' : 'text-gray-400'}`}>{s}</span>
          </div>
        ))}
      </div>

      {email && <div className="flex items-center gap-2 mb-5 px-4 py-2.5 bg-green-50 border border-green-200 rounded-2xl text-[14px] text-gray-700"><span className="text-green-600">✓</span>{email}</div>}
      {error && <div className="mb-5 rounded-2xl px-4 py-3.5 text-[14px] text-red-600 bg-red-50 border border-red-100">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div><label className="block text-[14px] font-semibold text-gray-700 mb-2">이름 <span className="text-orange-500">*</span></label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="실명" className={INPUT} /></div>

        <div><label className="block text-[14px] font-semibold text-gray-700 mb-2">직종 대분류</label>
          <div className="flex flex-wrap gap-2">
            {Object.keys(JOBS).map(c => (
              <button key={c} type="button" onClick={() => { setCat(c); setJob('') }}
                className={`px-3.5 py-2 rounded-full text-[14px] font-medium border ${cat === c ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-700 border-gray-200 active:bg-gray-50'}`}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {cat && <div><label className="block text-[14px] font-semibold text-gray-700 mb-2">직종 <span className="text-orange-500">*</span></label>
          <select value={job} onChange={e => setJob(e.target.value)} className={SELECT}>
            <option value="">선택</option>
            {(JOBS[cat] ?? []).map(j => <option key={j} value={j}>{j}</option>)}
            <option value="__custom__">직접입력</option>
          </select></div>}

        {job === '__custom__' && <input value={custom} onChange={e => setCustom(e.target.value)} placeholder="직종명 입력" className={INPUT} />}

        <div><label className="block text-[14px] font-semibold text-gray-700 mb-2">전화번호</label>
          <input value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="01012345678" inputMode="numeric" className={INPUT} /></div>

        <div><label className="block text-[14px] font-semibold text-gray-700 mb-2">생년월일</label>
          <input type="date" value={birth} onChange={e => setBirth(e.target.value)} className={INPUT} /></div>

        <button type="submit" disabled={submitting}
          className="w-full h-[50px] text-[16px] font-bold text-white bg-orange-500 active:bg-orange-600 rounded-2xl border-none cursor-pointer disabled:opacity-50 mt-2">
          {submitting ? '저장 중...' : '가입 완료'}
        </button>
      </form>
    </div>
  )
}
