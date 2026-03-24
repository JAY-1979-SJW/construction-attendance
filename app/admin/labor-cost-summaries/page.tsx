'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface LaborCostRow {
  id: string
  siteName: string
  siteId: string
  orgType: string
  companyName: string
  workerCount: number
  mandays: number
  totalWage: number
  taxableAmount: number
  withholdingTax: number
  npTargetCount: number
  hiTargetCount: number
  eiTargetCount: number
  retirementMutualDays: number
}

interface LaborCostTotals {
  workerCount: number
  totalWage: number
  withholdingTax: number
  mandays: number
}

interface SiteOption {
  id: string
  name: string
}

function getMonthKey() {
  const now = new Date(Date.now() + 9 * 3600000)
  return now.toISOString().slice(0, 7)
}

const ORG_TYPE_LABEL: Record<string, string> = {
  HEAD:       '원청',
  SUB:        '협력사',
  PARTNER:    '파트너',
  INDIVIDUAL: '개인',
}

export default function LaborCostSummariesPage() {
  const router = useRouter()
  const [monthKey, setMonthKey] = useState(getMonthKey())
  const [siteFilter, setSiteFilter] = useState('')
  const [items, setItems] = useState<LaborCostRow[]>([])
  const [totals, setTotals] = useState<LaborCostTotals | null>(null)
  const [sites, setSites] = useState<SiteOption[]>([])
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [msg, setMsg] = useState('')

  // Load site list for dropdown
  useEffect(() => {
    fetch('/api/admin/sites?pageSize=200')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setSites(d.data?.items?.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })) ?? [])
      })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ monthKey })
      if (siteFilter) params.set('siteId', siteFilter)
      const res = await fetch(`/api/admin/labor-cost-summaries?${params}`)
      const data = await res.json()
      if (!data.success) { router.push('/admin/login'); return }
      setItems(data.data?.items ?? [])
      setTotals(data.data?.totals ?? null)
    } finally { setLoading(false) }
  }, [monthKey, siteFilter, router])

  useEffect(() => { load() }, [load])

  const handleRun = async () => {
    if (!confirm(`${monthKey} 노무비 집계를 실행하시겠습니까?`)) return
    setRunning(true)
    setMsg('')
    try {
      const res = await fetch('/api/admin/labor-cost-summaries/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthKey }),
      })
      const data = await res.json()
      if (res.ok) {
        setMsg(`집계 완료 — ${data.data?.count ?? 0}건`)
        load()
      } else {
        setMsg(`집계 실패: ${data.error ?? '알 수 없는 오류'}`)
      }
    } finally { setRunning(false) }
  }

  const fmt = (n: number) => n.toLocaleString('ko-KR')
  const fmtWon = (n: number) => fmt(n) + '원'

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">노무비 집계</h1>

      {/* 필터 + 실행 버튼 */}
      <div className="flex gap-3 mb-5 flex-wrap items-end">
        <div>
          <label className="block text-xs text-muted-brand mb-1 font-semibold">귀속연월</label>
          <input
            type="month"
            value={monthKey}
            onChange={(e) => setMonthKey(e.target.value)}
            className="px-2.5 py-2 border border-[rgba(91,164,217,0.2)] rounded-md text-sm bg-card"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-brand mb-1 font-semibold">현장</label>
          <select
            value={siteFilter}
            onChange={(e) => setSiteFilter(e.target.value)}
            className="min-w-[180px] px-2.5 py-2 border border-[rgba(91,164,217,0.2)] rounded-md text-sm bg-card"
          >
            <option value="">전체 현장</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>{site.name}</option>
            ))}
          </select>
        </div>
        <button onClick={handleRun} disabled={running}
          className="px-4 py-2 bg-[#7b1fa2] text-white border-0 rounded-md cursor-pointer text-sm font-semibold"
          style={{ opacity: running ? 0.6 : 1 }}>
          {running ? '집계 중...' : '집계 실행'}
        </button>
      </div>

      {msg && (
        <div className={`px-4 py-3 rounded-lg mb-4 text-sm ${msg.startsWith('집계 실패') ? 'bg-[#ffebee] text-[#c62828]' : 'bg-[#e8f5e9] text-[#2e7d32]'}`}>
          {msg}
        </div>
      )}

      {/* 요약 카드 */}
      {totals && (
        <div className="flex gap-3 mb-5 flex-wrap">
          {[
            { label: '총 근로자수',  value: fmt(totals.workerCount) + '명', color: '#5BA4D9' },
            { label: '총 공수',     value: fmt(totals.mandays) + '일',      color: '#388e3c' },
            { label: '총 노임',     value: fmtWon(totals.totalWage),        color: '#e65100' },
            { label: '총 원천세',   value: fmtWon(totals.withholdingTax),   color: '#b71c1c' },
          ].map((c) => (
            <div key={c.label} className="bg-card rounded-[10px] px-5 py-4 min-w-[140px] shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
              style={{ borderTop: `4px solid ${c.color}` }}>
              <div className="text-[18px] font-bold" style={{ color: c.color }}>{c.value}</div>
              <div className="text-xs text-muted-brand">{c.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* 테이블 */}
      <div className="bg-card rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.35)] overflow-hidden">
        {loading ? (
          <div className="py-8 text-center text-[#999]">로딩 중...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {[
                    '현장명', '조직구분', '협력사명',
                    '인원수', '공수',
                    '총노임', '과세금액', '원천세',
                    '국민연금', '건보', '고용보험', '퇴직공제(일)',
                  ].map((h) => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-brand border-b border-[rgba(91,164,217,0.2)] whitespace-nowrap">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="text-center py-6 text-[#999]">
                      데이터 없음 — 집계 실행을 먼저 하세요
                    </td>
                  </tr>
                ) : items.map((row) => (
                  <tr key={row.id} className="cursor-default">
                    <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[rgba(91,164,217,0.1)] align-top">
                      {row.siteName}
                      <br />
                      <span className="text-[11px] text-[#999]">{row.siteId}</span>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[rgba(91,164,217,0.1)] align-top">
                      <span className="text-xs text-muted-brand">
                        {ORG_TYPE_LABEL[row.orgType] ?? row.orgType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[rgba(91,164,217,0.1)] align-top">{row.companyName}</td>
                    <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[rgba(91,164,217,0.1)] align-top text-center">{fmt(row.workerCount)}</td>
                    <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[rgba(91,164,217,0.1)] align-top text-center">{fmt(row.mandays)}</td>
                    <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[rgba(91,164,217,0.1)] align-top text-right">{fmt(row.totalWage)}</td>
                    <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[rgba(91,164,217,0.1)] align-top text-right">{fmt(row.taxableAmount)}</td>
                    <td className="px-4 py-3 text-[13px] text-[#b71c1c] border-b border-[rgba(91,164,217,0.1)] align-top text-right">
                      {fmt(row.withholdingTax)}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[rgba(91,164,217,0.1)] align-top text-center">
                      <span className={`text-xs ${row.npTargetCount > 0 ? 'text-[#1565c0]' : 'text-[#9e9e9e]'}`}>
                        {fmt(row.npTargetCount)}명
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[rgba(91,164,217,0.1)] align-top text-center">
                      <span className={`text-xs ${row.hiTargetCount > 0 ? 'text-[#1565c0]' : 'text-[#9e9e9e]'}`}>
                        {fmt(row.hiTargetCount)}명
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[rgba(91,164,217,0.1)] align-top text-center">
                      <span className={`text-xs ${row.eiTargetCount > 0 ? 'text-[#1565c0]' : 'text-[#9e9e9e]'}`}>
                        {fmt(row.eiTargetCount)}명
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[rgba(91,164,217,0.1)] align-top text-center">
                      {fmt(row.retirementMutualDays)}일
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
