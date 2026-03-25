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
  DAILY_CONSTRUCTION: '?¼ìš©ì§?,
  REGULAR:            '?ìš©ì§?,
  BUSINESS_33:        '?¬ì—…?Œë“',
  OTHER:              'ê¸°í?',
}

function EligibleBadge({ eligible, reason }: { eligible: boolean | null; reason: string }) {
  if (eligible === null) return <span className="text-[11px] text-[#bbb]" title={reason}>ë¯¸íŒ??/span>
  return (
    <span
      title={reason}
      className="text-[11px] px-2 py-[2px] rounded-lg cursor-help"
      style={{
        background: eligible ? '#e8f5e9' : '#ffebee',
        color: eligible ? '#2e7d32' : '#c62828',
      }}
    >
      {eligible ? '?€?? : '?œì™¸'}
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
        setMsg(d.message ?? '??ê¸°ëŠ¥?€ ? ë£Œ ?Œëœ?ì„œ ?¬ìš© ê°€?¥í•©?ˆë‹¤.')
        return
      }
      const data = await res.json()
      if (!data.success) { setMsg(data.message ?? 'ì¡°íšŒ ?¤íŒ¨'); return }
      setItems(data.data.items ?? [])
      setSummary(data.data.summary ?? null)
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
          <h1 className="text-[22px] font-bold m-0">4?€ë³´í—˜ ?ì • ?„í™©</h1>
          <p className="text-[13px] text-muted-brand mt-1 mb-0">êµ???°ê¸ˆ Â· ê±´ê°•ë³´í—˜ Â· ê³ ìš©ë³´í—˜ Â· ?°ì¬ë³´í—˜ ?€???¬ë?ë¥??”ë³„ë¡??•ì¸?©ë‹ˆ??</p>
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

      {!blocked && summary && (
        <div className="flex gap-3 mb-5 flex-wrap">
          {[
            { label: '?„ì²´ ê·¼ë¡œ??, value: `${summary.total}ëª? },
            { label: 'êµ???°ê¸ˆ ?€??, value: `${summary.npEligible}ëª?, color: '#4A93C8' },
            { label: 'ê±´ê°•ë³´í—˜ ?€??, value: `${summary.hiEligible}ëª?, color: '#2e7d32' },
            { label: 'ê³ ìš©ë³´í—˜ ?€??, value: `${summary.eiEligible}ëª?, color: '#6a1b9a' },
            { label: '?°ì¬ë³´í—˜ ?€??, value: `${summary.iaEligible}ëª?, color: '#e65100' },
            { label: '?ì • ë¯¸ì‹¤??, value: `${summary.noSnapshot}ëª?, color: '#A0AEC0' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-card rounded-[10px] px-5 py-[14px] min-w-[120px] shadow-[0_2px_8px_rgba(0,0,0,0.35)] text-center">
              <div className="text-[18px] font-bold mb-1" style={{ color: color ?? '#1a237e' }}>{value}</div>
              <div className="text-[12px] text-muted-brand">{label}</div>
            </div>
          ))}
        </div>
      )}

      {!blocked && summary && summary.noSnapshot > 0 && (
        <div className="bg-[#fff8e1] border border-[#ffe082] rounded-lg px-4 py-[10px] mb-4 text-[13px] text-[#f57f17]">
          ???ì • ë¯¸ì‹¤??ê·¼ë¡œ??{summary.noSnapshot}ëª????ˆí¼ê´€ë¦¬ì ë©”ë‰´?ì„œ &apos;ë³´í—˜?ì • ?¤í–‰&apos; ??ì¡°íšŒ ê°€?¥í•©?ˆë‹¤.
        </div>
      )}

      <div className="bg-card rounded-[10px] shadow-[0_2px_8px_rgba(0,0,0,0.35)] overflow-hidden">
        {loading ? (
          <div className="px-12 py-12 text-center text-[#999]">ì¡°íšŒ ì¤?..</div>
        ) : blocked ? (
          <div className="px-12 py-12 text-center text-[#999]">
            <div className="text-[32px] mb-[10px]">?”’</div>
            <div className="font-semibold">4?€ë³´í—˜ ?œë¥˜ ê¸°ëŠ¥??ë¹„í™œ?±í™”?˜ì–´ ?ˆìŠµ?ˆë‹¤.</div>
          </div>
        ) : items.length === 0 ? (
          <div className="px-12 py-12 text-center text-[#999]">
            <div className="font-semibold">{monthKey} ?Œì† ê·¼ë¡œ?ê? ?†ìŠµ?ˆë‹¤.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  {['ê·¼ë¡œ?ëª…', 'ê³ ìš©?•íƒœ', '4ë³´í—˜?€??, '?´ì§ê³µì œ', 'ê·¼ë¬´?¼ìˆ˜', '?•ì •ê¸ˆì•¡', 'êµ???°ê¸ˆ', 'ê±´ê°•ë³´í—˜', 'ê³ ìš©ë³´í—˜', '?°ì¬ë³´í—˜'].map(h => (
                    <th key={h} className="bg-brand px-3 py-[10px] text-left font-semibold text-muted-brand border-b border-[#e0e0e0] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((row, i) => (
                  <tr key={row.workerId} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td className="px-3 py-[10px] border-b border-[rgba(91,164,217,0.1)] align-middle font-semibold">{row.workerName}</td>
                    <td className="px-3 py-[10px] border-b border-[rgba(91,164,217,0.1)] align-middle">{EMP_LABEL[row.employmentType] ?? row.employmentType}</td>
                    <td className="px-3 py-[10px] border-b border-[rgba(91,164,217,0.1)] align-middle">
                      <EligibleBadge eligible={row.fourInsurancesEligibleYn} reason="ê·¼ë¡œ??ê¸°ë³¸ ?¤ì •" />
                    </td>
                    <td className="px-3 py-[10px] border-b border-[rgba(91,164,217,0.1)] align-middle">
                      <span
                        className="text-[11px] px-2 py-[2px] rounded-lg"
                        style={{
                          background: row.retirementMutualTargetYn ? '#e3f2fd' : '#f5f5f5',
                          color: row.retirementMutualTargetYn ? '#1565c0' : '#999',
                        }}
                      >
                        {row.retirementMutualTargetYn ? '?€?? : '?œì™¸'}
                      </span>
                    </td>
                    <td className="px-3 py-[10px] border-b border-[rgba(91,164,217,0.1)] align-middle text-right">
                      {row.totalWorkDays != null ? `${row.totalWorkDays}?? : '-'}
                    </td>
                    <td className="px-3 py-[10px] border-b border-[rgba(91,164,217,0.1)] align-middle text-right">
                      {row.totalConfirmedAmount != null ? row.totalConfirmedAmount.toLocaleString('ko-KR') + '?? : '-'}
                    </td>
                    <td className="px-3 py-[10px] border-b border-[rgba(91,164,217,0.1)] align-middle"><EligibleBadge eligible={row.nationalPension.eligible} reason={row.nationalPension.reason} /></td>
                    <td className="px-3 py-[10px] border-b border-[rgba(91,164,217,0.1)] align-middle"><EligibleBadge eligible={row.healthInsurance.eligible} reason={row.healthInsurance.reason} /></td>
                    <td className="px-3 py-[10px] border-b border-[rgba(91,164,217,0.1)] align-middle"><EligibleBadge eligible={row.employmentInsurance.eligible} reason={row.employmentInsurance.reason} /></td>
                    <td className="px-3 py-[10px] border-b border-[rgba(91,164,217,0.1)] align-middle"><EligibleBadge eligible={row.industrialAccident.eligible} reason={row.industrialAccident.reason} /></td>
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
