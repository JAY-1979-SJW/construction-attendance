'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

interface WorkerInfo {
  id: string
  name: string
  email: string | null
  phone: string | null
  jobTitle: string | null
}

export default function RegisterCompletePage() {
  const router = useRouter()
  const [worker, setWorker] = useState<WorkerInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [jobTitle, setJobTitle] = useState('')

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (!d.success) {
          router.push('/login')
          return
        }
        setWorker(d.data)
        setName(d.data.name ?? '')
        setPhone(d.data.phone ?? '')
        setJobTitle(d.data.jobTitle === '미설정' ? '' : (d.data.jobTitle ?? ''))
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false))
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!name.trim()) { setError('이름을 입력해 주세요.'); return }
    if (!/^010\d{8}$/.test(phone)) { setError('전화번호를 올바르게 입력해 주세요. (01012345678)'); return }
    if (!jobTitle.trim()) { setError('직종을 입력해 주세요.'); return }

    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone, jobTitle: jobTitle.trim() }),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        setError(data.message ?? '프로필 저장에 실패했습니다.')
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
      <div className="bg-white rounded-2xl px-8 py-10 w-full max-w-[460px] shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-[#E5E7EB] border-t-[3px] border-t-[#F97316]">
        <div className="text-center mb-5">
          <Image src="/logo/logo_main.png" alt="해한Ai Engineering" width={240} height={180} className="w-[160px] h-auto mx-auto block rounded-2xl" priority />
        </div>

        <h1 className="text-xl font-extrabold text-[#111827] tracking-[-0.5px] mb-2">추가 정보 입력</h1>
        <p className="text-sm text-[#6B7280] leading-[1.6] mb-1">
          출퇴근 관리에 필요한 정보를 입력해 주세요.
        </p>
        {worker?.email && (
          <p className="text-[13px] text-[#F97316] font-semibold mb-6">{worker.email}</p>
        )}

        {error && (
          <div className="bg-[rgba(220,38,38,0.08)] border border-[rgba(220,38,38,0.3)] rounded-[10px] px-4 py-3 mb-5 text-[#dc2626] text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label className="block text-[13px] font-semibold text-[#6B7280] mb-[6px]">
            이름 <span className="text-[#F97316]">*</span>
          </label>
          <input
            className="w-full px-[14px] py-3 border border-[#E5E7EB] rounded-[10px] text-[15px] box-border bg-white text-[#111827] outline-none focus:border-[#F97316] mb-4"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            minLength={2}
            maxLength={30}
            placeholder="홍길동"
          />

          <label className="block text-[13px] font-semibold text-[#6B7280] mb-[6px]">
            휴대폰번호 <span className="text-[#F97316]">*</span>
          </label>
          <input
            className="w-full px-[14px] py-3 border border-[#E5E7EB] rounded-[10px] text-[15px] box-border bg-white text-[#111827] outline-none focus:border-[#F97316] mb-4"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            required
            pattern="^010\d{8}$"
            placeholder="01012345678"
            maxLength={11}
            inputMode="numeric"
          />

          <label className="block text-[13px] font-semibold text-[#6B7280] mb-[6px]">
            직종 <span className="text-[#F97316]">*</span>
          </label>
          <input
            className="w-full px-[14px] py-3 border border-[#E5E7EB] rounded-[10px] text-[15px] box-border bg-white text-[#111827] outline-none focus:border-[#F97316] mb-6"
            value={jobTitle}
            onChange={e => setJobTitle(e.target.value)}
            required
            maxLength={50}
            placeholder="형틀목수, 철근공, 조적공 등"
          />

          <button
            type="submit"
            disabled={submitting}
            className="block w-full py-[14px] bg-[#F97316] text-white border-none rounded-[10px] text-base font-bold cursor-pointer shadow-[0_4px_14px_rgba(249,115,22,0.35)] disabled:opacity-60"
          >
            {submitting ? '저장 중...' : '가입 완료'}
          </button>
        </form>
      </div>
    </div>
  )
}
