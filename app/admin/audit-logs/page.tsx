'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface AuditLog {
  id: string
  actorUserId: string | null
  actorType: string
  actionType: string
  targetType: string | null
  targetId: string | null
  summary: string
  metadataJson: Record<string, unknown> | null
  ipAddress: string | null
  createdAt: string
}

const ACTOR_TYPE_COLOR: Record<string, string> = {
  ADMIN: '#1565c0', WORKER: '#2e7d32', SYSTEM: '#888',
}
const ACTOR_TYPE_BG: Record<string, string> = {
  ADMIN: '#e3f2fd', WORKER: '#e8f5e9', SYSTEM: '#f5f5f5',
}

const ACTION_TYPE_OPTIONS = [
  { value: '', label: '전체' },
  { value: 'ADMIN_LOGIN', label: 'ADMIN_LOGIN — 관리자 로그인' },
  { value: 'REGISTER_WORKER', label: 'REGISTER_WORKER — 근로자 등록' },
  { value: 'UPDATE_WORKER', label: 'UPDATE_WORKER — 근로자 수정' },
  { value: 'DEACTIVATE_WORKER', label: 'DEACTIVATE_WORKER — 근로자 비활성화' },
  { value: 'WORKER_COMPANY_ASSIGN', label: 'WORKER_COMPANY_ASSIGN — 근로자 회사배정' },
  { value: 'WORKER_SITE_ASSIGN', label: 'WORKER_SITE_ASSIGN — 근로자 현장배정' },
  { value: 'WORKER_INSURANCE_UPDATE', label: 'WORKER_INSURANCE_UPDATE — 보험 상태' },
  { value: 'COMPANY_CREATE', label: 'COMPANY_CREATE — 회사 등록' },
  { value: 'COMPANY_UPDATE', label: 'COMPANY_UPDATE — 회사 수정' },
  { value: 'CREATE_SITE', label: 'CREATE_SITE — 현장 등록' },
  { value: 'UPDATE_SITE', label: 'UPDATE_SITE — 현장 수정' },
  { value: 'SITE_COMPANY_ASSIGN', label: 'SITE_COMPANY_ASSIGN — 현장 회사배정' },
  { value: 'ATTENDANCE_CHECK_IN_DIRECT', label: 'ATTENDANCE_CHECK_IN_DIRECT — 직접 출근' },
  { value: 'ATTENDANCE_CHECK_OUT_DIRECT', label: 'ATTENDANCE_CHECK_OUT_DIRECT — 직접 퇴근' },
  { value: 'ATTENDANCE_EXCEPTION_CHECK_OUT', label: 'ATTENDANCE_EXCEPTION_CHECK_OUT — 예외 퇴근' },
  { value: 'ADJUST_ATTENDANCE', label: 'ADJUST_ATTENDANCE — 출퇴근 보정' },
  { value: 'APPROVE_DEVICE_CHANGE', label: 'APPROVE_DEVICE_CHANGE — 기기변경 승인' },
  { value: 'REJECT_DEVICE_CHANGE', label: 'REJECT_DEVICE_CHANGE — 기기변경 거절' },
  { value: 'APPROVE_EXCEPTION', label: 'APPROVE_EXCEPTION — 예외승인' },
  { value: 'REJECT_EXCEPTION', label: 'REJECT_EXCEPTION — 예외거절' },
]

const TARGET_TYPE_OPTIONS = [
  { value: '', label: '전체' },
  { value: 'Worker', label: 'Worker' },
  { value: 'Company', label: 'Company' },
  { value: 'Site', label: 'Site' },
  { value: 'AttendanceLog', label: 'AttendanceLog' },
  { value: 'Device', label: 'Device' },
  { value: 'ExceptionRequest', label: 'ExceptionRequest' },
]

