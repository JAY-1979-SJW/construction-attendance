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
      <h1 className="text-[22px] font-bold m-0 mb-6 text-white">?€?œë³´??/h1>
      {loading ? (
        <p className="text-muted-brand text-[15px]">ë¶ˆëŸ¬?¤ëŠ” ì¤?..</p>
      ) : data ? (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          <StatCard label="?Œì† ê·¼ë¡œ???? value={data.totalWorkers} unit="ëª? color="#F97316" />
          <StatCard label="?¤ëŠ˜ ì¶œê·¼" value={data.todayCheckedIn} unit="ëª? color="#2e7d32" />
          <StatCard label="?¤ëŠ˜ ?´ê·¼ ?„ë£Œ" value={data.todayCompleted} unit="ëª? color="#1565c0" />
          <StatCard label="ê¸°ê¸° ?¹ì¸ ?€ê¸? value={data.pendingDevices} unit="ê±? color="#e65100" />
        </div>
      ) : (
        <p className="text-muted-brand text-[15px]">?°ì´?°ë? ë¶ˆëŸ¬?????†ìŠµ?ˆë‹¤.</p>
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
