'use client'

import { useEffect, useState } from 'react'

interface DashboardData {
  thisMonth: string
  totalWorkers: number
  workedWorkers: number
  confirmedDays: number
  pendingConfirmations: number
  totalWage: number
  insuranceTargets: number
  documentPendingCount: number
  siteCount: number
}

const KPI_SKELETON = {
  thisMonth: '',
  totalWorkers: 0,
  workedWorkers: 0,
  confirmedDays: 0,
  pendingConfirmations: 0,
  totalWage: 0,
  insuranceTargets: 0,
  documentPendingCount: 0,
  siteCount: 0,
}

function KPICard({
  label,
  value,
  sub,
  accent,
  loading,
}: {
  label: string
  value: string | number
  sub?: string
  accent?: boolean
  loading?: boolean
}) {
  return (
    <div
      className="rounded-[12px] p-5 flex flex-col gap-1"
      style={{
        background: accent ? '#FFF7ED' : '#FFFFFF',
        border: accent ? '1px solid #FED7AA' : '1px solid #E5E7EB',
      }}
    >
      <span className="text-[12px] text-muted2-brand">{label}</span>
      {loading ? (
        <div className="h-7 w-24 bg-footer rounded animate-pulse" />
      ) : (
        <span
          className="text-[22px] font-bold"
          style={{ color: accent ? '#F97316' : '#0F172A' }}
        >
          {value}
        </span>
      )}
      {sub && <span className="text-[11px] text-muted2-brand">{sub}</span>}
    </div>
  )
}

export default function LaborDashboardPage() {
  const [data, setData] = useState<DashboardData>(KPI_SKELETON)
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  useEffect(() => {
    setLoading(true)
    fetch(`/api/labor/dashboard?month=${month}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setData(res.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [month])

  const fmtWage = (n: number) =>
    n >= 100_000_000
      ? `${(n / 100_000_000).toFixed(1)}억`
      : n >= 10_000
      ? `${Math.round(n / 10_000).toLocaleString()}만`
      : n.toLocaleString()

  return (
    <div className="p-6 max-w-[1100px]">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[20px] font-bold text-title-brand">노무 대시보드</h1>
          <p className="text-[13px] text-muted-brand mt-0.5">
            {month.replace('-', '년 ')}월 기준 노무 현황 요약
          </p>
        </div>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="text-[13px] border border-brand rounded-[8px] px-3 py-1.5 text-body-brand focus:outline-none focus:border-accent"
        />
      </div>

      {/* KPI 그리드 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <KPICard
          label="근무 근로자"
          value={loading ? '' : `${data.workedWorkers}명`}
          sub={`전체 ${data.totalWorkers}명`}
          loading={loading}
        />
        <KPICard
          label="월 확정 노임"
          value={loading ? '' : fmtWage(data.totalWage)}
          sub="확정 기준"
          accent
          loading={loading}
        />
        <KPICard
          label="미확정 건수"
          value={loading ? '' : `${data.pendingConfirmations}건`}
          sub="공수 미확정"
          loading={loading}
        />
        <KPICard
          label="4대보험 대상"
          value={loading ? '' : `${data.insuranceTargets}명`}
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <KPICard
          label="확정 근무일수"
          value={loading ? '' : `${data.confirmedDays}일`}
          sub="전 근로자 합산"
          loading={loading}
        />
        <KPICard
          label="서류 검토대기"
          value={loading ? '' : `${data.documentPendingCount}건`}
          loading={loading}
        />
        <KPICard
          label="운영 현장 수"
          value={loading ? '' : `${data.siteCount}개소`}
          loading={loading}
        />
        <div />
      </div>

      {/* 안내 */}
      <div
        className="rounded-[10px] px-4 py-3 text-[12px] text-muted-brand"
        style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}
      >
        노임·4대보험·서류 상세 내용은 각 메뉴에서 확인할 수 있습니다.
      </div>
    </div>
  )
}
