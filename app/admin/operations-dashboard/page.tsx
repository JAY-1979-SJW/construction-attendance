'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface KpiData {
  todayActiveWorkers: number
  monthWorkerCount: number
  pendingOnboardingCount: number
  retirementPendingCount: number
  exceptionWorkerCount: number
  insuranceExceptionCount: number
  taxExceptionCount: number
  unconfirmedSettlementCount: number
  thisMonthDownloadCount: number
}

interface MonthClosingStatus {
  status: string
  closedAt: string | null
  reopenReason: string | null
}

interface RecentDownload {
  id: string
  exportType: string
  monthKey: string
  createdAt: string
  createdBy: string | null
  versionNo: number
}

interface SettlementSummary {
  total: number
  confirmed: number
  reviewRequired: number
  draft: number
  hold: number
}

interface OnboardingIssue {
  workerId: string
  workerName: string
  issueCount: number
  topIssue: string
}

interface DashboardData {
  monthKey: string
  kpi: KpiData
  monthClosingStatus: MonthClosingStatus | null
  recentDownloads: RecentDownload[]
  settlementSummary: SettlementSummary
  onboardingIssues: OnboardingIssue[]
}

function getMonthKey() {
  const now = new Date(Date.now() + 9 * 3600000)
  return now.toISOString().slice(0, 7)
}

const closingStatusColor: Record<string, React.CSSProperties> = {
  OPEN:     { background: 'rgba(91,164,217,0.1)', color: '#A0AEC0' },
  CLOSING:  { background: '#fff8e1', color: '#f9a825' },
  CLOSED:   { background: '#e8f5e9', color: '#2e7d32' },
  REOPENED: { background: '#fff3e0', color: '#e65100' },
}

const closingStatusLabel: Record<string, string> = {
  OPEN:     '미마감',
  CLOSING:  '마감 중',
  CLOSED:   '마감 완료',
  REOPENED: '재오픈',
}

const exportTypeLabel: Record<string, string> = {
  LABOR_COST_SUMMARY:        '노무비 집계',
  INSURANCE_ACQUISITION:     '보험취득신고',
  INSURANCE_LOSS:            '보험상실신고',
  WITHHOLDING_TAX:           '원천세',
  RETIREMENT_MUTUAL_REPORT:  '퇴직공제 신고',
  SUBCONTRACTOR_SETTLEMENT:  '협력사 정산서',
}

