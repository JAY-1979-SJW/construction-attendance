'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface PilotMetrics {
  totalWorkers: number
  approvedDevices: number
  pendingDevices: number
  working: number
  completed: number
  adjusted: number
  moveCount: number
  needsReview: number
  suspectedMissing: number
  manualCorrections: number
}

interface PilotSummary {
  generatedAt: string
  targetDate: string
  metrics: PilotMetrics
}

const METRIC_CONFIG: Array<{
  key: keyof PilotMetrics
  label: string
  sub: string
  color: string
  alert?: (v: number) => boolean
}> = [
  { key: 'totalWorkers',      label: '총 대상자',            sub: '등록 근로자',          color: '#37474f' },
  { key: 'approvedDevices',   label: '승인 완료 기기',        sub: '활성 기기',             color: '#1976d2' },
  { key: 'pendingDevices',    label: '승인 대기',             sub: '기기 요청 PENDING',     color: '#7b1fa2', alert: (v) => v > 0 },
  { key: 'working',           label: 'WORKING',              sub: '출근 후 미퇴근',         color: '#2e7d32' },
  { key: 'completed',         label: 'COMPLETED',            sub: '정상 퇴근 완료',         color: '#1565c0' },
  { key: 'adjusted',          label: 'ADJUSTED',             sub: '수동 보정 완료',         color: '#455a64' },
  { key: 'moveCount',         label: '이동 건수',             sub: '오늘 현장 이동',         color: '#00695c' },
  { key: 'needsReview',       label: 'needsReview',          sub: 'MISSING_CHECKOUT 누적', color: '#e65100', alert: (v) => v > 0 },
  { key: 'suspectedMissing',  label: '퇴근 누락 의심',        sub: '4h+ WORKING',          color: '#b71c1c', alert: (v) => v > 0 },
  { key: 'manualCorrections', label: '수동 보정 건수',        sub: '오늘 ADJUSTED',         color: '#5d4037' },
]

export default function PilotMonitorPage() {
  const router = useRouter()
  const [data, setData] = useState<PilotSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/admin/pilot/summary')
      .then((r) => r.json())
      .then((res) => {
        if (!res.success) { router.push('/admin/login'); return }
        setData(res.data)
        setLastRefresh(new Date())
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [router])

  useEffect(() => {
    load()
    const timer = setInterval(load, 60_000) // 1분마다 자동 갱신
    return () => clearInterval(timer)
  }, [load])

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  return (
    <div style={styles.layout}>
      {/* Sidebar */}
      <nav style={styles.sidebar}>
        <div style={styles.sidebarTitle}>해한 출퇴근</div>
        <div style={styles.navSection}>관리</div>
        {[
          { href: '/admin',               label: '대시보드' },
          { href: '/admin/workers',       label: '근로자 관리' },
          { href: '/admin/sites',         label: '현장 관리' },
          { href: '/admin/attendance',    label: '출퇴근 조회' },
          { href: '/admin/labor',         label: '투입현황/노임서류' },
          { href: '/admin/exceptions',    label: '예외 승인' },
          { href: '/admin/device-requests', label: '기기 승인' },
          { href: '/admin/settings',        label: '⚙️ 시스템 설정' },
          { href: '/admin/pilot',         label: '파일럿 모니터링' },
        ].map((item) => (
          <Link key={item.href} href={item.href} style={styles.navItem}>{item.label}</Link>
        ))}
      </nav>

      {/* Main */}
      <main style={styles.main}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.pageTitle}>파일럿 운영 모니터링</h1>
            <p style={styles.dateLabel}>
              {data?.targetDate} &nbsp;|&nbsp; 마지막 갱신: {lastRefresh ? formatTime(lastRefresh.toISOString()) : '-'}
              &nbsp;
              <span style={styles.autoTag}>1분 자동 갱신</span>
            </p>
          </div>
          <button onClick={load} style={styles.refreshBtn} disabled={loading}>
            {loading ? '갱신 중...' : '지금 갱신'}
          </button>
        </div>

        {loading && !data ? (
          <div style={centerStyle}>로딩 중...</div>
        ) : (
          <>
            <div style={styles.grid}>
              {METRIC_CONFIG.map(({ key, label, sub, color, alert }) => {
                const value = data?.metrics[key] ?? 0
                const isAlert = alert?.(value)
                return (
                  <div
                    key={key}
                    style={{
                      ...styles.card,
                      borderTop: `4px solid ${isAlert ? '#d32f2f' : color}`,
                      background: isAlert ? '#fff8f8' : 'white',
                    }}
                  >
                    <div style={{ ...styles.value, color: isAlert ? '#d32f2f' : color }}>
                      {value}
                    </div>
                    <div style={styles.label}>{label}</div>
                    <div style={styles.sub}>{sub}</div>
                    {isAlert && <div style={styles.alertBadge}>확인 필요</div>}
                  </div>
                )
              })}
            </div>

            {/* 운영 기준 안내 */}
            <div style={styles.guide}>
              <div style={styles.guideTitle}>운영 기준</div>
              <ul style={styles.guideList}>
                <li>승인 대기 30분 이상 방치 금지 — <strong>pendingDevices &gt; 0</strong> 즉시 처리</li>
                <li>퇴근 전 WORKING 잔존 확인 — <strong>working</strong> = 0 이어야 당일 종료 가능</li>
                <li>needsReview = MISSING_CHECKOUT 누적 — 익일 오전 전까지 검토 완료</li>
                <li>퇴근 누락 의심(suspectedMissing) = 4시간 이상 WORKING 상태 유지 근로자</li>
              </ul>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

const centerStyle: React.CSSProperties = { display: 'flex', justifyContent: 'center', padding: '60px' }

const styles: Record<string, React.CSSProperties> = {
  layout:       { display: 'flex', minHeight: '100vh', background: '#f5f5f5' },
  sidebar:      { width: '220px', background: '#1a1a2e', padding: '24px 0', flexShrink: 0, display: 'flex', flexDirection: 'column' },
  sidebarTitle: { color: 'white', fontSize: '16px', fontWeight: 700, padding: '0 20px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)' },
  navSection:   { color: 'rgba(255,255,255,0.4)', fontSize: '11px', padding: '16px 20px 8px', textTransform: 'uppercase' as const, letterSpacing: '1px' },
  navItem:      { display: 'block', color: 'rgba(255,255,255,0.8)', padding: '10px 20px', fontSize: '14px', textDecoration: 'none' },
  main:         { flex: 1, padding: '32px' },
  header:       { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' },
  pageTitle:    { fontSize: '24px', fontWeight: 700, margin: '0 0 4px' },
  dateLabel:    { fontSize: '13px', color: '#888', margin: 0 },
  autoTag:      { background: '#e3f2fd', color: '#1565c0', borderRadius: '4px', padding: '2px 6px', fontSize: '11px' },
  refreshBtn:   { padding: '10px 20px', background: '#1976d2', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 },
  grid:         { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' },
  card:         { background: 'white', borderRadius: '10px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', position: 'relative' as const },
  value:        { fontSize: '36px', fontWeight: 700, marginBottom: '4px' },
  label:        { fontSize: '14px', fontWeight: 600, marginBottom: '2px' },
  sub:          { fontSize: '12px', color: '#aaa' },
  alertBadge:   { position: 'absolute' as const, top: '12px', right: '12px', background: '#d32f2f', color: 'white', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 },
  guide:        { background: 'white', borderRadius: '10px', padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  guideTitle:   { fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: '#444' },
  guideList:    { margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#666', lineHeight: '2' },
}
