'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface DashboardSummary {
  totalWorkers: number
  activeSites: number
  todayTotal: number
  todayCheckedIn: number
  todayCompleted: number
  pendingMissing: number
  pendingExceptions: number
  pendingDeviceRequests: number
  todayPresenceTotal:    number
  todayPresencePending:  number
  todayPresenceReview:   number
  todayPresenceNoResponse: number
}

interface RecentRecord {
  id: string
  workerName: string
  company: string
  siteName: string
  checkInAt: string | null
  checkOutAt: string | null
  status: string
}

const STATUS_LABEL: Record<string, string> = { WORKING: '근무중', COMPLETED: '퇴근', MISSING_CHECKOUT: '미퇴근', EXCEPTION: '예외' }
const STATUS_COLOR: Record<string, string> = { WORKING: '#2e7d32', COMPLETED: '#1565c0', MISSING_CHECKOUT: '#b71c1c', EXCEPTION: '#e65100' }

function alertCardStyle(color: string, bg: string): React.CSSProperties {
  return {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    background: bg, border: `1px solid ${color}40`, borderRadius: '10px',
    padding: '16px 24px', textDecoration: 'none', minWidth: '140px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.35)', cursor: 'pointer',
  }
}

export default function AdminDashboard() {
  const router = useRouter()
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [recent, setRecent] = useState<RecentRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/dashboard')
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) { router.push('/admin/login'); return }
        setSummary(data.data.summary)
        setRecent(data.data.recentAttendance)
        setLoading(false)
      })
  }, [router])

  const formatTime = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-'

  const handleLogout = () => {
    fetch('/api/admin/auth/logout', { method: 'POST' }).then(() => router.push('/admin/login'))
  }

  if (loading) return <div style={centerStyle}>로딩 중...</div>

  return (
    <div style={styles.layout}>
      {/* Sidebar */}
      <nav style={styles.sidebar}>
        <div style={styles.sidebarTitle}>해한 출퇴근</div>
        <div style={styles.navSection}>관리</div>
        {[
          { href: '/admin', label: '대시보드' },
          { href: '/admin/workers', label: '근로자 관리' },
  { href: '/admin/companies',           label: '회사 관리' },
          { href: '/admin/sites', label: '현장 관리' },
          { href: '/admin/attendance',       label: '출퇴근 조회' },
          { href: '/admin/presence-checks',  label: '체류확인 현황' },
          { href: '/admin/presence-report',      label: '체류확인 리포트' },
          { href: '/admin/work-confirmations',   label: '근무확정' },
          { href: '/admin/contracts',            label: '인력/계약 관리' },
          { href: '/admin/insurance-eligibility', label: '보험판정' },
          { href: '/admin/wage-calculations',    label: '세금/노임 계산' },
          { href: '/admin/filing-exports',       label: '신고자료 내보내기' },
          { href: '/admin/exceptions', label: `예외 승인${summary?.pendingExceptions ? ` (${summary.pendingExceptions})` : ''}` },
          { href: '/admin/device-requests', label: `기기 변경${summary?.pendingDeviceRequests ? ` (${summary.pendingDeviceRequests})` : ''}` },
          { href: '/admin/materials', label: '자재관리' },
        ].map((item) => (
          <Link key={item.href} href={item.href} style={styles.navItem}>{item.label}</Link>
        ))}
        <button onClick={handleLogout} style={styles.logoutBtn}>로그아웃</button>
      </nav>

      {/* Main */}
      <main style={styles.main}>
        <h1 style={styles.pageTitle}>대시보드</h1>
        <p style={styles.dateLabel}>{new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</p>

        {/* 체류확인 알림 */}
        {summary && (summary.todayPresenceReview > 0 || summary.todayPresenceNoResponse > 0) && (
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {summary.todayPresenceReview > 0 && (
              <a href="/admin/presence-checks?status=REVIEW_REQUIRED" style={alertCardStyle('#f57f17', '#fff8e1')}>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#f57f17' }}>{summary.todayPresenceReview}</div>
                <div style={{ fontSize: '12px', color: '#f57f17' }}>검토필요 — 즉시 확인</div>
              </a>
            )}
            {summary.todayPresenceNoResponse > 0 && (
              <a href="/admin/presence-checks?status=NO_RESPONSE" style={alertCardStyle('#b71c1c', '#fff3f3')}>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#b71c1c' }}>{summary.todayPresenceNoResponse}</div>
                <div style={{ fontSize: '12px', color: '#b71c1c' }}>미응답 — 확인 필요</div>
              </a>
            )}
            {summary.todayPresenceTotal > 0 && (
              <a href="/admin/presence-checks" style={alertCardStyle('#546e7a', '#f5f5f5')}>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#546e7a' }}>{summary.todayPresenceTotal}</div>
                <div style={{ fontSize: '12px', color: '#546e7a' }}>오늘 체류확인 전체</div>
              </a>
            )}
          </div>
        )}

        {/* Summary Cards */}
        <div style={styles.grid}>
          {[
            { label: '오늘 출근', value: summary?.todayTotal ?? 0, color: '#5BA4D9' },
            { label: '근무 중', value: summary?.todayCheckedIn ?? 0, color: '#2e7d32' },
            { label: '퇴근 완료', value: summary?.todayCompleted ?? 0, color: '#455a64' },
            { label: '미퇴근 누적', value: summary?.pendingMissing ?? 0, color: '#b71c1c' },
            { label: '예외 대기', value: summary?.pendingExceptions ?? 0, color: '#e65100' },
            { label: '기기 변경 대기', value: summary?.pendingDeviceRequests ?? 0, color: '#7b1fa2' },
            { label: '등록 근로자', value: summary?.totalWorkers ?? 0, color: '#37474f' },
          ].map((item) => (
            <div key={item.label} style={{ ...styles.summaryCard, borderTop: `4px solid ${item.color}` }}>
              <div style={{ ...styles.summaryValue, color: item.color }}>{item.value}</div>
              <div style={styles.summaryLabel}>{item.label}</div>
            </div>
          ))}
        </div>

        {/* Recent Attendance */}
        <div style={styles.tableCard}>
          <div style={styles.tableTitle}>오늘 출근 현황</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {['이름', '회사', '현장', '출근', '퇴근', '상태'].map((h) => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recent.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: '#999' }}>오늘 출근 기록이 없습니다.</td></tr>
                ) : recent.map((r) => (
                  <tr key={r.id} style={styles.tr}>
                    <td style={styles.td}>{r.workerName}</td>
                    <td style={styles.td}>{r.company}</td>
                    <td style={styles.td}>{r.siteName}</td>
                    <td style={styles.td}>{formatTime(r.checkInAt)}</td>
                    <td style={styles.td}>{formatTime(r.checkOutAt)}</td>
                    <td style={styles.td}>
                      <span style={{ color: STATUS_COLOR[r.status], fontWeight: 600, fontSize: '13px' }}>
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}

const centerStyle: React.CSSProperties = { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }

const styles: Record<string, React.CSSProperties> = {
  layout: { display: 'flex', minHeight: '100vh', background: '#1B2838' },
  sidebar: { width: '220px', background: '#141E2A', padding: '24px 0', flexShrink: 0, display: 'flex', flexDirection: 'column' },
  sidebarTitle: { color: 'white', fontSize: '16px', fontWeight: 700, padding: '0 20px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)' },
  navSection: { color: 'rgba(255,255,255,0.4)', fontSize: '11px', padding: '16px 20px 8px', textTransform: 'uppercase' as const, letterSpacing: '1px' },
  navItem: { display: 'block', color: 'rgba(255,255,255,0.8)', padding: '10px 20px', fontSize: '14px', textDecoration: 'none' },
  logoutBtn: { margin: '24px 20px 0', padding: '10px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '13px' },
  main: { flex: 1, padding: '32px' },
  pageTitle: { fontSize: '24px', fontWeight: 700, margin: '0 0 4px' },
  dateLabel: { fontSize: '14px', color: '#A0AEC0', margin: '0 0 24px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '16px', marginBottom: '24px' },
  summaryCard: { background: '#243144', borderRadius: '10px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.35)' },
  summaryValue: { fontSize: '32px', fontWeight: 700, marginBottom: '4px' },
  summaryLabel: { fontSize: '13px', color: '#A0AEC0' },
  tableCard: { background: '#243144', borderRadius: '10px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.35)' },
  tableTitle: { fontSize: '16px', fontWeight: 700, marginBottom: '16px' },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  th: { textAlign: 'left' as const, padding: '10px 12px', fontSize: '12px', color: '#A0AEC0', borderBottom: '2px solid rgba(91,164,217,0.2)', whiteSpace: 'nowrap' as const },
  td: { padding: '12px', fontSize: '14px', borderBottom: '1px solid #f5f5f5' },
  tr: {},
}
