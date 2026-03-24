'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface WageItem {
  id: string
  monthKey: string
  incomeType: string
  regularDays: number
  halfDays: number
  grossAmount: number
  nonTaxableAmount: number
  taxableAmount: number
  worker: { id: string; name: string; employmentType: string; incomeType: string }
  withholding: {
    incomeTaxAmount: number
    localIncomeTaxAmount: number
    formulaCode: string
  } | null
}

interface Totals { gross: number; nonTaxable: number; taxable: number; incomeTax: number; localTax: number }

function getMonthKey() {
  const now = new Date(Date.now() + 9 * 3600000)
  return now.toISOString().slice(0, 7)
}

const INCOME_LABEL: Record<string, string> = { SALARY: '상용급여', DAILY_WAGE: '일용', BUSINESS_INCOME: '3.3%사업소득' }
const INCOME_COLOR: Record<string, string> = { SALARY: '#1565c0', DAILY_WAGE: '#2e7d32', BUSINESS_INCOME: '#e65100' }
const FORMULA_LABEL: Record<string, string> = {
  DAILY_WAGE_2024: '일용 원천징수(일 15만공제 + 6% × 45%)',
  BUSINESS_33: '3.3% (소득세3% + 지방세0.3%)',
  SALARY_TABLE: '간이세액표(상용)',
}

