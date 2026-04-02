'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface InsuranceRow {
  workerId: string
  workerName: string
  employmentType: string
  fourInsurancesEligibleYn: boolean
  retirementMutualTargetYn: boolean
  totalWorkDays: number | null
  totalConfirmedAmount: number | null
  nationalPension:     { eligible: boolean | null; reason: string }
  healthInsurance:     { eligible: boolean | null; reason: string }
  employmentInsurance: { eligible: boolean | null; reason: string }
  industrialAccident:  { eligible: boolean | null; reason: string }
  hasSnapshot: boolean
}

interface Summary {
  total: number
  npEligible: number
  hiEligible: number
  eiEligible: number
  iaEligible: number
  noSnapshot: number
}

const EMP_LABEL: Record<string, string> = {
  DAILY_CONSTRUCTION: '일용직',
  REGULAR:            '상용직',
  BUSINESS_33:        '사업소득',
  OTHER:              '기타',
}

function EligibleBadge({ eligible, reason }: { eligible: boolean | null; reason: string }) {
  if (eligible === null) return <span className="text-[11px] text-muted2-brand" title={reason}>미판정</span>
  return (
    <span
      title={reason}
      className="text-[11px] px-2 py-[2px] rounded-lg cursor-help"
      style={{
        background: eligible ? '#e8f5e9' : '#ffebee',
        color: eligible ? '#2e7d32' : '#c62828',
      }}
    >
      {eligible ? '대상' : '제외'}
    </span>
  )
}

function currentMonthKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function CompanyInsurancePage() {
  const router = useRouter()
  const [monthKey, setMonthKey] = useState(currentMonthKey())
  const [items, setItems] = useState<InsuranceRow[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [blocked, setBlocked] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setMsg('')
    try {
      const res = await fetch(`/api/company/insurance?monthKey=${monthKey}`)
      if (res.status === 401) { router.push('/company/login'); return }
      if (res.status === 403) {
        setBlocked(true)
        const d = await res.json()
        setMsg(d.message ?? '이 기능은 유료 플랜에서 사용 가능합니다.')
        return
      }
      const data = await res.json()
      if (!data.success) { setMsg(data.message ?? '조회 실패'); return }
      setItems(data.data.items ?? [])
      setSummary(data.data.summary ?? null)
      setBlocked(false)
    } catch {
      setMsg('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [monthKey, router])

  useEffect(() => { load() }, [load])

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  return (
    <div className="p-8 max-w-[1200px]">
      <div className="flex justify-between items-start mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-bold m-0">4대보험 판정 현황</h1>
          <p className="text-[13px] text-muted-brand mt-1 mb-0">국민연금 · 건강보험 · 고용보험 · 산재보험 대상 여부를 월별로 확인합니다.</p>
        </div>
        <div className="flex gap-[10px] items-center">
          <select value={monthKey} onChange={e => setMonthKey(e.target.value)} className="px-3 py-2 rounded-md border border-brand text-[14px] cursor-pointer">
            {months.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <button onClick={load} disabled={loading} className="px-5 py-2 bg-brand-accent text-white border-none rounded-md cursor-pointer text-[14px] font-semibold">
            {loading ? '조회중...' : '조회'}
          </button>
        </div>
      </div>

      {msg && (
        <div
          className="px-[18px] py-[14px] rounded-lg mb-4 text-[14px]"
          style={{
            background: blocked ? '#fff3e0' : '#ffebee',
            color: blocked ? '#e65100' : '#c62828',
          }}
        >
          {msg}
          {blocked && <div className="mt-[6px] text-[13px]">관리자(슈퍼관리자)에게 기능 활성화를 요청하세요.</div>}
        </div>
      )}

      {!blocked && summary && (
        <div className="flex gap-3 mb-5 flex-wrap">
          {[
            { label: '전체 근로자', value: `${summary.total}명` },
            { label: '국민연금 대상', value: `${summary.npEligible}명`, color: '#4A93C8' },
            { label: '건강보험 대상', value: `${summary.hiEligible}명`, color: '#2e7d32' },
            { label: '고용보험 대상', value: `${summary.eiEligible}명`, color: '#6a1b9a' },
            { label: '산재보험 대상', value: `${summary.iaEligible}명`, color: '#e65100' },
            { label: '판정 미실행', value: `${summary.noSnapshot}명`, color: '#A0AEC0' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-card rounded-[10px] px-5 py-[14px] min-w-[120px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] text-center">
              <div className="text-[18px] font-bold mb-1" style={{ color: color ?? '#1a237e' }}>{value}</div>
              <div className="text-[12px] text-muted-brand">{label}</div>
            </div>
          ))}
        </div>
      )}

      {!blocked && summary && summary.noSnapshot > 0 && (
        <div className="bg-[#fff8e1] border border-[#ffe082] rounded-lg px-4 py-[10px] mb-4 text-[13px] text-[#f57f17]">
          ※ 판정 미실행 근로자 {summary.noSnapshot}명 — 슈퍼관리자 메뉴에서 &apos;보험판정 실행&apos; 후 조회 가능합니다.
        </div>
      )}

      <div className="bg-card rounded-[10px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden">
        {loading ? (
          <div className="px-12 py-12 text-center text-muted2-brand">조회 중...</div>
        ) : blocked ? (
          <div className="px-12 py-12 text-center text-muted2-brand">
            <div className="text-[32px] mb-[10px]">🔒</div>
            <div className="font-semibold">4대보험 서류 기능이 비활성화되어 있습니다.</div>
          </div>
        ) : items.length === 0 ? (
          <div className="px-12 py-12 text-center text-muted2-brand">
            <div className="font-semibold">{monthKey} 소속 근로자가 없습니다.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  {['근로자명', '고용형태', '4보험대상', '퇴직공제', '근무일수', '확정금액', '국민연금', '건강보험', '고용보험', '산재보험'].map(h => (
                    <th key={h} className="bg-brand px-3 py-[10px] text-left font-semibold text-muted-brand border-b border-brand whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((row, i) => (
                  <tr key={row.workerId} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td className="px-3 py-[10px] border-b border-brand align-middle font-semibold">{row.workerName}</td>
                    <td className="px-3 py-[10px] border-b border-brand align-middle">{EMP_LABEL[row.employmentType] ?? row.employmentType}</td>
                    <td className="px-3 py-[10px] border-b border-brand align-middle">
                      <EligibleBadge eligible={row.fourInsurancesEligibleYn} reason="근로자 기본 설정" />
                    </td>
                    <td className="px-3 py-[10px] border-b border-brand align-middle">
                      <span
                        className="text-[11px] px-2 py-[2px] rounded-lg"
                        style={{
                          background: row.retirementMutualTargetYn ? '#e3f2fd' : '#f5f5f5',
                          color: row.retirementMutualTargetYn ? '#1565c0' : '#999',
                        }}
                      >
                        {row.retirementMutualTargetYn ? '대상' : '제외'}
                      </span>
                    </td>
                    <td className="px-3 py-[10px] border-b border-brand align-middle text-right">
                      {row.totalWorkDays != null ? `${row.totalWorkDays}일` : '-'}
                    </td>
                    <td className="px-3 py-[10px] border-b border-brand align-middle text-right">
                      {row.totalConfirmedAmount != null ? row.totalConfirmedAmount.toLocaleString('ko-KR') + '원' : '-'}
                    </td>
                    <td className="px-3 py-[10px] border-b border-brand align-middle"><EligibleBadge eligible={row.nationalPension.eligible} reason={row.nationalPension.reason} /></td>
                    <td className="px-3 py-[10px] border-b border-brand align-middle"><EligibleBadge eligible={row.healthInsurance.eligible} reason={row.healthInsurance.reason} /></td>
                    <td className="px-3 py-[10px] border-b border-brand align-middle"><EligibleBadge eligible={row.employmentInsurance.eligible} reason={row.employmentInsurance.reason} /></td>
                    <td className="px-3 py-[10px] border-b border-brand align-middle"><EligibleBadge eligible={row.industrialAccident.eligible} reason={row.industrialAccident.reason} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
