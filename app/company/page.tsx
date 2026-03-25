'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface DashboardData {
  totalWorkers: number
  todayCheckedIn: number
  todayCompleted: number
  pendingDevices: number
}

export default function CompanyDashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/company/dashboard')
      .then((r) => r.json())
      .then((res) => {
        if (!res.success) { router.push('/company/login'); return }
        setData(res.data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [router])

  return (
    <div className="p-8">
      <h1 className="text-[22px] font-bold m-0 mb-6 text-white">대시보드</h1>
      {loading ? (
        <p className="text-muted-brand text-[15px]">불러오는 중...</p>
      ) : data ? (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          <StatCard label="소속 근로자 수" value={data.totalWorkers} unit="명" color="#F97316" />
          <StatCard label="오늘 출근" value={data.todayCheckedIn} unit="명" color="#2e7d32" />
          <StatCard label="오늘 퇴근 완료" value={data.todayCompleted} unit="명" color="#1565c0" />
          <StatCard label="기기 승인 대기" value={data.pendingDevices} unit="건" color="#e65100" />
        </div>
      ) : (
        <p className="text-muted-brand text-[15px]">데이터를 불러올 수 없습니다.</p>
      )}
    </div>
  )
}

function StatCard({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <div className="bg-card rounded-[10px] shadow-[0_2px_8px_rgba(0,0,0,0.07)] overflow-hidden flex flex-row">
      <div className="w-1.5 shrink-0" style={{ background: color }} />
      <div className="p-5">
        <div className="text-[13px] text-[#777] mb-2 font-medium">{label}</div>
        <div className="text-[32px] font-bold" style={{ color }}>
          {value}
          <span className="text-sm font-medium ml-1">{unit}</span>
        </div>
      </div>
    </div>
  )
}
