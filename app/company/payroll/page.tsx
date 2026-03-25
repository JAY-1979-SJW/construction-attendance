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
  DAILY_CONSTRUCTION: '?¼ìš©ì§?,
  REGULAR:            '?ìš©ì§?,
  BUSINESS_33:        '?¬ì—…?Œë“',
  OTHER:              'ê¸°í?',
}

const INCOME_LABEL: Record<string, string> = {
  DAILY_WAGE:       '?¼ë‹¹',
  SALARY:           '?”ê¸‰',
  BUSINESS_INCOME:  '?¬ì—…?Œë“',
}

function fmt(n: number) {
  return n.toLocaleString('ko-KR') + '??
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
        setMsg(d.message ?? '??ê¸°ëŠ¥???¬ìš©??ê¶Œí•œ???†ìŠµ?ˆë‹¤. ?Œëœ ?…ê·¸?ˆì´?œê? ?„ìš”?©ë‹ˆ??')
        return
      }
      const data = await res.json()
      if (!data.success) { setMsg(data.message ?? 'ì¡°íšŒ ?¤íŒ¨'); return }
      setItems(data.data.items ?? [])
      setTotals(data.data.totals ?? null)
      setTotalWorkers(data.data.totalWorkers ?? 0)
      setBlocked(false)
    } catch {
      setMsg('?¤íŠ¸?Œí¬ ?¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.')
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
          <h1 className="text-[22px] font-bold m-0">ê³µìˆ˜ Â· ê¸‰ì—¬ ?„í™©</h1>
          <p className="text-[13px] text-muted-brand mt-1 mb-0">?”ë³„ ê·¼ë¡œ?ë³„ ê³µìˆ˜ ?•ì • ë°??„ê¸ˆ ì§‘ê³„ë¥?ì¡°íšŒ?©ë‹ˆ??</p>
        </div>
        <div className="flex gap-[10px] items-center">
          <select value={monthKey} onChange={e => setMonthKey(e.target.value)} className="px-3 py-2 rounded-md border border-white/[0.12] text-[14px] cursor-pointer">
            {months.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <button onClick={load} disabled={loading} className="px-5 py-2 bg-[#F97316] text-white border-none rounded-md cursor-pointer text-[14px] font-semibold">
            {loading ? 'ì¡°íšŒì¤?..' : 'ì¡°íšŒ'}
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
          {blocked && <div className="mt-[6px] text-[13px]">ê´€ë¦¬ì(?ˆí¼ê´€ë¦¬ì)?ê²Œ ê¸°ëŠ¥ ?œì„±?”ë? ?”ì²­?˜ì„¸??</div>}
        </div>
      )}

      {!blocked && totals && (
        <div className="flex gap-3 mb-5 flex-wrap">
          {[
            { label: '?€??ê·¼ë¡œ??, value: `${totalWorkers}ëª? },
            { label: 'ê³µìˆ˜ ì§‘ê³„ ê·¼ë¡œ??, value: `${totals.workerCount}ëª? },
            { label: 'ì´?ê³µìˆ˜', value: `${totals.workUnits.toFixed(2)}?? },
            { label: 'ì´?ì§€ê¸‰ì•¡', value: fmt(totals.grossAmount) },
            { label: 'ì´??¸ê¸ˆ', value: fmt(totals.taxAmount) },
            { label: 'ì´??¤ì?ê¸?, value: fmt(totals.netAmount) },
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
          <div className="px-12 py-12 text-center text-[#999]">ì¡°íšŒ ì¤?..</div>
        ) : blocked ? (
          <div className="px-12 py-12 text-center text-[#999]">
            <div className="text-[32px] mb-[10px]">?”’</div>
            <div className="font-semibold">ê¸‰ì—¬ ì¡°íšŒ ê¸°ëŠ¥??ë¹„í™œ?±í™”?˜ì–´ ?ˆìŠµ?ˆë‹¤.</div>
          </div>
        ) : items.length === 0 ? (
          <div className="px-12 py-12 text-center text-[#999]">
            <div className="font-semibold">{monthKey} ê³µìˆ˜ ?°ì´?°ê? ?†ìŠµ?ˆë‹¤.</div>
            <div className="text-[13px] text-[#aaa] mt-1">ê·¼ë¬´ ?•ì • ??ì¡°íšŒ ê°€?¥í•©?ˆë‹¤.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  {['ê·¼ë¡œ?ëª…', 'ê³ ìš©?•íƒœ', '?Œë“? í˜•', 'ê·¼ë¬´?¼ìˆ˜', 'ê³µìˆ˜(??', 'ì§€ê¸‰ì´??, '?Œë“??, 'ì§€ë°©ì„¸', '?¤ì?ê¸‰ì•¡', '?„ê¸ˆê³„ì‚°'].map(h => (
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
                    <td className="px-3 py-[10px] border-b border-[rgba(91,164,217,0.1)] align-middle text-right">{row.workDays}??/td>
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
                        {row.hasWageCalc ? 'ê³„ì‚° ?„ë£Œ' : 'ë¯¸ê³„??}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              {totals && (
                <tfoot>
                  <tr className="bg-[#f0f4ff] font-bold">
                    <td className="px-3 py-[10px] border-b border-[rgba(91,164,217,0.1)] align-middle" colSpan={3}>?©ê³„</td>
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
