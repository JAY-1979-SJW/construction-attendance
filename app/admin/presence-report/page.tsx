'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface DailyRow {
  date: string
  total: number
  completed: number
  noResponse: number
  outOfFence: number
  review: number
  manualConfirmed: number
  manualRejected: number
  completedRate: number | null
  noResponseRate: number | null
  outOfFenceRate: number | null
  reviewRate: number | null
  manualRate: number | null
}

interface Totals {
  total: number
  completed: number
  noResponse: number
  outOfFence: number
  review: number
  manualConfirmed: number
  manualRejected: number
  completedRate: number | null
  noResponseRate: number | null
  outOfFenceRate: number | null
  reviewRate: number | null
  manualRate: number | null
}

interface SiteRow {
  siteId: string
  siteName: string
  total: number
  completedRate: number | null
}

interface Site { id: string; name: string }

interface ReportData {
  days: number
  today: string
  siteId: string | null
  sites: Site[]
  daily: DailyRow[]
  totals: Totals
  siteBreakdown: SiteRow[]
}

function pctColor(rate: number | null, inverse = false): string {
  if (rate === null) return '#999'
  const good = inverse ? rate <= 5 : rate >= 80
  const warn = inverse ? rate <= 20 : rate >= 60
  return good ? '#2e7d32' : warn ? '#f57f17' : '#b71c1c'
}

function RateCell({ rate, inverse = false }: { rate: number | null; inverse?: boolean }) {
  if (rate === null) return <span style={{ color: '#bbb' }}>-</span>
  return <span style={{ color: pctColor(rate, inverse), fontWeight: 600 }}>{rate}%</span>
}

