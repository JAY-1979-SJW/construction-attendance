'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface DailyRow {
  date: string
  total: number
  completed: number
  noResponse: number
  outOfFence: number
  review: number
  manualConfirmed: number
  manualRejected: number
  completedRate: number | null
  noResponseRate: number | null
  outOfFenceRate: number | null
  reviewRate: number | null
  manualRate: number | null
}

interface Totals {
  total: number
  completed: number
  noResponse: number
  outOfFence: number
  review: number
  manualConfirmed: number
  manualRejected: number
  completedRate: number | null
  noResponseRate: number | null
  outOfFenceRate: number | null
  reviewRate: number | null
  manualRate: number | null
}

interface SiteRow {
  siteId: string
  siteName: string
  total: number
  completedRate: number | null
}

interface Site { id: string; name: string }

interface ReportData {
  days: number
  today: string
  siteId: string | null
  sites: Site[]
  daily: DailyRow[]
  totals: Totals
  siteBreakdown: SiteRow[]
}

function pctColor(rate: number | null, inverse = false): string {
  if (rate === null) return '#999'
  const good = inverse ? rate <= 5 : rate >= 80
  const warn = inverse ? rate <= 20 : rate >= 60
  return good ? '#2e7d32' : warn ? '#f57f17' : '#b71c1c'
}

function RateCell({ rate, inverse = false }: { rate: number | null; inverse?: boolean }) {
  if (rate === null) return <span className="text-[#bbb]">-</span>
  return <span style={{ color: pctColor(rate, inverse) }} className="font-semibold">{rate}%</span>
}

