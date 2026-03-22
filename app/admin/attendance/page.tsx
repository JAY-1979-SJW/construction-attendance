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
  adminNote: string | null
  isAutoCheckout: boolean
}

interface DetailRecord {
  id: string
  workerName: string
  workerPhone: string
  company: string
  jobTitle: string
  workDate: string
  status: string
  checkInAt: string | null
  checkOutAt: string | null
  checkInDistance: number | null
  checkOutDistance: number | null
  checkInSite: { id: string; name: string; address: string }
  checkOutSite: { id: string; name: string } | null
  adminNote: string | null
  isAutoCheckout: boolean
  exceptionReason: string | null
  moveEvents: { id: string; siteName: string; occurredAt: string; distanceFromSite: number | null }[]
}

const STATUS_LABEL: Record<string, string> = {
  WORKING: '근무중',
  COMPLETED: '완료',
  MISSING_CHECKOUT: '미퇴근',
  EXCEPTION: '예외',
  ADJUSTED: '보정',
}
const STATUS_COLOR: Record<string, string> = {
  WORKING: '#2e7d32',
  COMPLETED: '#1565c0',
  MISSING_CHECKOUT: '#b71c1c',
  EXCEPTION: '#e65100',
  ADJUSTED: '#6a1b9a',
}
const STATUS_BG: Record<string, string> = {
  WORKING: '#e8f5e9',
  COMPLETED: '#e3f2fd',
  MISSING_CHECKOUT: '#ffebee',
  EXCEPTION: '#fff3e0',
  ADJUSTED: '#f3e5f5',
}

