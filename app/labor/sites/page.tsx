'use client'

import { useEffect, useState } from 'react'

interface SiteLaborRow {
  siteId: string
  siteName: string
  monthKey: string
  totalWorkers: number
  workedWorkers: number
  totalManday: number
  totalWage: number
  confirmedCount: number
  pendingCount: number
  insuranceTargets: number
}

export default function LaborSitesPage() {
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [rows, setRows] = useState<SiteLaborRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/labor/sites?month=${month}`)
      .then((r) => r.json())
      .then((res) => { if (res.success) setRows(res.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [month])

  const totalWage = rows.reduce((s, r) => s + r.totalWage, 0)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[20px] font-bold text-[#0F172A]">현장별 노무현황</h1>
          <p className="text-[13px] text-[#6B7280] mt-0.5">현장 단위 인원·공수·노임 집계</p>
        </div>
        <div className="flex items-center gap-3">
          {!loading && (
            <span className="text-[12px] text-[#9CA3AF]">
              합계 <span className="font-semibold text-[#F97316]">{totalWage.toLocaleString()}원</span>
            </span>
          )}
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="text-[13px] border border-[#E5E7EB] rounded-[8px] px-3 py-1.5 focus:outline-none focus:border-[#F97316]"
          />
        </div>
      </div>

      <div className="rounded-[10px] overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
        <table className="w-full text-[12px]">
          <thead style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
            <tr>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#6B7280]">현장명</th>
              <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-[#6B7280]">총 인원</th>
              <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-[#6B7280]">출근 인원</th>
              <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-[#6B7280]">공수 합계</th>
              <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-[#6B7280]">월 노임</th>
              <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-[#6B7280]">확정</th>
              <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-[#6B7280]">미확정</th>
              <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-[#6B7280]">보험 대상</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  {Array.from({ length: 8 }).map((__, j) => (
                    <td key={j} className="px-3 py-3">
                      <div className="h-3.5 bg-[#F3F4F6] rounded animate-pulse" style={{ width: j === 0 ? 100 : 40 }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-[13px] text-[#9CA3AF]">
                  현장 노무 데이터가 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.siteId} style={{ borderBottom: '1px solid #F3F4F6' }} className="hover:bg-[#FAFAFA]">
                  <td className="px-3 py-2.5 font-medium text-[#0F172A]">{row.siteName}</td>
                  <td className="px-3 py-2.5 text-center text-[#374151]">{row.totalWorkers}명</td>
                  <td className="px-3 py-2.5 text-center text-[#374151]">{row.workedWorkers}명</td>
                  <td className="px-3 py-2.5 text-center font-medium text-[#374151]">{row.totalManday.toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-[#0F172A]">{row.totalWage.toLocaleString()}원</td>
                  <td className="px-3 py-2.5 text-center text-[#16A34A]">{row.confirmedCount}</td>
                  <td className="px-3 py-2.5 text-center text-[#D97706]">{row.pendingCount}</td>
                  <td className="px-3 py-2.5 text-center text-[#374151]">{row.insuranceTargets}명</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
