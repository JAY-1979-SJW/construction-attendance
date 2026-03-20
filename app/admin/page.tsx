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
  pendingExceptions: number
  pendingDeviceRequests: number
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

const STATUS_LABEL: Record<string, string> = { WORKING: '근무중', COMPLETED: '퇴근', EXCEPTION: '예외' }
const STATUS_COLOR: Record<string, string> = { WORKING: '#2e7d32', COMPLETED: '#1565c0', EXCEPTION: '#e65100' }

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
          { href: '/admin/sites', label: '현장 관리' },
          { href: '/admin/attendance', label: '출퇴근 조회' },
          { href: '/admin/exceptions', label: `예외 승인${summary?.pendingExceptions ? ` (${summary.pendingExceptions})` : ''}` },
          { href: '/admin/device-requests', label: `기기 변경${summary?.pendingDeviceRequests ? ` (${summary.pendingDeviceRequests})` : ''}` },
        ].map((item) => (
          <Link key={item.href} href={item.href} style={styles.navItem}>{item.label}</Link>
        ))}
        <button onClick={handleLogout} style={styles.logoutBtn}>로그아웃</button>
      </nav>

      {/* Main */}
      <main style={styles.main}>
        <h1 style={styles.pageTitle}>대시보드</h1>
        <p style={styles.dateLabel}>{new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</p>

        {/* Summary Cards */}
        <div style={styles.grid}>
          {[
            { label: '오늘 출근', value: summary?.todayTotal ?? 0, color: '#1976d2' },
            { label: '근무 중', value: summary?.todayCheckedIn ?? 0, color: '#2e7d32' },
            { label: '퇴근 완료', value: summary?.todayCompleted ?? 0, color: '#455a64' },
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
  layout: { display: 'flex', minHeight: '100vh', background: '#f5f5f5' },
  sidebar: { width: '220px', background: '#1a1a2e', padding: '24px 0', flexShrink: 0, display: 'flex', flexDirection: 'column' },
  sidebarTitle: { color: 'white', fontSize: '16px', fontWeight: 700, padding: '0 20px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)' },
  navSection: { color: 'rgba(255,255,255,0.4)', fontSize: '11px', padding: '16px 20px 8px', textTransform: 'uppercase' as const, letterSpacing: '1px' },
  navItem: { display: 'block', color: 'rgba(255,255,255,0.8)', padding: '10px 20px', fontSize: '14px', textDecoration: 'none' },
  logoutBtn: { margin: '24px 20px 0', padding: '10px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '13px' },
  main: { flex: 1, padding: '32px' },
  pageTitle: { fontSize: '24px', fontWeight: 700, margin: '0 0 4px' },
  dateLabel: { fontSize: '14px', color: '#888', margin: '0 0 24px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '16px', marginBottom: '24px' },
  summaryCard: { background: 'white', borderRadius: '10px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  summaryValue: { fontSize: '32px', fontWeight: 700, marginBottom: '4px' },
  summaryLabel: { fontSize: '13px', color: '#888' },
  tableCard: { background: 'white', borderRadius: '10px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  tableTitle: { fontSize: '16px', fontWeight: 700, marginBottom: '16px' },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  th: { textAlign: 'left' as const, padding: '10px 12px', fontSize: '12px', color: '#888', borderBottom: '2px solid #f0f0f0', whiteSpace: 'nowrap' as const },
  td: { padding: '12px', fontSize: '14px', borderBottom: '1px solid #f5f5f5' },
  tr: {},
}
