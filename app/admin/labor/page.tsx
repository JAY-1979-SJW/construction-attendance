'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface AllocationRow {
  attendanceLogId: string
  workDate: string
  workerName: string
  workerPhone: string
  company: string
  jobTitle: string
  checkInSiteName: string
  lastSiteName: string
  allocatedSiteName: string
  hasMove: boolean
  checkInAt: string | null
  checkOutAt: string | null
  totalWorkedMinutes: number | null
  status: string
  isAutoCheckout: boolean
  isAdjusted: boolean
  includeInLabor: boolean
  needsReview: boolean
  adminNote: string | null
}

interface SummaryRow {
  workerName: string
  company: string
  jobTitle: string
  allocatedSiteName: string
  totalDays: number
  totalMinutes: number
  adjustedDays: number
  autoCheckoutDays: number
  needsReviewDays: number
}

interface Meta {
  totalRows: number
  includedCount: number
  needsReviewCount: number
  autoCount: number
}

interface Site {
  id: string
  name: string
}

const STATUS_LABEL: Record<string, string> = {
  COMPLETED: '완료', ADJUSTED: '보정', MISSING_CHECKOUT: '미퇴근', EXCEPTION: '예외', ADMIN_MANUAL: '수동',
}
const STATUS_COLOR: Record<string, string> = {
  COMPLETED: '#1565c0', ADJUSTED: '#6a1b9a', MISSING_CHECKOUT: '#b71c1c', EXCEPTION: '#e65100',
}
const STATUS_BG: Record<string, string> = {
  COMPLETED: '#e3f2fd', ADJUSTED: '#f3e5f5', MISSING_CHECKOUT: '#ffebee', EXCEPTION: '#fff3e0',
}

function formatMinutes(m: number | null): string {
  if (!m || m <= 0) return '-'
  const h = Math.floor(m / 60), min = m % 60
  return h > 0 ? (min > 0 ? `${h}h ${min}m` : `${h}h`) : `${min}m`
}