export default function AuditLogsPage() {
  const router = useRouter()
  const today = new Date().toISOString().slice(0, 10)
  const [dateFrom, setDateFrom]       = useState(today)
  const [dateTo, setDateTo]           = useState(today)
  const [actionType, setActionType]   = useState('')
  const [actorUserId, setActorUserId] = useState('')
  const [targetType, setTargetType]   = useState('')
  const [items, setItems]             = useState<AuditLog[]>([])
  const [total, setTotal]             = useState(0)
  const [page, setPage]               = useState(1)
  const [loading, setLoading]         = useState(false)
  const [expanded, setExpanded]       = useState<string | null>(null)

  const pageSize = 50

  const load = (pg = 1) => {
    setLoading(true)
    setPage(pg)
    const params = new URLSearchParams({ dateFrom, dateTo, pageSize: String(pageSize), page: String(pg) })
    if (actionType) params.set('actionType', actionType)
    if (actorUserId.trim()) params.set('actorUserId', actorUserId.trim())
    if (targetType) params.set('targetType', targetType)
    fetch(`/api/admin/audit-logs?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) { router.push('/admin/login'); return }
        setItems(data.data.items)
        setTotal(data.data.total)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [router]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = Math.ceil(total / pageSize)

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString('ko-KR', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    })

  const shortId = (id: string | null) => id ? id.slice(-8) : '-'

  return (
    <div style={styles.layout}>
      <nav style={styles.sidebar}>
        <div style={styles.sidebarTitle}>해한 출퇴근</div>
        {[
          ['/admin', '대시보드'],
          ['/admin/workers', '근로자 관리'],
          ['/admin/companies', '회사 관리'],
          ['/admin/sites', '현장 관리'],
          ['/admin/attendance', '출퇴근 조회'],
          ['/admin/presence-checks', '체류확인 현황'],
          ['/admin/labor', '투입현황/노임서류'],
          ['/admin/exceptions', '예외 승인'],
          ['/admin/device-requests', '기기 변경'],
          ['/admin/audit-logs', '감사 로그'],
        ].map(([href, label]) => (
          <Link key={href} href={href} style={{ ...styles.navItem, ...(href === '/admin/audit-logs' ? styles.navActive : {}) }}>
            {label}
          </Link>
        ))}
      </nav>

      <main style={styles.main}>
        <h1 style={styles.pageTitle}>감사 로그</h1>
        <p style={{ fontSize: '13px', color: '#888', marginBottom: '20px', marginTop: '-12px' }}>
          시스템 내 모든 주요 이벤트 기록 (출퇴근·기기·회사·현장·근로자·보험)
        </p>

        {/* 필터 */}
        <div style={styles.filterBox}>
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
              <label style={styles.filterLabel}>액션 유형</label>
              <select value={actionType} onChange={(e) => setActionType(e.target.value)} style={{ ...styles.filterInput, minWidth: '240px' }}>
                {ACTION_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>대상 유형</label>
              <select value={targetType} onChange={(e) => setTargetType(e.target.value)} style={styles.filterInput}>
                {TARGET_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>행위자 ID</label>
              <input
                type="text"
                placeholder="actorUserId"
                value={actorUserId}
                onChange={(e) => setActorUserId(e.target.value)}
                style={{ ...styles.filterInput, width: '160px' }}
              />
            </div>
            <button onClick={() => load(1)} style={styles.searchBtn}>조회</button>
          </div>
        </div>

        <div style={{ fontSize: '13px', color: '#888', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>총 {total.toLocaleString()}건 · {page}/{totalPages || 1} 페이지</span>
          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => load(page - 1)} disabled={page <= 1} style={styles.pageBtn}>← 이전</button>
              <button onClick={() => load(page + 1)} disabled={page >= totalPages} style={styles.pageBtn}>다음 →</button>
            </div>
          )}
        </div>

        {loading ? <p style={{ color: '#888' }}>로딩 중...</p> : (
          <div style={{ ...styles.tableCard, overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {['시각', '행위자', '유형', '액션', '대상', '내용'].map((h) => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#999' }}>로그가 없습니다.</td></tr>
                ) : items.map((item) => (
                  <>
                    <tr
                      key={item.id}
                      style={{ ...styles.tr, cursor: 'pointer', background: expanded === item.id ? '#fafafa' : 'white' }}
                      onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                    >
                      <td style={styles.td}>
                        <span style={{ fontSize: '12px', color: '#555', whiteSpace: 'nowrap' as const }}>{formatDateTime(item.createdAt)}</span>
                      </td>
                      <td style={styles.td}>
                        <div>
                          <span style={{
                            fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '8px',
                            color: ACTOR_TYPE_COLOR[item.actorType] ?? '#555',
                            background: ACTOR_TYPE_BG[item.actorType] ?? '#f5f5f5',
                          }}>
                            {item.actorType}
                          </span>
                          {item.actorUserId && (
                            <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                              {shortId(item.actorUserId)}
                            </div>
                          )}
                        </div>
                      </td>
                      <td style={styles.td}>
                        {item.targetType && (
                          <span style={{ fontSize: '11px', color: '#666', background: '#f0f0f0', padding: '2px 6px', borderRadius: '6px' }}>
                            {item.targetType}
                          </span>
                        )}
                      </td>
                      <td style={styles.td}>
                        <ActionTypeBadge actionType={item.actionType} />
                      </td>
                      <td style={styles.td}>
                        {item.targetId && (
                          <span style={{ fontSize: '11px', color: '#999', fontFamily: 'monospace' }}>{shortId(item.targetId)}</span>
                        )}
                      </td>
                      <td style={{ ...styles.td, maxWidth: '320px' }}>
                        <span style={{ fontSize: '13px', color: '#333' }}>{item.summary}</span>
                      </td>
                    </tr>
                    {expanded === item.id && (
                      <tr key={`${item.id}-detail`} style={{ background: '#fafafa' }}>
                        <td colSpan={6} style={{ padding: '12px 16px', borderBottom: '2px solid #e3f2fd' }}>
                          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' as const }}>
                            <div>
                              <div style={detailLabel}>전체 ID</div>
                              <div style={detailValue}>{item.id}</div>
                            </div>
                            {item.actorUserId && (
                              <div>
                                <div style={detailLabel}>행위자 ID</div>
                                <div style={detailValue}>{item.actorUserId}</div>
                              </div>
                            )}
                            {item.targetId && (
                              <div>
                                <div style={detailLabel}>대상 ID</div>
                                <div style={detailValue}>{item.targetId}</div>
                              </div>
                            )}
                            {item.ipAddress && (
                              <div>
                                <div style={detailLabel}>IP</div>
                                <div style={detailValue}>{item.ipAddress}</div>
                              </div>
                            )}
                            {item.metadataJson && (
                              <div>
                                <div style={detailLabel}>메타데이터</div>
                                <pre style={{ fontSize: '11px', color: '#555', margin: 0, background: '#f5f5f5', padding: '6px 10px', borderRadius: '6px', maxWidth: '400px', overflowX: 'auto' as const }}>
                                  {JSON.stringify(item.metadataJson, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 페이지네이션 하단 */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
            <button onClick={() => load(1)} disabled={page <= 1} style={styles.pageBtn}>처음</button>
            <button onClick={() => load(page - 1)} disabled={page <= 1} style={styles.pageBtn}>← 이전</button>
            <span style={{ fontSize: '13px', color: '#555', padding: '6px 12px' }}>{page} / {totalPages}</span>
            <button onClick={() => load(page + 1)} disabled={page >= totalPages} style={styles.pageBtn}>다음 →</button>
            <button onClick={() => load(totalPages)} disabled={page >= totalPages} style={styles.pageBtn}>마지막</button>
          </div>
        )}
      </main>
    </div>
  )
}

/* ── ActionType 배지 ────────────────────────────────────── */
function ActionTypeBadge({ actionType }: { actionType: string }) {
  let color = '#555'
  let bg = '#f5f5f5'

  if (actionType.startsWith('ATTENDANCE')) { color = '#1565c0'; bg = '#e3f2fd' }
  else if (actionType.includes('APPROVE')) { color = '#2e7d32'; bg = '#e8f5e9' }
  else if (actionType.includes('REJECT'))  { color = '#b71c1c'; bg = '#ffebee' }
  else if (actionType.includes('CREATE') || actionType.includes('REGISTER')) { color = '#4a148c'; bg = '#f3e5f5' }
  else if (actionType.includes('UPDATE') || actionType.includes('ADJUST'))   { color = '#e65100'; bg = '#fff3e0' }
  else if (actionType.includes('DEACTIVATE') || actionType.includes('DELETE')) { color = '#b71c1c'; bg = '#ffebee' }
  else if (actionType.includes('ASSIGN'))  { color = '#00695c'; bg = '#e0f2f1' }
  else if (actionType === 'ADMIN_LOGIN')   { color = '#1565c0'; bg = '#e3f2fd' }

  return (
    <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', color, background: bg, whiteSpace: 'nowrap' as const }}>
      {actionType}
    </span>
  )
}

/* ── 스타일 ─────────────────────────────────────────────── */
const detailLabel: React.CSSProperties = { fontSize: '10px', color: '#aaa', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }
const detailValue: React.CSSProperties = { fontSize: '12px', color: '#333', fontFamily: 'monospace' }

const styles: Record<string, React.CSSProperties> = {
  layout:      { display: 'flex', minHeight: '100vh', background: '#f5f5f5' },
  sidebar:     { width: '220px', background: '#1a1a2e', padding: '24px 0', flexShrink: 0 },
  sidebarTitle:{ color: 'white', fontSize: '16px', fontWeight: 700, padding: '0 20px 24px' },
  navItem:     { display: 'block', color: 'rgba(255,255,255,0.8)', padding: '10px 20px', fontSize: '14px', textDecoration: 'none' },
  navActive:   { color: 'white', background: 'rgba(255,255,255,0.1)', fontWeight: 700 },
  main:        { flex: 1, padding: '32px', minWidth: 0 },
  pageTitle:   { fontSize: '22px', fontWeight: 700, margin: '0 0 4px' },
  filterBox:   { background: 'white', borderRadius: '10px', padding: '20px', marginBottom: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  filterRow:   { display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' as const },
  filterGroup: { display: 'flex', flexDirection: 'column' as const, gap: '4px' },
  filterLabel: { fontSize: '12px', color: '#888' },
  filterInput: { padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '13px' },
  searchBtn:   { padding: '8px 20px', background: '#1976d2', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' },
  tableCard:   { background: 'white', borderRadius: '10px', padding: '0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' },
  table:       { width: '100%', borderCollapse: 'collapse' as const },
  th:          { textAlign: 'left' as const, padding: '12px 14px', fontSize: '11px', color: '#888', borderBottom: '2px solid #f0f0f0', whiteSpace: 'nowrap' as const, background: '#fafafa' },
  td:          { padding: '10px 14px', fontSize: '13px', borderBottom: '1px solid #f5f5f5', verticalAlign: 'top' as const },
  tr:          {},
  pageBtn:     { padding: '6px 14px', background: '#f5f5f5', border: '1px solid #e0e0e0', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: '#555' },
}
