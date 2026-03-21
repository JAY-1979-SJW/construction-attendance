'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface PresenceCheckItem {
  id: string
  workerName: string
  workerCompany: string
  siteName: string
  slot: 'AM' | 'PM'
  checkDate: string
  scheduledAt: string
  expiresAt: string | null
  status: string
  respondedAt: string | null
  distanceMeters: number | null
  needsReview: boolean
  reviewReason: string | null
}

const STATUS_LABEL: Record<string, string> = {
  PENDING:          '대기중',
  COMPLETED:        '완료',
  MISSED:           '미응답',
  OUT_OF_GEOFENCE:  '위치이탈',
  LOW_ACCURACY:     '정확도부족',
  SKIPPED:          '건너뜀',
}
const STATUS_COLOR: Record<string, string> = {
  PENDING:          '#1565c0',
  COMPLETED:        '#2e7d32',
  MISSED:           '#b71c1c',
  OUT_OF_GEOFENCE:  '#e65100',
  LOW_ACCURACY:     '#7b1fa2',
  SKIPPED:          '#888',
}

function todayKST() {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

export default function PresenceChecksPage() {
  const router = useRouter()
  const [date, setDate] = useState(todayKST)
  const [items, setItems] = useState<PresenceCheckItem[]>([])
  const [loading, setLoading] = useState(true)
  const [authed, setAuthed] = useState(false)

  const load = useCallback((d: string) => {
    setLoading(true)
    fetch(`/api/admin/attendance/presence-checks?date=${d}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) { router.push('/admin/login'); return }
        setAuthed(true)
        setItems(data.data.items ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [router])

  useEffect(() => { load(date) }, [date, load])

  const handleLogout = () => {
    fetch('/api/admin/auth/logout', { method: 'POST' }).then(() => router.push('/admin/login'))
  }

  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-'

  const counts = {
    total:       items.length,
    completed:   items.filter((i) => i.status === 'COMPLETED').length,
    missed:      items.filter((i) => i.status === 'MISSED').length,
    outOfFence:  items.filter((i) => i.status === 'OUT_OF_GEOFENCE').length,
    pending:     items.filter((i) => i.status === 'PENDING').length,
    needsReview: items.filter((i) => i.needsReview).length,
  }

  if (!authed && loading) return <div style={centerStyle}>로딩 중...</div>

  return (
    <div style={styles.layout}>
      {/* Sidebar */}
      <nav style={styles.sidebar}>
        <div style={styles.sidebarTitle}>해한 출퇴근</div>
        <div style={styles.navSection}>관리</div>
        {[
          { href: '/admin',               label: '대시보드' },
          { href: '/admin/workers',        label: '근로자 관리' },
          { href: '/admin/sites',          label: '현장 관리' },
          { href: '/admin/attendance',     label: '출퇴근 조회' },
          { href: '/admin/presence-checks',label: '체류확인 현황' },
          { href: '/admin/labor',          label: '투입현황/노임서류' },
          { href: '/admin/exceptions',     label: '예외 승인' },
          { href: '/admin/device-requests',label: '기기 변경' },
          { href: '/admin/settings',       label: '설정' },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              ...styles.navItem,
              ...(item.href === '/admin/presence-checks' ? styles.navItemActive : {}),
            }}
          >
            {item.label}
          </Link>
        ))}
        <button onClick={handleLogout} style={styles.logoutBtn}>로그아웃</button>
      </nav>

      {/* Main */}
      <main style={styles.main}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.pageTitle}>체류확인 현황</h1>
            <p style={styles.subtitle}>근무 중 GPS 위치 체류확인 응답 내역</p>
          </div>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={styles.datePicker}
          />
        </div>

        {/* Summary Cards */}
        <div style={styles.cards}>
          {[
            { label: '전체',     value: counts.total,       color: '#37474f' },
            { label: '완료',     value: counts.completed,   color: '#2e7d32' },
            { label: '대기중',   value: counts.pending,     color: '#1565c0' },
            { label: '미응답',   value: counts.missed,      color: '#b71c1c' },
            { label: '위치이탈', value: counts.outOfFence,  color: '#e65100' },
            { label: '검토필요', value: counts.needsReview, color: '#7b1fa2' },
          ].map((c) => (
            <div key={c.label} style={{ ...styles.card, borderTop: `4px solid ${c.color}` }}>
              <div style={{ ...styles.cardValue, color: c.color }}>{c.value}</div>
              <div style={styles.cardLabel}>{c.label}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div style={styles.tableCard}>
          <div style={styles.tableTitle}>
            {date} 체류확인 목록
            {counts.needsReview > 0 && (
              <span style={styles.reviewBadge}>{counts.needsReview}건 검토필요</span>
            )}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '32px', color: '#999' }}>로딩 중...</div>
          ) : items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: '#999' }}>
              해당 날짜에 체류확인 기록이 없습니다.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {['이름', '회사', '현장', '구분', '예약시각', '만료시각', '응답시각', '거리(m)', '상태', '비고'].map((h) => (
                      <th key={h} style={styles.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      style={{
                        ...styles.tr,
                        background: item.needsReview ? '#fff8f0' : undefined,
                      }}
                    >
                      <td style={styles.td}>{item.workerName}</td>
                      <td style={styles.td}>{item.workerCompany}</td>
                      <td style={styles.td}>{item.siteName}</td>
                      <td style={styles.td}>
                        <span style={{
                          ...styles.slotBadge,
                          background: item.slot === 'AM' ? '#e3f2fd' : '#fff3e0',
                          color:      item.slot === 'AM' ? '#1565c0' : '#e65100',
                        }}>
                          {item.slot === 'AM' ? '오전' : '오후'}
                        </span>
                      </td>
                      <td style={styles.td}>{fmt(item.scheduledAt)}</td>
                      <td style={styles.td}>{fmt(item.expiresAt)}</td>
                      <td style={styles.td}>{fmt(item.respondedAt)}</td>
                      <td style={{ ...styles.td, textAlign: 'right' as const }}>
                        {item.distanceMeters != null ? Math.round(item.distanceMeters) : '-'}
                      </td>
                      <td style={styles.td}>
                        <span style={{
                          color:      STATUS_COLOR[item.status] ?? '#333',
                          fontWeight: 600,
                          fontSize:   '13px',
                        }}>
                          {STATUS_LABEL[item.status] ?? item.status}
                        </span>
                      </td>
                      <td style={styles.td}>
                        {item.needsReview && (
                          <span style={styles.reviewTag}>
                            {item.reviewReason === 'OUT_OF_GEOFENCE' ? '위치이탈' : item.reviewReason ?? '검토필요'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

const centerStyle: React.CSSProperties = { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }

const styles: Record<string, React.CSSProperties> = {
  layout:       { display: 'flex', minHeight: '100vh', background: '#f5f5f5' },
  sidebar:      { width: '220px', background: '#1a1a2e', padding: '24px 0', flexShrink: 0, display: 'flex', flexDirection: 'column' },
  sidebarTitle: { color: 'white', fontSize: '16px', fontWeight: 700, padding: '0 20px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)' },
  navSection:   { color: 'rgba(255,255,255,0.4)', fontSize: '11px', padding: '16px 20px 8px', textTransform: 'uppercase' as const, letterSpacing: '1px' },
  navItem:      { display: 'block', color: 'rgba(255,255,255,0.8)', padding: '10px 20px', fontSize: '14px', textDecoration: 'none' },
  navItemActive:{ background: 'rgba(255,255,255,0.1)', color: 'white', borderLeft: '3px solid #4fc3f7' },
  logoutBtn:    { margin: '24px 20px 0', padding: '10px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '13px' },

  main:        { flex: 1, padding: '32px' },
  header:      { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' },
  pageTitle:   { fontSize: '24px', fontWeight: 700, margin: '0 0 4px' },
  subtitle:    { fontSize: '14px', color: '#888', margin: 0 },
  datePicker:  { padding: '8px 12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' },

  cards:      { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '16px', marginBottom: '24px' },
  card:       { background: 'white', borderRadius: '10px', padding: '18px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  cardValue:  { fontSize: '28px', fontWeight: 700, marginBottom: '4px' },
  cardLabel:  { fontSize: '13px', color: '#888' },

  tableCard:   { background: 'white', borderRadius: '10px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  tableTitle:  { fontSize: '16px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' },
  reviewBadge: { background: '#fff3e0', color: '#e65100', fontSize: '12px', fontWeight: 600, padding: '3px 10px', borderRadius: '12px', border: '1px solid #ffcc80' },
  table:       { width: '100%', borderCollapse: 'collapse' as const },
  th:          { textAlign: 'left' as const, padding: '10px 12px', fontSize: '12px', color: '#888', borderBottom: '2px solid #f0f0f0', whiteSpace: 'nowrap' as const },
  td:          { padding: '12px', fontSize: '14px', borderBottom: '1px solid #f5f5f5', whiteSpace: 'nowrap' as const },
  tr:          {},
  slotBadge:   { padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: 600 },
  reviewTag:   { background: '#fce4ec', color: '#c62828', fontSize: '12px', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 },
}
