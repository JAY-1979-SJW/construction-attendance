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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '256px', color: '#A0AEC0', fontSize: '15px' }}>
      대시보드 로딩 중...
    </div>
  )

  return (
    <div style={s.layout}>
      <nav style={s.sidebar}>
        <div style={s.sidebarTitle}>해한 출퇴근</div>
        <div style={s.navSection}>관리</div>
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{ ...s.navItem, ...(item.href === '/admin/operations-dashboard' ? s.navActive : {}) }}
          >
            {item.label}
          </Link>
        ))}
        <button
          onClick={() => fetch('/api/admin/auth/logout', { method: 'POST' }).then(() => router.push('/admin/login'))}
          style={s.logoutBtn}
        >
          로그아웃
        </button>
      </nav>

      <main style={s.main}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <h1 style={{ ...s.pageTitle, margin: 0 }}>운영 대시보드</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input
              type="month"
              value={monthKey}
              onChange={e => setMonthKey(e.target.value)}
              style={s.input}
            />
            <button
              onClick={fetchDashboard}
              disabled={loading}
              style={{ ...s.btn, opacity: loading ? 0.6 : 1 }}
            >
              {loading ? '조회 중...' : '새로고침'}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ ...s.msgBox, background: '#ffebee', color: '#c62828', marginBottom: '20px' }}>
            {error}
          </div>
        )}

        {/* KPI 카드 + 월마감 상태 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          {loading && !data ? (
            // 스켈레톤 로딩
            Array.from({ length: 7 }).map((_, i) => (
              <div key={i} style={{
                background: '#f0f0f0',
                borderRadius: '12px',
                padding: '20px',
                height: '80px',
                animation: 'pulse 1.5s ease-in-out infinite',
              }} />
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
                  <div style={{ fontSize: '13px', color: '#A0AEC0', marginTop: '4px' }}>{card.label}</div>
                  {card.sub && (
                    <div style={{ fontSize: '11px', color: '#A0AEC0', marginTop: '4px' }}>{card.sub}</div>
                  )}
                  {card.alert && (
                    <div style={{ fontSize: '11px', color: card.color, marginTop: '4px', fontWeight: 600 }}>
                      확인 필요
                    </div>
                  )}
                </div>
              ))}

              {/* 월마감 상태 카드 */}
              <div style={{
                background: '#243144',
                borderRadius: '12px',
                padding: '20px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
              }}>
                <div style={{ fontSize: '12px', color: '#A0AEC0', marginBottom: '8px', fontWeight: 600 }}>월마감 상태</div>
                <span style={{
                  ...s.badge,
                  ...closingStatusColor[closingStatus],
                  fontSize: '15px',
                  padding: '6px 16px',
                }}>
                  {closingStatusLabel[closingStatus] ?? closingStatus}
                </span>
                {data?.monthClosingStatus?.closedAt && (
                  <div style={{ fontSize: '11px', color: '#718096', marginTop: '8px' }}>
                    {new Date(data.monthClosingStatus.closedAt).toLocaleDateString('ko-KR')} 마감
                  </div>
                )}
                {data?.monthClosingStatus?.reopenReason && (
                  <div style={{ fontSize: '11px', color: '#e65100', marginTop: '4px' }}>
                    {data.monthClosingStatus.reopenReason}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* 하단 3열 패널 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>

          {/* 협력사 정산 현황 */}
          <div style={s.panel}>
            <div style={{ ...s.panelHeader, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>협력사 정산 현황</span>
              <Link href="/admin/subcontractor-settlements" style={s.panelLink}>→ 이동</Link>
            </div>
            <div style={{ padding: '16px' }}>
              {data ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={s.panelLabel}>전체</span>
                    <span style={{ fontWeight: 700, fontSize: '15px' }}>{data.settlementSummary.total ?? 0}건</span>
                  </div>
                  {data.settlementSummary.total === 0 ? (
                    <p style={{ fontSize: '13px', color: '#aaa', textAlign: 'center', margin: '8px 0' }}>정산 내역이 없습니다.</p>
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
                <div style={s.emptyMsg}>로딩 중...</div>
              )}
            </div>
          </div>

          {/* 최근 다운로드 */}
          <div style={s.panel}>
            <div style={{ ...s.panelHeader, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>최근 다운로드</span>
              <Link href="/admin/document-center" style={s.panelLink}>→ 이동</Link>
            </div>
            <div style={{ padding: '8px 0' }}>
              {data?.recentDownloads && data.recentDownloads.length > 0 ? data.recentDownloads.map(dl => (
                <div key={dl.id} style={{
                  padding: '10px 16px',
                  borderBottom: '1px solid #f5f5f5',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#CBD5E0' }}>
                      {exportTypeLabel[dl.exportType] ?? dl.exportType}
                    </div>
                    <div style={{ fontSize: '11px', color: '#718096', marginTop: '2px' }}>
                      {dl.monthKey} · v{dl.versionNo}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', color: '#999' }}>
                      {new Date(dl.createdAt).toLocaleDateString('ko-KR')}
                    </div>
                    {dl.createdBy && (
                      <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>{dl.createdBy}</div>
                    )}
                  </div>
                </div>
              )) : (
                <div style={s.emptyMsg}>다운로드 내역이 없습니다</div>
              )}
            </div>
          </div>

          {/* 온보딩 이슈 */}
          <div style={s.panel}>
            <div style={{ ...s.panelHeader, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>온보딩 이슈</span>
              <Link href="/admin/workers" style={s.panelLink}>→ 이동</Link>
            </div>
            <div style={{ padding: '8px 0' }}>
              {(!data?.onboardingIssues || data.onboardingIssues.length === 0) ? (
                <p style={{ ...s.emptyMsg, margin: 0 }}>온보딩 이슈가 없습니다.</p>
              ) : (
                data.onboardingIssues.map(issue => (
                  <div key={issue.workerId} style={{
                    padding: '10px 16px',
                    borderBottom: '1px solid #f5f5f5',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <div>
                      <Link
                        href={`/admin/workers/${issue.workerId}`}
                        style={{ fontSize: '13px', fontWeight: 600, color: '#5BA4D9', textDecoration: 'none' }}
                      >
                        {issue.workerName}
                      </Link>
                      <div style={{ fontSize: '11px', color: '#e65100', marginTop: '2px' }}>{issue.topIssue}</div>
                    </div>
                    <span style={{
                      fontSize: '12px', fontWeight: 700, color: 'white',
                      background: '#e53935', borderRadius: '999px', padding: '2px 8px',
                    }}>
                      {issue.issueCount}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

const NAV_ITEMS = [
  { href: '/admin',                         label: '대시보드' },
  { href: '/admin/operations-dashboard',    label: '운영 대시보드' },
  { href: '/admin/workers',                 label: '근로자 관리' },
  { href: '/admin/companies', label: '회사 관리' },
  { href: '/admin/sites',                   label: '현장 관리' },
  { href: '/admin/attendance',              label: '출퇴근 조회' },
  { href: '/admin/presence-checks',         label: '체류확인 현황' },
  { href: '/admin/presence-report',         label: '체류확인 리포트' },
  { href: '/admin/work-confirmations',      label: '근무확정' },
  { href: '/admin/contracts',               label: '인력/계약 관리' },
  { href: '/admin/insurance-eligibility',   label: '보험판정' },
  { href: '/admin/wage-calculations',       label: '세금/노임 계산' },
  { href: '/admin/filing-exports',          label: '신고자료 내보내기' },
  { href: '/admin/retirement-mutual',       label: '퇴직공제' },
  { href: '/admin/labor-cost-summaries',    label: '노무비 집계' },
  { href: '/admin/subcontractor-settlements', label: '협력사 정산' },
  { href: '/admin/document-center',         label: '서식 출력 센터' },
  { href: '/admin/month-closings',          label: '월마감' },
  { href: '/admin/corrections',             label: '정정 이력' },
  { href: '/admin/exceptions',              label: '예외 승인' },
  { href: '/admin/device-requests',         label: '기기 변경' },
]

const s: Record<string, React.CSSProperties> = {
  layout:       { display: 'flex', minHeight: '100vh', background: '#1B2838' },
  sidebar:      { width: '220px', background: '#141E2A', padding: '24px 0', flexShrink: 0, display: 'flex', flexDirection: 'column' },
  sidebarTitle: { color: 'white', fontSize: '16px', fontWeight: 700, padding: '0 20px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)' },
  navSection:   { color: 'rgba(255,255,255,0.4)', fontSize: '11px', padding: '16px 20px 8px', textTransform: 'uppercase' as const, letterSpacing: '1px' },
  navItem:      { display: 'block', color: 'rgba(255,255,255,0.8)', padding: '10px 20px', fontSize: '13px', textDecoration: 'none' },
  navActive:    { background: 'rgba(255,255,255,0.1)', color: 'white', fontWeight: 700 },
  logoutBtn:    { margin: '24px 20px 0', padding: '10px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '13px' },
  main:         { flex: 1, padding: '32px', overflow: 'auto' },
  pageTitle:    { fontSize: '24px', fontWeight: 700, margin: '0 0 24px' },
  input:        { padding: '8px 10px', border: '1px solid rgba(91,164,217,0.2)', borderRadius: '6px', fontSize: '14px', background: '#243144' },
  btn:          { padding: '8px 16px', background: '#F47920', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 },
  badge:        { padding: '4px 14px', borderRadius: '999px', fontSize: '13px', fontWeight: 600 },
  msgBox:       { padding: '12px 16px', borderRadius: '8px', fontSize: '14px' },
  panel:        { background: '#243144', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.35)', overflow: 'hidden' },
  panelHeader:  { padding: '14px 16px', borderBottom: '1px solid #f0f0f0', fontWeight: 700, fontSize: '14px' },
  panelLabel:   { fontSize: '13px', color: '#A0AEC0' },
  panelLink:    { fontSize: '12px', color: '#5BA4D9', textDecoration: 'none', fontWeight: 400 },
  emptyMsg:     { padding: '20px 16px', fontSize: '13px', color: '#aaa', textAlign: 'center' as const },
}