export default function PresenceReportPage() {
  const router = useRouter()
  const [days,    setDays]    = useState(7)
  const [siteId,  setSiteId]  = useState('')
  const [data,    setData]    = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ days: String(days) })
    if (siteId) params.set('siteId', siteId)
    fetch(`/api/admin/presence-report?${params}`)
      .then((r) => r.json())
      .then((res) => {
        if (!res.success) { router.push('/admin/login'); return }
        setData(res.data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [days, siteId, router])

  useEffect(() => { load() }, [load])

  const handleLogout = () => {
    fetch('/api/admin/auth/logout', { method: 'POST' }).then(() => router.push('/admin/login'))
  }

  const NAV = [
    { href: '/admin',                label: '대시보드' },
    { href: '/admin/workers',         label: '근로자 관리' },
  { href: '/admin/companies', label: '회사 관리' },
    { href: '/admin/sites',           label: '현장 관리' },
    { href: '/admin/attendance',      label: '출퇴근 조회' },
    { href: '/admin/presence-checks', label: '체류확인 현황' },
    { href: '/admin/presence-report', label: '체류확인 리포트' },
    { href: '/admin/labor',           label: '투입현황/노임서류' },
    { href: '/admin/exceptions',      label: '예외 승인' },
    { href: '/admin/device-requests', label: '기기 변경' },
    { href: '/admin/settings',        label: '설정' },
  ]

  return (
    <div style={s.layout}>
      <nav style={s.sidebar}>
        <div style={s.sidebarTitle}>해한 출퇴근</div>
        <div style={s.navSection}>관리</div>
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} style={{
            ...s.navItem,
            ...(item.href === '/admin/presence-report' ? s.navActive : {}),
          }}>{item.label}</Link>
        ))}
        <button onClick={handleLogout} style={s.logoutBtn}>로그아웃</button>
      </nav>

      <main style={s.main}>
        <div style={s.header}>
          <div>
            <h1 style={s.pageTitle}>체류확인 리포트</h1>
            <p style={s.subtitle}>일자별 완료율·미응답률·위치이탈률·검토필요 비율 집계</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} style={s.select}>
              <option value={7}>최근 7일</option>
              <option value={14}>최근 14일</option>
              <option value={30}>최근 30일</option>
            </select>
            <select value={siteId} onChange={(e) => setSiteId(e.target.value)} style={s.select}>
              <option value="">전체 현장</option>
              {data?.sites.map((site) => (
                <option key={site.id} value={site.id}>{site.name}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div style={s.empty}>로딩 중...</div>
        ) : !data || data.totals.total === 0 ? (
          <div style={s.empty}>해당 기간에 체류확인 기록이 없습니다.</div>
        ) : (
          <>
            {/* 전체 요약 카드 */}
            <div style={s.cards}>
              {[
                { label: '전체 건수',   value: data.totals.total,          unit: '건',  color: '#37474f' },
                { label: '완료율',      value: data.totals.completedRate,  unit: '%',   color: pctColor(data.totals.completedRate) },
                { label: '미응답률',    value: data.totals.noResponseRate, unit: '%',   color: pctColor(data.totals.noResponseRate, true) },
                { label: '위치이탈률',  value: data.totals.outOfFenceRate, unit: '%',   color: pctColor(data.totals.outOfFenceRate, true) },
                { label: '검토필요 비율', value: data.totals.reviewRate,   unit: '%',   color: pctColor(data.totals.reviewRate, true) },
                { label: '수동 처리율', value: data.totals.manualRate,     unit: '%',   color: '#546e7a' },
              ].map((c) => (
                <div key={c.label} style={{ ...s.card, borderTop: `4px solid ${c.color}` }}>
                  <div style={{ ...s.cardVal, color: c.color }}>
                    {c.value != null ? `${c.value}${c.unit}` : '-'}
                  </div>
                  <div style={s.cardLabel}>{c.label}</div>
                </div>
              ))}
            </div>

            {/* 일자별 표 */}
            <div style={s.tableCard}>
              <div style={s.tableTitle}>일자별 체류확인 현황</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      {['날짜', '전체', '완료', '완료율', '미응답', '미응답률', '이탈', '이탈률', '검토필요', '수동처리'].map((h) => (
                        <th key={h} style={s.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.daily.map((row) => (
                      <tr key={row.date} style={{
                        ...s.tr,
                        background: row.date === data.today ? '#f3f8ff' : undefined,
                        fontWeight: row.date === data.today ? 600 : undefined,
                      }}>
                        <td style={s.td}>
                          {row.date}
                          {row.date === data.today && <span style={s.todayBadge}>오늘</span>}
                        </td>
                        <td style={{ ...s.td, textAlign: 'center' as const }}>{row.total || '-'}</td>
                        <td style={{ ...s.td, textAlign: 'center' as const }}>{row.completed || '-'}</td>
                        <td style={{ ...s.td, textAlign: 'center' as const }}><RateCell rate={row.completedRate} /></td>
                        <td style={{ ...s.td, textAlign: 'center' as const }}>{row.noResponse || '-'}</td>
                        <td style={{ ...s.td, textAlign: 'center' as const }}><RateCell rate={row.noResponseRate} inverse /></td>
                        <td style={{ ...s.td, textAlign: 'center' as const }}>{row.outOfFence || '-'}</td>
                        <td style={{ ...s.td, textAlign: 'center' as const }}><RateCell rate={row.outOfFenceRate} inverse /></td>
                        <td style={{ ...s.td, textAlign: 'center' as const, color: row.review > 0 ? '#f57f17' : undefined, fontWeight: row.review > 0 ? 700 : undefined }}>
                          {row.review || '-'}
                        </td>
                        <td style={{ ...s.td, textAlign: 'center' as const }}>{(row.manualConfirmed + row.manualRejected) || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#f8f9fa', fontWeight: 700 }}>
                      <td style={s.td}>합계</td>
                      <td style={{ ...s.td, textAlign: 'center' as const }}>{data.totals.total}</td>
                      <td style={{ ...s.td, textAlign: 'center' as const }}>{data.totals.completed}</td>
                      <td style={{ ...s.td, textAlign: 'center' as const }}><RateCell rate={data.totals.completedRate} /></td>
                      <td style={{ ...s.td, textAlign: 'center' as const }}>{data.totals.noResponse}</td>
                      <td style={{ ...s.td, textAlign: 'center' as const }}><RateCell rate={data.totals.noResponseRate} inverse /></td>
                      <td style={{ ...s.td, textAlign: 'center' as const }}>{data.totals.outOfFence}</td>
                      <td style={{ ...s.td, textAlign: 'center' as const }}><RateCell rate={data.totals.outOfFenceRate} inverse /></td>
                      <td style={{ ...s.td, textAlign: 'center' as const, color: data.totals.review > 0 ? '#f57f17' : undefined }}>
                        {data.totals.review}
                      </td>
                      <td style={{ ...s.td, textAlign: 'center' as const }}>{data.totals.manualConfirmed + data.totals.manualRejected}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* 현장별 비교 */}
            {data.siteBreakdown.length > 1 && (
              <div style={{ ...s.tableCard, marginTop: '20px' }}>
                <div style={s.tableTitle}>현장별 완료율 비교</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={s.table}>
                    <thead>
                      <tr>
                        {['현장', '전체', '완료율'].map((h) => (
                          <th key={h} style={s.th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.siteBreakdown.map((row) => (
                        <tr key={row.siteId} style={s.tr}>
                          <td style={s.td}>{row.siteName}</td>
                          <td style={{ ...s.td, textAlign: 'center' as const }}>{row.total}</td>
                          <td style={{ ...s.td, textAlign: 'center' as const }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                              <div style={{
                                width: `${Math.min(row.completedRate ?? 0, 100)}px`,
                                height: '8px', borderRadius: '4px',
                                background: pctColor(row.completedRate),
                                transition: 'width 0.3s',
                              }} />
                              <RateCell rate={row.completedRate} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  layout:       { display: 'flex', minHeight: '100vh', background: '#1B2838' },
  sidebar:      { width: '220px', background: '#141E2A', padding: '24px 0', flexShrink: 0, display: 'flex', flexDirection: 'column' },
  sidebarTitle: { color: 'white', fontSize: '16px', fontWeight: 700, padding: '0 20px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)' },
  navSection:   { color: 'rgba(255,255,255,0.4)', fontSize: '11px', padding: '16px 20px 8px', textTransform: 'uppercase', letterSpacing: '1px' },
  navItem:      { display: 'block', color: 'rgba(255,255,255,0.8)', padding: '10px 20px', fontSize: '14px', textDecoration: 'none' },
  navActive:    { background: 'rgba(255,255,255,0.1)', color: 'white', borderLeft: '3px solid #4fc3f7' },
  logoutBtn:    { margin: '24px 20px 0', padding: '10px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '13px' },
  main:         { flex: 1, padding: '32px' },
  header:       { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' },
  pageTitle:    { fontSize: '24px', fontWeight: 700, margin: '0 0 4px' },
  subtitle:     { fontSize: '14px', color: '#A0AEC0', margin: 0 },
  select:       { padding: '8px 12px', border: '1px solid rgba(91,164,217,0.3)', borderRadius: '8px', fontSize: '13px', background: 'white' },
  cards:        { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '14px', marginBottom: '24px' },
  card:         { background: '#243144', borderRadius: '10px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.35)' },
  cardVal:      { fontSize: '26px', fontWeight: 700, marginBottom: '4px' },
  cardLabel:    { fontSize: '12px', color: '#A0AEC0' },
  tableCard:    { background: '#243144', borderRadius: '10px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.35)' },
  tableTitle:   { fontSize: '15px', fontWeight: 700, marginBottom: '16px' },
  table:        { width: '100%', borderCollapse: 'collapse' },
  th:           { textAlign: 'left', padding: '9px 12px', fontSize: '12px', color: '#A0AEC0', borderBottom: '2px solid rgba(91,164,217,0.2)', whiteSpace: 'nowrap' },
  td:           { padding: '10px 12px', fontSize: '13px', borderBottom: '1px solid #f5f5f5', whiteSpace: 'nowrap' },
  tr:           {},
  todayBadge:   { marginLeft: '6px', fontSize: '11px', background: 'rgba(244,121,32,0.12)', color: '#F47920', padding: '1px 6px', borderRadius: '8px' },
  empty:        { textAlign: 'center', padding: '48px', color: '#999' },
}