export default function PresenceReportPage() {
  const router = useRouter()
  const [days,    setDays]    = useState(7)
  const [siteId,  setSiteId]  = useState('')
  const [data,    setData]    = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ days: String(days) })
    if (siteId) params.set('siteId', siteId)
    fetch(`/api/admin/presence-report?${params}`)
      .then((r) => r.json())
      .then((res) => {
        if (!res.success) { router.push('/admin/login'); return }
        setData(res.data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [days, siteId, router])

  useEffect(() => { load() }, [load])

  return (
    <div className="p-8">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold m-0 mb-1">체류확인 리포트</h1>
            <p className="text-sm text-muted-brand m-0">일자별 완료율·미응답률·위치이탈률·검토필요 비율 집계</p>
          </div>
          <div className="flex gap-[10px] items-center">
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="px-3 py-2 border border-[rgba(91,164,217,0.3)] rounded-lg text-[13px] bg-card">
              <option value={7}>최근 7일</option>
              <option value={14}>최근 14일</option>
              <option value={30}>최근 30일</option>
            </select>
            <select value={siteId} onChange={(e) => setSiteId(e.target.value)} className="px-3 py-2 border border-[rgba(91,164,217,0.3)] rounded-lg text-[13px] bg-card">
              <option value="">전체 현장</option>
              {data?.sites.map((site) => (
                <option key={site.id} value={site.id}>{site.name}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-[#999]">로딩 중...</div>
        ) : !data || data.totals.total === 0 ? (
          <div className="text-center py-12 text-[#999]">해당 기간에 체류확인 기록이 없습니다.</div>
        ) : (
          <>
            {/* 전체 요약 카드 */}
            <div className="grid gap-[14px] mb-6 grid-cols-[repeat(auto-fill,minmax(140px,1fr))]">
              {[
                { label: '전체 건수',   value: data.totals.total,          unit: '건',  color: '#37474f' },
                { label: '완료율',      value: data.totals.completedRate,  unit: '%',   color: pctColor(data.totals.completedRate) },
                { label: '미응답률',    value: data.totals.noResponseRate, unit: '%',   color: pctColor(data.totals.noResponseRate, true) },
                { label: '위치이탈률',  value: data.totals.outOfFenceRate, unit: '%',   color: pctColor(data.totals.outOfFenceRate, true) },
                { label: '검토필요 비율', value: data.totals.reviewRate,   unit: '%',   color: pctColor(data.totals.reviewRate, true) },
                { label: '수동 처리율', value: data.totals.manualRate,     unit: '%',   color: '#546e7a' },
              ].map((c) => (
                <div key={c.label} className="bg-card rounded-[10px] p-4 shadow-[0_2px_8px_rgba(0,0,0,0.35)]" style={{ borderTop: `4px solid ${c.color}` }}>
                  <div className="text-[26px] font-bold mb-1" style={{ color: c.color }}>
                    {c.value != null ? `${c.value}${c.unit}` : '-'}
                  </div>
                  <div className="text-[12px] text-muted-brand">{c.label}</div>
                </div>
              ))}
            </div>

            {/* 일자별 표 */}
            <div className="bg-card rounded-[10px] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
              <div className="text-[15px] font-bold mb-4">일자별 체류확인 현황</div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      {['날짜', '전체', '완료', '완료율', '미응답', '미응답률', '이탈', '이탈률', '검토필요', '수동처리'].map((h) => (
                        <th key={h} className="text-left px-3 py-[9px] text-[12px] text-muted-brand border-b-2 border-[rgba(91,164,217,0.2)] whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.daily.map((row) => (
                      <tr key={row.date} className={row.date === data.today ? 'bg-[#f3f8ff] font-semibold' : ''}>
                        <td className="px-3 py-[10px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap">
                          {row.date}
                          {row.date === data.today && <span className="ml-[6px] text-[11px] bg-[rgba(244,121,32,0.12)] text-accent px-[6px] py-[1px] rounded-[8px]">오늘</span>}
                        </td>
                        <td className="px-3 py-[10px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap text-center">{row.total || '-'}</td>
                        <td className="px-3 py-[10px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap text-center">{row.completed || '-'}</td>
                        <td className="px-3 py-[10px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap text-center"><RateCell rate={row.completedRate} /></td>
                        <td className="px-3 py-[10px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap text-center">{row.noResponse || '-'}</td>
                        <td className="px-3 py-[10px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap text-center"><RateCell rate={row.noResponseRate} inverse /></td>
                        <td className="px-3 py-[10px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap text-center">{row.outOfFence || '-'}</td>
                        <td className="px-3 py-[10px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap text-center"><RateCell rate={row.outOfFenceRate} inverse /></td>
                        <td className={`px-3 py-[10px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap text-center${row.review > 0 ? ' text-[#f57f17] font-bold' : ''}`}>
                          {row.review || '-'}
                        </td>
                        <td className="px-3 py-[10px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap text-center">{(row.manualConfirmed + row.manualRejected) || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-brand font-bold">
                      <td className="px-3 py-[10px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap">합계</td>
                      <td className="px-3 py-[10px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap text-center">{data.totals.total}</td>
                      <td className="px-3 py-[10px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap text-center">{data.totals.completed}</td>
                      <td className="px-3 py-[10px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap text-center"><RateCell rate={data.totals.completedRate} /></td>
                      <td className="px-3 py-[10px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap text-center">{data.totals.noResponse}</td>
                      <td className="px-3 py-[10px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap text-center"><RateCell rate={data.totals.noResponseRate} inverse /></td>
                      <td className="px-3 py-[10px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap text-center">{data.totals.outOfFence}</td>
                      <td className="px-3 py-[10px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap text-center"><RateCell rate={data.totals.outOfFenceRate} inverse /></td>
                      <td className={`px-3 py-[10px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap text-center${data.totals.review > 0 ? ' text-[#f57f17]' : ''}`}>
                        {data.totals.review}
                      </td>
                      <td className="px-3 py-[10px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap text-center">{data.totals.manualConfirmed + data.totals.manualRejected}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* 현장별 비교 */}
            {data.siteBreakdown.length > 1 && (
              <div className="bg-card rounded-[10px] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.35)] mt-5">
                <div className="text-[15px] font-bold mb-4">현장별 완료율 비교</div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        {['현장', '전체', '완료율'].map((h) => (
                          <th key={h} className="text-left px-3 py-[9px] text-[12px] text-muted-brand border-b-2 border-[rgba(91,164,217,0.2)] whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.siteBreakdown.map((row) => (
                        <tr key={row.siteId}>
                          <td className="px-3 py-[10px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap">{row.siteName}</td>
                          <td className="px-3 py-[10px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap text-center">{row.total}</td>
                          <td className="px-3 py-[10px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap text-center">
                            <div className="flex items-center gap-2 justify-center">
                              <div
                                className="h-2 rounded transition-[width] duration-300"
                                style={{
                                  width: `${Math.min(row.completedRate ?? 0, 100)}px`,
                                  background: pctColor(row.completedRate),
                                }}
                              />
                              <RateCell rate={row.completedRate} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
    </div>
  )
}