export default function OperationsDashboardPage() {
  const router = useRouter()
  const [monthKey, setMonthKey] = useState(getMonthKey)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchDashboard = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/operations-dashboard?monthKey=${monthKey}`)
      if (res.status === 401) { router.push('/admin/login'); return }
      const json = await res.json()
      if (json.error) { setError(json.error); return }
      setData(json)
    } catch {
      setError('데이터 조회 실패')
    } finally {
      setLoading(false)
    }
  }, [monthKey, router])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  const kpi = data?.kpi

  const kpiCards = kpi ? [
    {
      label: '오늘 출근',
      value: kpi.todayActiveWorkers ?? 0,
      color: '#5BA4D9',
      bg: '#e3f2fd',
      alert: false,
      sub: null,
    },
    {
      label: '이번 달 근로자',
      value: kpi.monthWorkerCount ?? 0,
      color: '#2e7d32',
      bg: '#e8f5e9',
      alert: false,
      sub: null,
    },
    {
      label: '온보딩 미완료',
      value: kpi.pendingOnboardingCount ?? 0,
      color: (kpi.pendingOnboardingCount ?? 0) > 0 ? '#e65100' : '#666',
      bg: (kpi.pendingOnboardingCount ?? 0) > 0 ? '#fff3e0' : '#f5f5f5',
      alert: (kpi.pendingOnboardingCount ?? 0) > 0,
      sub: null,
    },
    {
      label: '예외 처리 근로자',
      value: kpi.exceptionWorkerCount ?? 0,
      color: '#f57f17',
      bg: '#fffde7',
      alert: false,
      sub: `보험예외 ${kpi.insuranceExceptionCount ?? 0} / 세금예외 ${kpi.taxExceptionCount ?? 0}`,
    },
    {
      label: '미확정 정산',
      value: kpi.unconfirmedSettlementCount ?? 0,
      color: (kpi.unconfirmedSettlementCount ?? 0) > 0 ? '#c62828' : '#666',
      bg: (kpi.unconfirmedSettlementCount ?? 0) > 0 ? '#ffebee' : '#f5f5f5',
      alert: (kpi.unconfirmedSettlementCount ?? 0) > 0,
      sub: null,
    },
    {
      label: '이번 달 다운로드',
      value: kpi.thisMonthDownloadCount ?? 0,
      color: '#A0AEC0',
      bg: '#f5f5f5',
      alert: false,
      sub: null,
    },
  ] : []

  const closingStatus = data?.monthClosingStatus?.status ?? 'OPEN'

  if (loading && !data) return (
    <div className="flex items-center justify-center h-64 text-muted-brand text-[15px]">
      대시보드 로딩 중...
    </div>
  )

  return (
    <div className="p-8 overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold m-0">운영 대시보드</h1>
          <div className="flex items-center gap-3">
            <input
              type="month"
              value={monthKey}
              onChange={e => setMonthKey(e.target.value)}
              className="px-[10px] py-2 border border-[rgba(91,164,217,0.2)] rounded-md text-sm bg-card text-white"
            />
            <button
              onClick={fetchDashboard}
              disabled={loading}
              className="px-4 py-2 bg-accent text-white border-0 rounded-md cursor-pointer text-sm font-semibold disabled:opacity-60"
            >
              {loading ? '조회 중...' : '새로고침'}
            </button>
          </div>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-lg text-sm bg-[#ffebee] text-[#c62828] mb-5">
            {error}
          </div>
        )}

        {/* KPI 카드 + 월마감 상태 */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {loading && !data ? (
            // 스켈레톤 로딩
            Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="bg-[#f0f0f0] rounded-xl p-5 h-20 animate-pulse" />
            ))
          ) : (
            <>
              {kpiCards.map((card) => (
                <div key={card.label} style={{
                  background: card.bg,
                  borderRadius: '12px',
                  padding: '20px',
                  boxShadow: card.alert ? '0 0 0 2px ' + card.color : '0 1px 4px rgba(0,0,0,0.06)',
                }}>
                  <div style={{ fontSize: '32px', fontWeight: 700, color: card.color }}>
                    {loading ? '-' : card.value.toLocaleString()}
                  </div>
                  <div className="text-[13px] text-muted-brand mt-1">{card.label}</div>
                  {card.sub && (
                    <div className="text-[11px] text-muted-brand mt-1">{card.sub}</div>
                  )}
                  {card.alert && (
                    <div style={{ fontSize: '11px', color: card.color, marginTop: '4px', fontWeight: 600 }}>
                      확인 필요
                    </div>
                  )}
                </div>
              ))}

              {/* 월마감 상태 카드 */}
              <div className="bg-card rounded-xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
                <div className="text-[12px] text-muted-brand mb-2 font-semibold">월마감 상태</div>
                <span style={{
                  ...closingStatusColor[closingStatus],
                  padding: '6px 16px',
                  borderRadius: '999px',
                  fontSize: '15px',
                  fontWeight: 600,
                }}>
                  {closingStatusLabel[closingStatus] ?? closingStatus}
                </span>
                {data?.monthClosingStatus?.closedAt && (
                  <div className="text-[11px] text-[#718096] mt-2">
                    {new Date(data.monthClosingStatus.closedAt).toLocaleDateString('ko-KR')} 마감
                  </div>
                )}
                {data?.monthClosingStatus?.reopenReason && (
                  <div className="text-[11px] text-[#e65100] mt-1">
                    {data.monthClosingStatus.reopenReason}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* 하단 3열 패널 */}
        <div className="grid grid-cols-3 gap-5">

          {/* 협력사 정산 현황 */}
          <div className="bg-card rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.35)] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-[14px] border-b border-[#f0f0f0] font-bold text-[14px]">
              <span>협력사 정산 현황</span>
              <Link href="/admin/subcontractor-settlements" className="text-[12px] text-secondary-brand no-underline font-normal">→ 이동</Link>
            </div>
            <div className="p-4">
              {data ? (
                <>
                  <div className="flex justify-between mb-3">
                    <span className="text-[13px] text-muted-brand">전체</span>
                    <span className="font-bold text-[15px]">{data.settlementSummary.total ?? 0}건</span>
                  </div>
                  {data.settlementSummary.total === 0 ? (
                    <p className="text-[13px] text-[#aaa] text-center my-2">정산 내역이 없습니다.</p>
                  ) : (
                    [
                      { label: '확정', value: data.settlementSummary.confirmed ?? 0, color: '#2e7d32', bg: '#e8f5e9' },
                      { label: '검토 필요', value: data.settlementSummary.reviewRequired ?? 0, color: '#c62828', bg: '#ffebee' },
                      { label: '임시저장', value: data.settlementSummary.draft ?? 0, color: '#A0AEC0', bg: '#f5f5f5' },
                      { label: '보류', value: data.settlementSummary.hold ?? 0, color: '#f57f17', bg: '#fffde7' },
                    ].map(item => (
                      <div key={item.label} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '8px 10px', borderRadius: '6px', background: item.bg, marginBottom: '6px',
                      }}>
                        <span style={{ fontSize: '13px', color: item.color, fontWeight: 600 }}>{item.label}</span>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: item.color }}>{item.value}</span>
                      </div>
                    ))
                  )}
                </>
              ) : (
                <div className="px-4 py-5 text-[13px] text-[#aaa] text-center">로딩 중...</div>
              )}
            </div>
          </div>

          {/* 최근 다운로드 */}
          <div className="bg-card rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.35)] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-[14px] border-b border-[#f0f0f0] font-bold text-[14px]">
              <span>최근 다운로드</span>
              <Link href="/admin/document-center" className="text-[12px] text-secondary-brand no-underline font-normal">→ 이동</Link>
            </div>
            <div className="py-2">
              {data?.recentDownloads && data.recentDownloads.length > 0 ? data.recentDownloads.map(dl => (
                <div key={dl.id} className="px-4 py-[10px] border-b border-[#f5f5f5] flex justify-between items-start">
                  <div>
                    <div className="text-[13px] font-semibold text-[#CBD5E0]">
                      {exportTypeLabel[dl.exportType] ?? dl.exportType}
                    </div>
                    <div className="text-[11px] text-[#718096] mt-[2px]">
                      {dl.monthKey} · v{dl.versionNo}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-[#999]">
                      {new Date(dl.createdAt).toLocaleDateString('ko-KR')}
                    </div>
                    {dl.createdBy && (
                      <div className="text-[11px] text-[#aaa] mt-[2px]">{dl.createdBy}</div>
                    )}
                  </div>
                </div>
              )) : (
                <div className="px-4 py-5 text-[13px] text-[#aaa] text-center">다운로드 내역이 없습니다</div>
              )}
            </div>
          </div>

          {/* 온보딩 이슈 */}
          <div className="bg-card rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.35)] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-[14px] border-b border-[#f0f0f0] font-bold text-[14px]">
              <span>온보딩 이슈</span>
              <Link href="/admin/workers" className="text-[12px] text-secondary-brand no-underline font-normal">→ 이동</Link>
            </div>
            <div className="py-2">
              {(!data?.onboardingIssues || data.onboardingIssues.length === 0) ? (
                <p className="px-4 py-5 text-[13px] text-[#aaa] text-center m-0">온보딩 이슈가 없습니다.</p>
              ) : (
                data.onboardingIssues.map(issue => (
                  <div key={issue.workerId} className="px-4 py-[10px] border-b border-[#f5f5f5] flex justify-between items-center">
                    <div>
                      <Link
                        href={`/admin/workers/${issue.workerId}`}
                        className="text-[13px] font-semibold text-secondary-brand no-underline"
                      >
                        {issue.workerName}
                      </Link>
                      <div className="text-[11px] text-[#e65100] mt-[2px]">{issue.topIssue}</div>
                    </div>
                    <span className="text-[12px] font-bold text-white bg-[#e53935] rounded-full px-2 py-[2px]">
                      {issue.issueCount}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
    </div>
  )
}