export default function LaborPage() {
  const router = useRouter()
  const today  = new Date().toISOString().slice(0, 10)
  const firstOfMonth = today.slice(0, 8) + '01'

  const [dateFrom, setDateFrom] = useState(firstOfMonth)
  const [dateTo,   setDateTo]   = useState(today)
  const [siteId,   setSiteId]   = useState('')
  const [tab,      setTab]      = useState<'detail' | 'summary'>('detail')

  const [sites,   setSites]   = useState<Site[]>([])
  const [rows,    setRows]    = useState<AllocationRow[]>([])
  const [summary, setSummary] = useState<SummaryRow[]>([])
  const [meta,    setMeta]    = useState<Meta | null>(null)
  const [loading, setLoading] = useState(false)

  // 현장 목록 로드
  useEffect(() => {
    fetch('/api/admin/sites?pageSize=200')
      .then((r) => r.json())
      .then((d) => { if (d.success) setSites(d.data.items ?? d.data) })
  }, [])

  const load = () => {
    setLoading(true)
    const p = new URLSearchParams({ dateFrom, dateTo })
    if (siteId) p.set('siteId', siteId)
    fetch(`/api/admin/labor/allocations?${p}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) { router.push('/admin/login'); return }
        setRows(d.data.rows)
        setSummary(d.data.summary)
        setMeta(d.data.meta)
        setLoading(false)
      })
  }

  useEffect(load, [router])

  const handleExport = () => {
    const p = new URLSearchParams({ dateFrom, dateTo })
    if (siteId) p.set('siteId', siteId)
    window.location.href = `/api/export/labor?${p}`
  }

  return (
    <div style={s.layout}>
      <nav style={s.sidebar}>
        <div style={s.sidebarTitle}>해한 출퇴근</div>
        {[
          ['/admin', '대시보드'], ['/admin/workers', '근로자 관리'], ['/admin/companies', '회사 관리'], ['/admin/sites', '현장 관리'],
          ['/admin/attendance', '출퇴근 조회'], ['/admin/presence-checks', '체류확인 현황'], ['/admin/labor', '투입현황/노임서류'],
          ['/admin/exceptions', '예외 승인'], ['/admin/device-requests', '기기 변경'], ['/admin/audit-logs', '감사 로그'], ['/admin/site-imports', '현장 엑셀 업로드'],
        ].map(([href, label]) => (
          <Link key={href} href={href} style={{ ...s.navItem, ...(href === '/admin/labor' ? s.navActive : {}) }}>
            {label}
          </Link>
        ))}
      </nav>

      <main style={s.main}>
        <h1 style={s.pageTitle}>투입현황 / 노임서류</h1>

        {/* 필터 */}
        <div style={s.filterRow}>
          <div style={s.filterGroup}>
            <label style={s.filterLabel}>시작일</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={s.filterInput} />
          </div>
          <div style={s.filterGroup}>
            <label style={s.filterLabel}>종료일</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={s.filterInput} />
          </div>
          <div style={s.filterGroup}>
            <label style={s.filterLabel}>현장 (인정현장 기준)</label>
            <select value={siteId} onChange={(e) => setSiteId(e.target.value)} style={s.filterInput}>
              <option value="">전체 현장</option>
              {sites.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
            </select>
          </div>
          <button onClick={load} style={s.searchBtn}>조회</button>
          <button onClick={handleExport} style={s.exportBtn}>엑셀 다운로드</button>
        </div>

        {/* 집계 요약 카드 */}
        {meta && (
          <div style={s.metaRow}>
            {[
              { label: '전체 기록', value: meta.totalRows, color: '#37474f' },
              { label: '노임 집계 포함', value: meta.includedCount, color: '#4A93C8' },
              { label: '검토 필요(미퇴근)', value: meta.needsReviewCount, color: '#b71c1c' },
              { label: '자동처리 포함', value: meta.autoCount, color: '#6a1b9a' },
            ].map((item) => (
              <div key={item.label} style={{ ...s.metaCard, borderTop: `3px solid ${item.color}` }}>
                <div style={{ ...s.metaValue, color: item.color }}>{item.value}</div>
                <div style={s.metaLabel}>{item.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* 탭 */}
        <div style={s.tabRow}>
          {(['detail', 'summary'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{ ...s.tab, ...(tab === t ? s.tabActive : {}) }}
            >
              {t === 'detail' ? '투입현황 (상세)' : '노임집계 (합계)'}
            </button>
          ))}
        </div>

        {loading ? <p style={{ color: '#A0AEC0', padding: '24px 0' }}>집계 중...</p> : (
          <>
            {/* ── 탭1: 투입현황 상세 ──────────────────────────── */}
            {tab === 'detail' && (
              <div style={{ ...s.tableCard, overflowX: 'auto' }}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      {['날짜', '근로자명', '소속', '직종', '출근현장', '인정현장', '이동', '출근', '퇴근', '인정시간', '상태', '보정', '자동', '집계'].map((h) => (
                        <th key={h} style={s.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr><td colSpan={14} style={{ textAlign: 'center', padding: '32px', color: '#999' }}>데이터가 없습니다.</td></tr>
                    ) : rows.map((row) => (
                      <tr key={row.attendanceLogId} style={{
                        background: row.needsReview ? '#fff8f8' : row.isAdjusted ? '#faf5ff' : 'white',
                      }}>
                        <td style={s.td}>{row.workDate}</td>
                        <td style={{ ...s.td, fontWeight: 600 }}>{row.workerName}</td>
                        <td style={s.td}>{row.company}</td>
                        <td style={s.td}>{row.jobTitle}</td>
                        <td style={s.td}>{row.checkInSiteName}</td>
                        <td style={{ ...s.td, fontWeight: row.hasMove ? 600 : 400 }}>
                          {row.allocatedSiteName}
                          {row.hasMove && <span style={{ fontSize: '10px', color: '#e65100', marginLeft: '4px' }}>이동</span>}
                        </td>
                        <td style={{ ...s.td, textAlign: 'center' }}>{row.hasMove ? '✓' : ''}</td>
                        <td style={s.td}>{row.checkInAt ?? '-'}</td>
                        <td style={s.td}>{row.checkOutAt ?? <span style={{ color: '#b71c1c' }}>미기록</span>}</td>
                        <td style={{ ...s.td, fontWeight: 600 }}>{formatMinutes(row.totalWorkedMinutes)}</td>
                        <td style={s.td}>
                          <span style={{
                            color: STATUS_COLOR[row.status] ?? '#555',
                            background: STATUS_BG[row.status] ?? '#f5f5f5',
                            fontSize: '11px', padding: '2px 8px', borderRadius: '10px', fontWeight: 600,
                          }}>
                            {STATUS_LABEL[row.status] ?? row.status}
                          </span>
                        </td>
                        <td style={{ ...s.td, textAlign: 'center' }}>
                          {row.isAdjusted && <span style={{ color: '#6a1b9a', fontSize: '11px' }}>보정</span>}
                        </td>
                        <td style={{ ...s.td, textAlign: 'center' }}>
                          {row.isAutoCheckout && <span style={{ color: '#b71c1c', fontSize: '11px' }}>AUTO</span>}
                        </td>
                        <td style={{ ...s.td, textAlign: 'center' }}>
                          {row.includeInLabor
                            ? <span style={{ color: '#2e7d32', fontSize: '11px' }}>포함</span>
                            : row.needsReview
                              ? <span style={{ color: '#b71c1c', fontSize: '11px' }}>검토</span>
                              : <span style={{ color: '#bbb', fontSize: '11px' }}>제외</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── 탭2: 노임집계 합계 ──────────────────────────── */}
            {tab === 'summary' && (
              <div style={{ ...s.tableCard, overflowX: 'auto' }}>
                <div style={{ fontSize: '12px', color: '#A0AEC0', marginBottom: '12px' }}>
                  * COMPLETED + ADJUSTED 기준 합산. MISSING_CHECKOUT은 검토필요 건수만 표시됩니다.
                </div>
                <table style={s.table}>
                  <thead>
                    <tr>
                      {['인정현장', '근로자명', '소속', '직종', '투입일수', '인정시간', '보정', '자동처리', '검토필요', '비고'].map((h) => (
                        <th key={h} style={s.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {summary.length === 0 ? (
                      <tr><td colSpan={10} style={{ textAlign: 'center', padding: '32px', color: '#999' }}>데이터가 없습니다.</td></tr>
                    ) : summary.map((row, i) => (
                      <tr key={i} style={{ background: row.needsReviewDays > 0 ? '#fff8f8' : 'white' }}>
                        <td style={{ ...s.td, fontWeight: 600 }}>{row.allocatedSiteName}</td>
                        <td style={{ ...s.td, fontWeight: 600 }}>{row.workerName}</td>
                        <td style={s.td}>{row.company}</td>
                        <td style={s.td}>{row.jobTitle}</td>
                        <td style={{ ...s.td, textAlign: 'center', fontWeight: 700, color: '#4A93C8' }}>{row.totalDays}일</td>
                        <td style={{ ...s.td, textAlign: 'center', fontWeight: 700 }}>{formatMinutes(row.totalMinutes)}</td>
                        <td style={{ ...s.td, textAlign: 'center' }}>
                          {row.adjustedDays > 0 && <span style={{ color: '#6a1b9a', fontSize: '12px' }}>{row.adjustedDays}건</span>}
                        </td>
                        <td style={{ ...s.td, textAlign: 'center' }}>
                          {row.autoCheckoutDays > 0 && <span style={{ color: '#b71c1c', fontSize: '12px' }}>{row.autoCheckoutDays}건</span>}
                        </td>
                        <td style={{ ...s.td, textAlign: 'center' }}>
                          {row.needsReviewDays > 0 && <span style={{ color: '#b71c1c', fontWeight: 700, fontSize: '12px' }}>{row.needsReviewDays}건 ⚠</span>}
                        </td>
                        <td style={s.td}>
                          {row.adjustedDays > 0 && '보정있음 '}
                          {row.needsReviewDays > 0 && '검토필요'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* 집계 기준 안내 */}
        <div style={s.legend}>
          <div style={s.legendTitle}>집계 기준</div>
          <div style={s.legendRow}>
            <span style={{ ...s.badge, color: '#4A93C8', background: 'rgba(91,164,217,0.1)' }}>완료</span>
            <span style={s.legendText}>정상 집계 포함 (COMPLETED)</span>
          </div>
          <div style={s.legendRow}>
            <span style={{ ...s.badge, color: '#6a1b9a', background: '#f3e5f5' }}>보정</span>
            <span style={s.legendText}>관리자 보정 후 집계 포함 (ADJUSTED)</span>
          </div>
          <div style={s.legendRow}>
            <span style={{ ...s.badge, color: '#b71c1c', background: '#ffebee' }}>미퇴근</span>
            <span style={s.legendText}>집계 제외 — 검토 필요 (MISSING_CHECKOUT)</span>
          </div>
          <div style={{ ...s.legendRow, marginTop: '8px', fontSize: '12px', color: '#A0AEC0' }}>
            인정 현장 기준: 이동 이력이 있으면 마지막 현장 기준 / 없으면 출근 현장 기준
          </div>
        </div>
      </main>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  layout:       { display: 'flex', minHeight: '100vh', background: '#1B2838' },
  sidebar:      { width: '220px', background: '#141E2A', padding: '24px 0', flexShrink: 0 },
  sidebarTitle: { color: 'white', fontSize: '16px', fontWeight: 700, padding: '0 20px 24px' },
  navItem:      { display: 'block', color: 'rgba(255,255,255,0.75)', padding: '10px 20px', fontSize: '14px', textDecoration: 'none' },
  navActive:    { color: 'white', background: 'rgba(255,255,255,0.1)', fontWeight: 700 },
  main:         { flex: 1, padding: '32px' },
  pageTitle:    { fontSize: '22px', fontWeight: 700, margin: '0 0 20px' },
  filterRow:    { display: 'flex', gap: '12px', alignItems: 'flex-end', marginBottom: '20px', flexWrap: 'wrap' as const },
  filterGroup:  { display: 'flex', flexDirection: 'column' as const, gap: '4px' },
  filterLabel:  { fontSize: '12px', color: '#A0AEC0' },
  filterInput:  { padding: '8px 12px', border: '1px solid rgba(91,164,217,0.3)', borderRadius: '6px', fontSize: '14px' },
  searchBtn:    { padding: '8px 20px', background: '#F47920', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' },
  exportBtn:    { padding: '8px 20px', background: '#2e7d32', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' },
  metaRow:      { display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' as const },
  metaCard:     { background: '#243144', borderRadius: '10px', padding: '16px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.35)', minWidth: '140px' },
  metaValue:    { fontSize: '28px', fontWeight: 700, marginBottom: '4px' },
  metaLabel:    { fontSize: '12px', color: '#A0AEC0' },
  tabRow:       { display: 'flex', gap: '0', marginBottom: '16px', borderBottom: '2px solid #e0e0e0' },
  tab:          { padding: '10px 24px', background: 'none', border: 'none', fontSize: '14px', cursor: 'pointer', color: '#A0AEC0', fontWeight: 500, borderBottom: '2px solid transparent', marginBottom: '-2px' },
  tabActive:    { color: '#5BA4D9', fontWeight: 700, borderBottom: '2px solid #1976d2' },
  tableCard:    { background: '#243144', borderRadius: '10px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.35)', marginBottom: '20px' },
  table:        { width: '100%', borderCollapse: 'collapse' as const },
  th:           { textAlign: 'left' as const, padding: '10px 12px', fontSize: '12px', color: '#A0AEC0', borderBottom: '2px solid rgba(91,164,217,0.2)', whiteSpace: 'nowrap' as const },
  td:           { padding: '9px 12px', fontSize: '13px', borderBottom: '1px solid #f5f5f5', whiteSpace: 'nowrap' as const },
  legend:       { background: '#243144', borderRadius: '10px', padding: '20px 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.35)' },
  legendTitle:  { fontSize: '12px', color: '#A0AEC0', fontWeight: 600, marginBottom: '10px', textTransform: 'uppercase' as const },
  legendRow:    { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' },
  legendText:   { fontSize: '13px', color: '#555' },
  badge:        { fontSize: '11px', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 },
}