export default function AdminAttendancePage() {
  const router = useRouter()
  const today = new Date().toISOString().slice(0, 10)
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo, setDateTo] = useState(today)
  const [statusFilter, setStatusFilter] = useState('')
  const [items, setItems] = useState<AttendanceRecord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  // 상세 모달
  const [detail, setDetail] = useState<DetailRecord | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // 수동 보정 모달
  const [correcting, setCorrecting] = useState(false)
  const [correctCheckOut, setCorrectCheckOut] = useState('')
  const [correctNote, setCorrectNote] = useState('')
  const [correctSaving, setCorrectSaving] = useState(false)

  const load = () => {
    setLoading(true)
    const params = new URLSearchParams({ dateFrom, dateTo, pageSize: '200' })
    if (statusFilter) params.set('status', statusFilter)
    fetch(`/api/admin/attendance?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) { router.push('/admin/login'); return }
        setItems(data.data.items)
        setTotal(data.data.total)
        setLoading(false)
      })
  }

  useEffect(load, [router])

  const openDetail = (id: string) => {
    setDetailLoading(true)
    setDetail(null)
    setCorrecting(false)
    fetch(`/api/admin/attendance/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setDetail(data.data)
        setDetailLoading(false)
      })
  }

  const closeDetail = () => {
    setDetail(null)
    setCorrecting(false)
    setCorrectCheckOut('')
    setCorrectNote('')
  }

  const saveCorrection = async () => {
    if (!detail || !correctCheckOut) return
    setCorrectSaving(true)
    const res = await fetch(`/api/admin/attendance/${detail.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        checkOutAt: new Date(`${detail.workDate}T${correctCheckOut}:00+09:00`).toISOString(),
        status: 'ADJUSTED',
        adminNote: correctNote || `수동 보정 (퇴근 시각: ${correctCheckOut})`,
      }),
    })
    const data = await res.json()
    if (data.success) {
      closeDetail()
      load()
    }
    setCorrectSaving(false)
  }

  const handleExport = () => {
    const params = new URLSearchParams({ dateFrom, dateTo })
    if (statusFilter) params.set('status', statusFilter)
    window.location.href = `/api/export/attendance?${params}`
  }

  const formatTime = (iso: string | null) =>
    iso ? new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-'

  const formatDateTime = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'

  return (
    <div style={styles.layout}>
      <nav style={styles.sidebar}>
        <div style={styles.sidebarTitle}>해한 출퇴근</div>
        {[
          ['/admin', '대시보드'], ['/admin/workers', '근로자 관리'], ['/admin/companies', '회사 관리'], ['/admin/sites', '현장 관리'],
          ['/admin/attendance', '출퇴근 조회'], ['/admin/presence-checks', '체류확인 현황'], ['/admin/labor', '투입현황/노임서류'],
          ['/admin/exceptions', '예외 승인'], ['/admin/device-requests', '기기 변경'], ['/admin/audit-logs', '감사 로그'],
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
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>상태</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={styles.filterInput}>
              <option value="">전체</option>
              <option value="WORKING">근무중</option>
              <option value="COMPLETED">완료</option>
              <option value="MISSING_CHECKOUT">미퇴근</option>
              <option value="EXCEPTION">예외</option>
              <option value="ADJUSTED">보정</option>
            </select>
          </div>
          <button onClick={load} style={styles.searchBtn}>조회</button>
          <button onClick={handleExport} style={styles.exportBtn}>엑셀 다운로드</button>
        </div>

        <div style={{ fontSize: '13px', color: '#888', marginBottom: '12px' }}>
          총 {total}건
          {statusFilter === 'MISSING_CHECKOUT' && (
            <span style={{ marginLeft: '12px', color: '#b71c1c', fontWeight: 600 }}>
              ⚠ 미퇴근 건은 수동 보정이 필요합니다. 행을 클릭하세요.
            </span>
          )}
        </div>

        {loading ? <p>로딩 중...</p> : (
          <div style={{ ...styles.tableCard, overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {['날짜', '이름', '회사', '직종', '현장', '출근', '퇴근', '출근거리', '퇴근거리', '상태', '자동처리', '예외사유'].map((h) => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={12} style={{ textAlign: 'center', padding: '24px', color: '#999' }}>데이터가 없습니다.</td></tr>
                ) : items.map((item) => (
                  <tr
                    key={item.id}
                    style={{ ...styles.tr, cursor: 'pointer', background: item.status === 'MISSING_CHECKOUT' ? '#fff8f8' : 'white' }}
                    onClick={() => openDetail(item.id)}
                  >
                    <td style={styles.td}>{item.workDate}</td>
                    <td style={styles.td}>{item.workerName}</td>
                    <td style={styles.td}>{item.company}</td>
                    <td style={styles.td}>{item.jobTitle}</td>
                    <td style={styles.td}>{item.siteName}</td>
                    <td style={styles.td}>{formatTime(item.checkInAt)}</td>
                    <td style={styles.td}>{formatTime(item.checkOutAt)}</td>
                    <td style={{ ...styles.td, textAlign: 'right' as const }}>
                      {item.checkInDistance != null
                        ? <span style={{ fontSize: '12px', color: item.checkInDistance > 200 ? '#e65100' : '#2e7d32', fontWeight: 600 }}>{item.checkInDistance}m</span>
                        : <span style={{ fontSize: '11px', color: '#ccc' }}>-</span>}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right' as const }}>
                      {item.checkOutDistance != null
                        ? <span style={{ fontSize: '12px', color: item.checkOutDistance > 200 ? '#e65100' : '#555', fontWeight: 600 }}>{item.checkOutDistance}m</span>
                        : <span style={{ fontSize: '11px', color: '#ccc' }}>-</span>}
                    </td>
                    <td style={styles.td}>
                      <span style={{
                        color: STATUS_COLOR[item.status],
                        background: STATUS_BG[item.status],
                        fontWeight: 600,
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '10px',
                      }}>
                        {STATUS_LABEL[item.status] ?? item.status}
                      </span>
                    </td>
                    <td style={styles.td}>
                      {item.isAutoCheckout && (
                        <span style={{ fontSize: '11px', background: '#ffebee', color: '#b71c1c', padding: '2px 6px', borderRadius: '4px' }}>
                          AUTO
                        </span>
                      )}
                    </td>
                    <td style={styles.td}>
                      {item.exceptionReason
                        ? <span style={{ fontSize: '11px', background: '#fff3e0', color: '#e65100', padding: '2px 8px', borderRadius: '10px', fontWeight: 600, whiteSpace: 'nowrap' as const }}>{item.exceptionReason}</span>
                        : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* 상세 모달 */}
      {(detail || detailLoading) && (
        <div style={overlay} onClick={closeDetail}>
          <div style={modal} onClick={(e) => e.stopPropagation()}>
            {detailLoading ? (
              <p style={{ textAlign: 'center', padding: '40px', color: '#888' }}>로딩 중...</p>
            ) : detail && (
              <>
                <div style={modalHeader}>
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 700 }}>{detail.workerName} 상세</div>
                    <div style={{ fontSize: '13px', color: '#888', marginTop: '2px' }}>{detail.workDate} · {detail.company} · {detail.jobTitle}</div>
                  </div>
                  <button onClick={closeDetail} style={closeBtn}>✕</button>
                </div>

                {/* 상태 배지 */}
                <div style={{ marginBottom: '20px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{
                    color: STATUS_COLOR[detail.status],
                    background: STATUS_BG[detail.status],
                    fontWeight: 700,
                    fontSize: '13px',
                    padding: '4px 12px',
                    borderRadius: '12px',
                  }}>
                    {STATUS_LABEL[detail.status] ?? detail.status}
                  </span>
                  {detail.isAutoCheckout && (
                    <span style={{ fontSize: '11px', background: '#ffebee', color: '#b71c1c', padding: '3px 8px', borderRadius: '4px', fontWeight: 600 }}>
                      AUTO 자동처리
                    </span>
                  )}
                </div>

                {/* 현장 정보 */}
                <div style={infoSection}>
                  <div style={infoTitle}>현장 이력</div>
                  <div style={infoRow}>
                    <span style={infoLabel}>출근 현장</span>
                    <span style={infoValue}>{detail.checkInSite.name}</span>
                  </div>
                  {detail.moveEvents.map((mv, i) => (
                    <div key={mv.id} style={infoRow}>
                      <span style={infoLabel}>이동 {i + 1}</span>
                      <span style={infoValue}>→ {mv.siteName} ({formatDateTime(mv.occurredAt)})</span>
                    </div>
                  ))}
                  <div style={infoRow}>
                    <span style={infoLabel}>퇴근 현장</span>
                    <span style={infoValue}>{detail.checkOutSite?.name ?? detail.checkInSite.name}</span>
                  </div>
                </div>

                {/* 시간 정보 */}
                <div style={infoSection}>
                  <div style={infoTitle}>출퇴근 시각</div>
                  <div style={infoRow}>
                    <span style={infoLabel}>출근</span>
                    <span style={infoValue}>{formatDateTime(detail.checkInAt)} {detail.checkInDistance != null ? `(${detail.checkInDistance}m)` : ''}</span>
                  </div>
                  <div style={infoRow}>
                    <span style={infoLabel}>퇴근</span>
                    <span style={infoValue}>
                      {detail.checkOutAt ? `${formatDateTime(detail.checkOutAt)} ${detail.checkOutDistance != null ? `(${detail.checkOutDistance}m)` : ''}` : '미기록'}
                    </span>
                  </div>
                </div>

                {/* 관리자 메모 */}
                {detail.adminNote && (
                  <div style={{ ...infoSection, background: '#fff8f8' }}>
                    <div style={infoTitle}>처리 메모</div>
                    <div style={{ fontSize: '13px', color: '#555', lineHeight: 1.6 }}>{detail.adminNote}</div>
                  </div>
                )}

                {/* 수동 보정 */}
                {detail.status === 'MISSING_CHECKOUT' && !correcting && (
                  <button onClick={() => setCorrecting(true)} style={correctBtn}>
                    ✏️ 수동 보정 (퇴근 시각 입력)
                  </button>
                )}

                {correcting && (
                  <div style={{ ...infoSection, background: '#f3e5f5' }}>
                    <div style={infoTitle}>수동 보정</div>
                    <div style={infoRow}>
                      <span style={infoLabel}>퇴근 시각</span>
                      <input
                        type="time"
                        value={correctCheckOut}
                        onChange={(e) => setCorrectCheckOut(e.target.value)}
                        style={{ ...styles.filterInput, width: '140px' }}
                      />
                    </div>
                    <div style={{ ...infoRow, marginTop: '8px' }}>
                      <span style={infoLabel}>사유</span>
                      <input
                        type="text"
                        placeholder="보정 사유 (선택)"
                        value={correctNote}
                        onChange={(e) => setCorrectNote(e.target.value)}
                        style={{ ...styles.filterInput, flex: 1 }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                      <button
                        onClick={saveCorrection}
                        disabled={!correctCheckOut || correctSaving}
                        style={{ ...styles.searchBtn, opacity: !correctCheckOut || correctSaving ? 0.5 : 1 }}
                      >
                        {correctSaving ? '저장 중...' : '보정 저장'}
                      </button>
                      <button onClick={() => setCorrecting(false)} style={styles.exportBtn}>취소</button>
                    </div>
                    <div style={{ fontSize: '11px', color: '#888', marginTop: '8px' }}>
                      * 보정 이력은 감사 로그에 기록됩니다. 상태: ADJUSTED
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}

const modal: React.CSSProperties = {
  background: 'white', borderRadius: '16px', padding: '32px',
  width: '540px', maxWidth: '95vw', maxHeight: '85vh', overflowY: 'auto',
}

const modalHeader: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px',
}

const closeBtn: React.CSSProperties = {
  background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#999', padding: '0 4px',
}

const infoSection: React.CSSProperties = {
  background: '#f8f9fa', borderRadius: '10px', padding: '16px', marginBottom: '12px',
}

const infoTitle: React.CSSProperties = {
  fontSize: '11px', color: '#999', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px',
}

const infoRow: React.CSSProperties = {
  display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '6px',
}

const infoLabel: React.CSSProperties = {
  fontSize: '12px', color: '#888', width: '70px', flexShrink: 0,
}

const infoValue: React.CSSProperties = {
  fontSize: '13px', color: '#333', fontWeight: 500,
}

const correctBtn: React.CSSProperties = {
  width: '100%', padding: '14px', background: '#6a1b9a', color: 'white',
  border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: 600,
  marginBottom: '8px',
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
