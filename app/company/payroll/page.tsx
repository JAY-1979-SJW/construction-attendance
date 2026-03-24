'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface PayrollRow {
  workerId: string
  workerName: string
  employmentType: string
  incomeType: string
  workDays: number
  workUnits: number
  grossAmount: number
  incomeTax: number
  localTax: number
  netAmount: number
  confirmedCount: number
  hasWageCalc: boolean
}

interface Totals {
  workerCount: number
  workUnits: number
  grossAmount: number
  taxAmount: number
  netAmount: number
}

const EMP_LABEL: Record<string, string> = {
  DAILY_CONSTRUCTION: '일용직',
  REGULAR:            '상용직',
  BUSINESS_33:        '사업소득',
  OTHER:              '기타',
}

const INCOME_LABEL: Record<string, string> = {
  DAILY_WAGE:       '일당',
  SALARY:           '월급',
  BUSINESS_INCOME:  '사업소득',
}

function fmt(n: number) {
  return n.toLocaleString('ko-KR') + '원'
}

function currentMonthKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function CompanyPayrollPage() {
  const router = useRouter()
  const [monthKey, setMonthKey] = useState(currentMonthKey())
  const [items, setItems] = useState<PayrollRow[]>([])
  const [totals, setTotals] = useState<Totals | null>(null)
  const [totalWorkers, setTotalWorkers] = useState(0)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [blocked, setBlocked] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setMsg('')
    try {
      const res = await fetch(`/api/company/payroll?monthKey=${monthKey}`)
      if (res.status === 401) { router.push('/company/login'); return }
      if (res.status === 403) {
        setBlocked(true)
        const d = await res.json()
        setMsg(d.message ?? '이 기능을 사용할 권한이 없습니다. 플랜 업그레이드가 필요합니다.')
        return
      }
      const data = await res.json()
      if (!data.success) { setMsg(data.message ?? '조회 실패'); return }
      setItems(data.data.items ?? [])
      setTotals(data.data.totals ?? null)
      setTotalWorkers(data.data.totalWorkers ?? 0)
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
          <h1 className="text-[22px] font-bold m-0">공수 · 급여 현황</h1>
          <p className="text-[13px] text-muted-brand mt-1 mb-0">월별 근로자별 공수 확정 및 임금 집계를 조회합니다.</p>
        </div>
        <div className="flex gap-[10px] items-center">
          <select value={monthKey} onChange={e => setMonthKey(e.target.value)} className="px-3 py-2 rounded-md border border-white/[0.12] text-[14px] cursor-pointer">
            {months.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <button onClick={load} disabled={loading} className="px-5 py-2 bg-[#0f4c75] text-white border-none rounded-md cursor-pointer text-[14px] font-semibold">
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

      {!blocked && totals && (
        <div className="flex gap-3 mb-5 flex-wrap">
          {[
            { label: '대상 근로자', value: `${totalWorkers}명` },
            { label: '공수 집계 근로자', value: `${totals.workerCount}명` },
            { label: '총 공수', value: `${totals.workUnits.toFixed(2)}일` },
            { label: '총 지급액', value: fmt(totals.grossAmount) },
            { label: '총 세금', value: fmt(totals.taxAmount) },
            { label: '총 실지급', value: fmt(totals.netAmount) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-card rounded-[10px] px-5 py-[14px] min-w-[130px] shadow-[0_2px_8px_rgba(0,0,0,0.35)] text-center">
              <div className="text-[18px] font-bold text-[#1a237e] mb-1">{value}</div>
              <div className="text-[12px] text-muted-brand">{label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-card rounded-[10px] shadow-[0_2px_8px_rgba(0,0,0,0.35)] overflow-hidden">
        {loading ? (
          <div className="px-12 py-12 text-center text-[#999]">조회 중...</div>
        ) : blocked ? (
          <div className="px-12 py-12 text-center text-[#999]">
            <div className="text-[32px] mb-[10px]">🔒</div>
            <div className="font-semibold">급여 조회 기능이 비활성화되어 있습니다.</div>
          </div>
        ) : items.length === 0 ? (
          <div className="px-12 py-12 text-center text-[#999]">
            <div className="font-semibold">{monthKey} 공수 데이터가 없습니다.</div>
            <div className="text-[13px] text-[#aaa] mt-1">근무 확정 후 조회 가능합니다.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  {['근로자명', '고용형태', '소득유형', '근무일수', '공수(일)', '지급총액', '소득세', '지방세', '실지급액', '임금계산'].map(h => (
                    <th key={h} className="bg-brand px-3 py-[10px] text-left font-semibold text-muted-brand border-b border-[#e0e0e0] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((row, i) => (
                  <tr key={row.workerId} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td className="px-3 py-[10px] border-b border-[rgba(91,164,217,0.1)] align-middle font-semibold">{row.workerName}</td>
                    <td className="px-3 py-[10px] border-b border-[rgba(91,164,217,0.1)] align-middle">{EMP_LABEL[row.employmentType] ?? row.employmentType}</td>
                    <td className="px-3 py-[10px] border-b border-[rgba(91,164,217,0.1)] align-middle">{INCOME_LABEL[row.incomeType] ?? row.incomeType}</td>
                    <td className="px-3 py-[10px] border-b border-[rgba(91,164,217,0.1)] align-middle text-right">{row.workDays}일</td>
                    <td className="px-3 py-[10px] border-b border-[rgba(91,164,217,0.1)] align-middle text-right">{row.workUnits.toFixed(2)}</td>
                    <td className="px-3 py-[10px] border-b border-[rgba(91,164,217,0.1)] align-middle text-right">{fmt(row.grossAmount)}</td>
                    <td className="px-3 py-[10px] border-b border-[rgba(91,164,217,0.1)] align-middle text-right text-[#c62828]">{fmt(row.incomeTax)}</td>
                    <td className="px-3 py-[10px] border-b border-[rgba(91,164,217,0.1)] align-middle text-right text-[#c62828]">{fmt(row.localTax)}</td>
                    <td className="px-3 py-[10px] border-b border-[rgba(91,164,217,0.1)] align-middle text-right font-semibold">{fmt(row.netAmount)}</td>
                    <td className="px-3 py-[10px] border-b border-[rgba(91,164,217,0.1)] align-middle">
                      <span
                        className="text-[11px] px-2 py-[2px] rounded-lg"
                        style={{
                          background: row.hasWageCalc ? '#e8f5e9' : '#f5f5f5',
                          color: row.hasWageCalc ? '#2e7d32' : '#999',
                        }}
                      >
                        {row.hasWageCalc ? '계산 완료' : '미계산'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              {totals && (
                <tfoot>
                  <tr className="bg-[#f0f4ff] font-bold">
                    <td className="px-3 py-[10px] border-b border-[rgba(91,164,217,0.1)] align-middle" colSpan={3}>합계</td>
                    <td className="px-3 py-[10px] border-b border-[rgba(91,164,217,0.1)] align-middle text-right"></td>
                    <td className="px-3 py-[10px] border-b border-[rgba(91,164,217,0.1)] align-middle text-right">{totals.workUnits.toFixed(2)}</td>
                    <td className="px-3 py-[10px] border-b border-[rgba(91,164,217,0.1)] align-middle text-right">{fmt(totals.grossAmount)}</td>
                    <td className="px-3 py-[10px] border-b border-[rgba(91,164,217,0.1)] align-middle text-right text-[#c62828]">{fmt(totals.taxAmount)}</td>
                    <td className="px-3 py-[10px] border-b border-[rgba(91,164,217,0.1)] align-middle text-right text-[#c62828]"></td>
                    <td className="px-3 py-[10px] border-b border-[rgba(91,164,217,0.1)] align-middle text-right">{fmt(totals.netAmount)}</td>
                    <td className="px-3 py-[10px] border-b border-[rgba(91,164,217,0.1)] align-middle"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