export default function WageCalculationsPage() {
  const router = useRouter()
  const [monthKey, setMonthKey]       = useState(getMonthKey())
  const [incomeFilter, setIncomeFilter] = useState('')
  const [items, setItems]             = useState<WageItem[]>([])
  const [totals, setTotals]           = useState<Totals | null>(null)
  const [loading, setLoading]         = useState(false)
  const [running, setRunning]         = useState(false)
  const [msg, setMsg]                 = useState('')

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/admin/wage-calculations?monthKey=${monthKey}&incomeType=${incomeFilter}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) { router.push('/admin/login'); return }
        setItems(d.data.items)
        setTotals(d.data.totals)
        setLoading(false)
      })
  }, [monthKey, incomeFilter, router])

  useEffect(() => { load() }, [load])

  const handleRun = async () => {
    if (!confirm(`${monthKey} 세금 계산을 실행하시겠습니까?`)) return
    setRunning(true)
    const r = await fetch('/api/admin/wage-calculations/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monthKey }),
    }).then((r) => r.json())
    setRunning(false)
    setMsg(r.success ? `계산 완료 — 신규 ${r.data.created}건` : '실패')
    load()
  }

  const fmt = (n: number) => n.toLocaleString('ko-KR')

  return (
    <div className="p-8 overflow-auto">
        <h1 className="text-2xl font-bold mb-6">세금/노임 계산</h1>

        <div className="flex gap-3 mb-5 flex-wrap items-center">
          <input type="month" value={monthKey} onChange={(e) => setMonthKey(e.target.value)} className="px-[10px] py-2 border border-[rgba(91,164,217,0.2)] rounded-md text-[14px] bg-card" />
          <select value={incomeFilter} onChange={(e) => setIncomeFilter(e.target.value)} className="px-[10px] py-2 border border-[rgba(91,164,217,0.2)] rounded-md text-[14px] bg-card">
            <option value="">전체 소득유형</option>
            <option value="DAILY_WAGE">일용근로소득</option>
            <option value="SALARY">상용급여</option>
            <option value="BUSINESS_INCOME">3.3%사업소득</option>
          </select>
          <button onClick={handleRun} disabled={running} className="px-4 py-2 bg-[#7b1fa2] text-white border-0 rounded-md cursor-pointer text-[14px] font-semibold">
            {running ? '계산 중...' : '세금계산 실행'}
          </button>
        </div>

        {msg && <div className="px-4 py-3 bg-[rgba(91,164,217,0.1)] rounded-lg mb-4 text-[14px] text-[#4A93C8]">{msg}</div>}

        {/* 합계 */}
        {totals && (
          <div className="flex gap-3 mb-5 flex-wrap">
            {[
              { label: '총 지급액', value: fmt(totals.gross) + '원',     color: '#5BA4D9' },
              { label: '비과세',    value: fmt(totals.nonTaxable) + '원', color: '#388e3c' },
              { label: '과세표준',  value: fmt(totals.taxable) + '원',    color: '#e65100' },
              { label: '소득세',    value: fmt(totals.incomeTax) + '원',  color: '#b71c1c' },
              { label: '지방소득세', value: fmt(totals.localTax) + '원',  color: '#7b1fa2' },
            ].map((c) => (
              <div key={c.label} className="bg-card rounded-[10px] px-5 py-4 min-w-[140px] shadow-[0_2px_8px_rgba(0,0,0,0.35)]" style={{ borderTop: `4px solid ${c.color}` }}>
                <div className="text-[18px] font-bold" style={{ color: c.color }}>{c.value}</div>
                <div className="text-[12px] text-muted-brand">{c.label}</div>
              </div>
            ))}
          </div>
        )}

        <div className="bg-card rounded-[12px] shadow-[0_2px_8px_rgba(0,0,0,0.35)] overflow-hidden">
          {loading ? <div className="py-8 text-center text-[#999]">로딩 중...</div> : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {['근로자', '소득유형', '근무일수', '총지급액', '비과세', '과세표준', '소득세', '지방소득세', '공식'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-[12px] font-semibold text-muted-brand border-b border-[rgba(91,164,217,0.2)] whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={9} className="text-center py-6 text-[#999]">데이터 없음 — 세금계산 실행을 먼저 하세요</td></tr>
                  ) : items.map((item) => (
                    <tr key={item.id} className="cursor-default">
                      <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[rgba(91,164,217,0.1)] align-top">{item.worker.name}</td>
                      <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[rgba(91,164,217,0.1)] align-top">
                        <span className="font-semibold text-[12px]" style={{ color: INCOME_COLOR[item.incomeType] }}>
                          {INCOME_LABEL[item.incomeType] ?? item.incomeType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[rgba(91,164,217,0.1)] align-top text-center">
                        {Number(item.regularDays) + Number(item.halfDays)}일
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[rgba(91,164,217,0.1)] align-top text-right">{fmt(item.grossAmount)}</td>
                      <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[rgba(91,164,217,0.1)] align-top text-right">{fmt(item.nonTaxableAmount)}</td>
                      <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[rgba(91,164,217,0.1)] align-top text-right">{fmt(item.taxableAmount)}</td>
                      <td className="px-4 py-3 text-[13px] text-[#b71c1c] border-b border-[rgba(91,164,217,0.1)] align-top text-right">
                        {fmt(item.withholding?.incomeTaxAmount ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[#7b1fa2] border-b border-[rgba(91,164,217,0.1)] align-top text-right">
                        {fmt(item.withholding?.localIncomeTaxAmount ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-muted-brand border-b border-[rgba(91,164,217,0.1)] align-top max-w-[200px]">
                        {FORMULA_LABEL[item.withholding?.formulaCode ?? ''] ?? item.withholding?.formulaCode ?? '-'}
                      </td>
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

const NAV_ITEMS = [
  { href: '/admin',                       label: '대시보드' },
  { href: '/admin/workers',               label: '근로자 관리' },
  { href: '/admin/companies', label: '회사 관리' },
  { href: '/admin/sites',                 label: '현장 관리' },
  { href: '/admin/attendance',            label: '출퇴근 조회' },
  { href: '/admin/presence-checks',       label: '체류확인 현황' },
  { href: '/admin/presence-report',       label: '체류확인 리포트' },
  { href: '/admin/work-confirmations',    label: '근무확정' },
  { href: '/admin/contracts',             label: '인력/계약 관리' },
  { href: '/admin/insurance-eligibility', label: '보험판정' },
  { href: '/admin/wage-calculations',     label: '세금/노임 계산' },
  { href: '/admin/filing-exports',        label: '신고자료 내보내기' },
  { href: '/admin/retirement-mutual',     label: '퇴직공제' },
  { href: '/admin/labor-cost-summaries',  label: '노무비 집계' },
  { href: '/admin/month-closings',        label: '월마감' },
  { href: '/admin/corrections',           label: '정정 이력' },
  { href: '/admin/exceptions',            label: '예외 승인' },
  { href: '/admin/device-requests',       label: '기기 변경' },
]
