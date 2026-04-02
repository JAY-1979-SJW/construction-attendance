'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { PageShell } from '@/components/admin/ui/PageShell'

interface InsuranceItem {
  id: string
  monthKey: string
  totalWorkDays: number
  totalConfirmedAmount: number
  nationalPensionEligible: boolean
  nationalPensionReason: string | null
  healthInsuranceEligible: boolean
  healthInsuranceReason: string | null
  employmentInsuranceEligible: boolean
  employmentInsuranceReason: string | null
  industrialAccidentEligible: boolean
  industrialAccidentReason: string | null
  worker: { id: string; name: string; employmentType: string; incomeType: string }
}

function getMonthKey() {
  const now = new Date(Date.now() + 9 * 3600000)
  return now.toISOString().slice(0, 7)
}

const EMP_LABEL: Record<string, string> = { REGULAR: '상용', DAILY_CONSTRUCTION: '건설일용', BUSINESS_33: '3.3%사업', OTHER: '기타' }

export default function InsuranceEligibilityPage() {
  const router = useRouter()
  const [monthKey, setMonthKey] = useState(getMonthKey())
  const [filter, setFilter]     = useState('all')
  const [items, setItems]       = useState<InsuranceItem[]>([])
  const [loading, setLoading]   = useState(false)
  const [running, setRunning]   = useState(false)
  const [msg, setMsg]           = useState('')

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/admin/insurance-eligibility?monthKey=${monthKey}&filter=${filter}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) { router.push('/admin/login'); return }
        setItems(d.data.items)
        setLoading(false)
      })
  }, [monthKey, filter, router])

  useEffect(() => { load() }, [load])

  const handleRun = async () => {
    if (!confirm(`${monthKey} 보험판정을 실행하시겠습니까?\n(근무확정이 완료된 상태여야 합니다)`)) return
    setRunning(true)
    const r = await fetch('/api/admin/insurance-eligibility/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monthKey }),
    }).then((r) => r.json())
    setRunning(false)
    setMsg(r.success ? `판정 완료 — 신규 ${r.data.created}건, 갱신 ${r.data.updated}건` : '실패')
    load()
  }

  const fmt = (n: number) => n.toLocaleString('ko-KR') + '원'
  const check = (v: boolean) => v ? <span className="text-[#2e7d32] font-bold">✅ 적용</span>
                                  : <span className="text-muted-brand">✗ 제외</span>

  const filterHeader = (
    <>
      <h1 className="text-2xl font-bold mb-2">4대보험 적용 판정</h1>
      <p className="text-[13px] text-muted-brand -mt-3 mb-5">
        국민연금 월 8일 이상/220만원 이상 · 건강보험 1개월 미만 일용 제외 · 고용보험 근로내용확인신고 대상
      </p>
      <div className="flex gap-3 flex-wrap items-center">
        <input type="month" value={monthKey} onChange={(e) => setMonthKey(e.target.value)} className="px-2.5 py-2 border border-secondary-brand/20 rounded-md text-sm bg-card" />
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="px-2.5 py-2 border border-secondary-brand/20 rounded-md text-sm bg-card">
          <option value="all">전체</option>
          <option value="eligible">국민연금 적용</option>
          <option value="ineligible">국민연금 제외</option>
        </select>
        <button onClick={handleRun} disabled={running} className="px-4 py-2 bg-[#7b1fa2] text-white border-none rounded-md cursor-pointer text-sm font-semibold">
          {running ? '판정 중...' : '보험판정 실행'}
        </button>
      </div>
    </>
  )

  return (
    <PageShell header={filterHeader}>
      {msg && <div className="px-4 py-3 bg-secondary-brand/10 rounded-lg mb-4 text-sm text-secondary-brand">{msg}</div>}

      <div className="bg-card rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] overflow-hidden">
        {loading ? <div className="py-8 text-center text-[#999]">로딩 중...</div> : (
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {['근로자', '고용형태', '근무일수', '확정금액', '국민연금', '건강보험', '고용보험', '산재보험'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-brand border-b border-secondary-brand/20 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-6 text-[#999]">데이터 없음 — 보험판정 실행을 먼저 하세요</td></tr>
                ) : items.map((item) => (
                  <tr key={item.id} className="cursor-default">
                    <td className="px-4 py-3 text-[13px] text-dim-brand border-b border-secondary-brand/10 align-top">{item.worker.name}</td>
                    <td className="px-4 py-3 text-[13px] text-dim-brand border-b border-secondary-brand/10 align-top">{EMP_LABEL[item.worker.employmentType] ?? item.worker.employmentType}</td>
                    <td className="px-4 py-3 text-[13px] text-dim-brand border-b border-secondary-brand/10 align-top text-center">{item.totalWorkDays}일</td>
                    <td className="px-4 py-3 text-[13px] text-dim-brand border-b border-secondary-brand/10 align-top text-right">{fmt(item.totalConfirmedAmount)}</td>
                    <td className="px-4 py-3 text-[13px] text-dim-brand border-b border-secondary-brand/10 align-top">
                      {check(item.nationalPensionEligible)}
                      <div className="text-[11px] text-muted-brand mt-0.5">{item.nationalPensionReason ?? ''}</div>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-dim-brand border-b border-secondary-brand/10 align-top">
                      {check(item.healthInsuranceEligible)}
                      <div className="text-[11px] text-muted-brand mt-0.5">{item.healthInsuranceReason ?? ''}</div>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-dim-brand border-b border-secondary-brand/10 align-top">
                      {check(item.employmentInsuranceEligible)}
                      <div className="text-[11px] text-muted-brand mt-0.5">{item.employmentInsuranceReason ?? ''}</div>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-dim-brand border-b border-secondary-brand/10 align-top">
                      {check(item.industrialAccidentEligible)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageShell>
  )
}
