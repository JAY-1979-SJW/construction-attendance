'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface AttendanceRecord {
  id: string
  workerName: string
  workerPhone: string
  company: string
  jobTitle: string
  siteName: string
  workDate: string
  checkInAt: string | null
  checkOutAt: string | null
  status: string
  checkInDistance: number | null
  checkOutDistance: number | null
  exceptionReason: string | null
}

const STATUS_LABEL: Record<string, string> = { WORKING: '근무중', COMPLETED: '완료', EXCEPTION: '예외' }
const STATUS_COLOR: Record<string, string> = { WORKING: '#2e7d32', COMPLETED: '#1565c0', EXCEPTION: '#e65100' }

export default function AdminAttendancePage() {
  const router = useRouter()
  const today = new Date().toISOString().slice(0, 10)
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo, setDateTo] = useState(today)
  const [items, setItems] = useState<AttendanceRecord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const load = () => {
    setLoading(true)
    fetch(`/api/admin/attendance?dateFrom=${dateFrom}&dateTo=${dateTo}&pageSize=100`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) { router.push('/admin/login'); return }
        setItems(data.data.items)
        setTotal(data.data.total)
        setLoading(false)
      })
  }

  useEffect(load, [router])

  const handleExport = () => {
    window.location.href = `/api/export/attendance?dateFrom=${dateFrom}&dateTo=${dateTo}`
  }

  const formatTime = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-'

  return (
    <div style={styles.layout}>
      <nav style={styles.sidebar}>
        <div style={styles.sidebarTitle}>해한 출퇴근</div>
        {[
          ['/admin', '대시보드'], ['/admin/workers', '근로자 관리'], ['/admin/sites', '현장 관리'],
          ['/admin/attendance', '출퇴근 조회'], ['/admin/exceptions', '예외 승인'], ['/admin/device-requests', '기기 변경'],
        ].map(([href, label]) => <Link key={href} href={href} style={styles.navItem}>{label}</Link>)}
      </nav>
      <main style={styles.main}>
        <h1 style={styles.pageTitle}>출퇴근 조회</h1>

        {/* 필터 */}
        <div style={styles.filterRow}>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>시작일</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={styles.filterInput} />
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>종료일</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={styles.filterInput} />
          </div>
          <button onClick={load} style={styles.searchBtn}>조회</button>
          <button onClick={handleExport} style={styles.exportBtn}>엑셀 다운로드</button>
        </div>

        <div style={{ fontSize: '13px', color: '#888', marginBottom: '12px' }}>총 {total}건</div>

        {loading ? <p>로딩 중...</p> : (
          <div style={{ ...styles.tableCard, overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>{['날짜', '이름', '회사', '직종', '현장', '출근', '퇴근', '거리', '상태', '비고'].map((h) => <th key={h} style={styles.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={10} style={{ textAlign: 'center', padding: '24px', color: '#999' }}>데이터가 없습니다.</td></tr>
                ) : items.map((item) => (
                  <tr key={item.id} style={styles.tr}>
                    <td style={styles.td}>{item.workDate}</td>
                    <td style={styles.td}>{item.workerName}</td>
                    <td style={styles.td}>{item.company}</td>
                    <td style={styles.td}>{item.jobTitle}</td>
                    <td style={styles.td}>{item.siteName}</td>
                    <td style={styles.td}>{formatTime(item.checkInAt)}</td>
                    <td style={styles.td}>{formatTime(item.checkOutAt)}</td>
                    <td style={styles.td}>{item.checkInDistance != null ? `${item.checkInDistance}m` : '-'}</td>
                    <td style={styles.td}><span style={{ color: STATUS_COLOR[item.status], fontWeight: 600, fontSize: '12px' }}>{STATUS_LABEL[item.status] ?? item.status}</span></td>
                    <td style={styles.td}><span style={{ fontSize: '11px', color: '#999' }}>{item.exceptionReason ?? ''}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  layout: { display: 'flex', minHeight: '100vh', background: '#f5f5f5' },
  sidebar: { width: '220px', background: '#1a1a2e', padding: '24px 0', flexShrink: 0 },
  sidebarTitle: { color: 'white', fontSize: '16px', fontWeight: 700, padding: '0 20px 24px' },
  navItem: { display: 'block', color: 'rgba(255,255,255,0.8)', padding: '10px 20px', fontSize: '14px', textDecoration: 'none' },
  main: { flex: 1, padding: '32px' },
  pageTitle: { fontSize: '22px', fontWeight: 700, margin: '0 0 20px' },
  filterRow: { display: 'flex', gap: '12px', alignItems: 'flex-end', marginBottom: '16px', flexWrap: 'wrap' as const },
  filterGroup: { display: 'flex', flexDirection: 'column' as const, gap: '4px' },
  filterLabel: { fontSize: '12px', color: '#888' },
  filterInput: { padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' },
  searchBtn: { padding: '8px 20px', background: '#1976d2', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' },
  exportBtn: { padding: '8px 20px', background: '#2e7d32', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' },
  tableCard: { background: 'white', borderRadius: '10px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  th: { textAlign: 'left' as const, padding: '10px 12px', fontSize: '12px', color: '#888', borderBottom: '2px solid #f0f0f0', whiteSpace: 'nowrap' as const },
  td: { padding: '10px 12px', fontSize: '13px', borderBottom: '1px solid #f5f5f5', whiteSpace: 'nowrap' as const },
  tr: {},
}
