'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface SiteSummary {
  id: string
  name: string
  status: string
  todayCheckedIn: number
  totalWorkers: number
  pendingWorklogs: number
}

interface DashboardData {
  siteCount: number
  todayAttendance: number
  pendingWorklogs: number
  unreadNotices: number
  sites: SiteSummary[]
}

export default function OpsDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/sites?pageSize=20').then(r => r.json()),
      fetch('/api/admin/attendance?date=' + new Date().toISOString().slice(0, 10) + '&pageSize=1').then(r => r.json()),
    ]).then(([sitesRes, attRes]) => {
      const sites: SiteSummary[] = (sitesRes?.items ?? []).map((s: Record<string, unknown>) => ({
        id: s.id as string,
        name: s.name as string,
        status: s.status as string,
        todayCheckedIn: 0,
        totalWorkers: (s.workerCount as number) ?? 0,
        pendingWorklogs: 0,
      }))
      setData({
        siteCount: sitesRes?.total ?? 0,
        todayAttendance: attRes?.total ?? 0,
        pendingWorklogs: 0,
        unreadNotices: 0,
        sites,
      })
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="p-8">
      <p className="text-[#6b7280]">로딩 중...</p>
    </div>
  )

  return (
    <div className="p-8">
      <h1 className="text-[22px] font-bold text-[#111827] mb-6">대시보드</h1>

      {/* 요약 카드 */}
      <div className="flex gap-4 mb-8 flex-wrap">
        <SummaryCard label="담당 현장" value={data?.siteCount ?? 0} href="/ops/sites" color="#1a56db" />
        <SummaryCard label="오늘 출근" value={data?.todayAttendance ?? 0} href="/ops/attendance" color="#0e9f6e" />
        <SummaryCard label="미작성 일보" value={data?.pendingWorklogs ?? 0} href="/ops/worklogs" color="#e3a008" />
        <SummaryCard label="미확인 공지" value={data?.unreadNotices ?? 0} href="/ops/notices" color="#7e3af2" />
      </div>

      {/* 현장 카드 목록 */}
      <h2 className="text-[17px] font-semibold text-[#1f2937] mb-4">내 담당 현장</h2>
      {data?.sites.length === 0 ? (
        <div className="text-center px-5 py-[60px] bg-white rounded-lg text-[#6b7280]">
          <p>배정된 현장이 없습니다.</p>
          <p className="text-[13px] mt-2 text-[#9ca3af]">관리자에게 현장 배정을 요청하세요.</p>
        </div>
      ) : (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
          {data?.sites.map(site => (
            <Link
              key={site.id}
              href={`/ops/sites/${site.id}`}
              className="block bg-white rounded-lg p-5 no-underline shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-[#e5e7eb] transition-shadow duration-150"
            >
              <div className="flex justify-between items-center mb-3">
                <span className="text-[15px] font-semibold text-[#111827]">{site.name}</span>
                <StatusBadge status={site.status} />
              </div>
              <div className="flex flex-col gap-1 text-[13px] text-[#374151]">
                <span>오늘 출근: <strong>{site.todayCheckedIn}명</strong></span>
                <span>전체 작업자: <strong>{site.totalWorkers}명</strong></span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value, href, color }: { label: string; value: number; href: string; color: string }) {
  return (
    <Link
      href={href}
      className="flex-[1_1_160px] block bg-white rounded-lg p-5 no-underline shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
      style={{ borderTop: `3px solid ${color}` }}
    >
      <div className="text-[32px] font-bold mb-1.5" style={{ color }}>{value}</div>
      <div className="text-[13px] text-[#6b7280]">{label}</div>
    </Link>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    ACTIVE:   { label: '운영중', bg: '#d1fae5', color: '#065f46' },
    PLANNED:  { label: '준비중', bg: '#dbeafe', color: '#1e40af' },
    CLOSED:   { label: '종료',   bg: '#f3f4f6', color: '#6b7280' },
    ARCHIVED: { label: '보관',   bg: '#f3f4f6', color: '#9ca3af' },
  }
  const s = map[status] ?? { label: status, bg: '#f3f4f6', color: '#6b7280' }
  return (
    <span
      className="text-[11px] px-2 py-0.5 rounded font-medium"
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  )
}
