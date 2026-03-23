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

  if (loading) return <div style={styles.page}><p style={styles.loading}>로딩 중...</p></div>

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>대시보드</h1>

      {/* 요약 카드 */}
      <div style={styles.cardRow}>
        <SummaryCard label="담당 현장" value={data?.siteCount ?? 0} href="/ops/sites" color="#1a56db" />
        <SummaryCard label="오늘 출근" value={data?.todayAttendance ?? 0} href="/ops/attendance" color="#0e9f6e" />
        <SummaryCard label="미작성 일보" value={data?.pendingWorklogs ?? 0} href="/ops/worklogs" color="#e3a008" />
        <SummaryCard label="미확인 공지" value={data?.unreadNotices ?? 0} href="/ops/notices" color="#7e3af2" />
      </div>

      {/* 현장 카드 목록 */}
      <h2 style={styles.sectionTitle}>내 담당 현장</h2>
      {data?.sites.length === 0 ? (
        <div style={styles.emptyState}>
          <p>배정된 현장이 없습니다.</p>
          <p style={styles.emptyHint}>관리자에게 현장 배정을 요청하세요.</p>
        </div>
      ) : (
        <div style={styles.siteGrid}>
          {data?.sites.map(site => (
            <Link key={site.id} href={`/ops/sites/${site.id}`} style={styles.siteCard}>
              <div style={styles.siteCardHeader}>
                <span style={styles.siteName}>{site.name}</span>
                <StatusBadge status={site.status} />
              </div>
              <div style={styles.siteCardBody}>
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
    <Link href={href} style={{ ...styles.card, borderTop: `3px solid ${color}` }}>
      <div style={{ ...styles.cardValue, color }}>{value}</div>
      <div style={styles.cardLabel}>{label}</div>
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
    <span style={{ ...styles.badge, background: s.bg, color: s.color }}>{s.label}</span>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '32px' },
  title: { fontSize: '22px', fontWeight: 700, color: '#111827', marginBottom: '24px' },
  loading: { color: '#6b7280' },
  cardRow: { display: 'flex', gap: '16px', marginBottom: '32px', flexWrap: 'wrap' },
  card: {
    flex: '1 1 160px',
    background: '#fff',
    borderRadius: '8px',
    padding: '20px',
    textDecoration: 'none',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    display: 'block',
  },
  cardValue: { fontSize: '32px', fontWeight: 700, marginBottom: '6px' },
  cardLabel: { fontSize: '13px', color: '#6b7280' },
  sectionTitle: { fontSize: '17px', fontWeight: 600, color: '#1f2937', marginBottom: '16px' },
  siteGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' },
  siteCard: {
    background: '#fff',
    borderRadius: '8px',
    padding: '20px',
    textDecoration: 'none',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    display: 'block',
    border: '1px solid #e5e7eb',
    transition: 'box-shadow 0.15s',
  },
  siteCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
  siteName: { fontSize: '15px', fontWeight: 600, color: '#111827' },
  siteCardBody: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: '#374151' },
  badge: { fontSize: '11px', padding: '2px 8px', borderRadius: '4px', fontWeight: 500 },
  emptyState: { textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: '8px', color: '#6b7280' },
  emptyHint: { fontSize: '13px', marginTop: '8px', color: '#9ca3af' },
}
