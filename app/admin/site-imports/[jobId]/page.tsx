'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface ImportRow {
  id: string
  rowNumber: number
  siteName: string
  rawAddress: string
  normalizedAddress: string | null
  latitude: number | null
  longitude: number | null
  allowedRadiusMeters: number | null
  validationStatus: 'READY' | 'NEEDS_REVIEW' | 'FAILED' | 'APPROVED' | 'IMPORTED'
  validationMessage: string | null
  approvedBy: string | null
  approvedAt: string | null
  importedSiteId: string | null
}

interface ImportJob {
  id: string
  originalFilename: string
  status: string
  totalRows: number
  readyRows: number
  failedRows: number
  approvedRows: number
  importedRows: number
  uploadedBy: string
  createdAt: string
  rows: ImportRow[]
}

const STATUS_LABEL: Record<string, string> = {
  READY: 'READY', NEEDS_REVIEW: '검수필요', FAILED: '실패', APPROVED: '승인', IMPORTED: '등록완료',
}
const STATUS_COLOR: Record<string, string> = {
  READY: '#2e7d32', NEEDS_REVIEW: '#e65100', FAILED: '#b71c1c', APPROVED: '#1565c0', IMPORTED: '#4a148c',
}
const STATUS_BG: Record<string, string> = {
  READY: '#e8f5e9', NEEDS_REVIEW: '#fff3e0', FAILED: '#ffebee', APPROVED: '#e3f2fd', IMPORTED: '#f3e5f5',
}

type FilterStatus = 'ALL' | 'READY' | 'NEEDS_REVIEW' | 'FAILED' | 'APPROVED' | 'IMPORTED'

export default function SiteImportReviewPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = use(params)
  const router = useRouter()
  const [job, setJob]           = useState<ImportJob | null>(null)
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState<FilterStatus>('ALL')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm]   = useState<Partial<ImportRow>>({})
  const [saving, setSaving]       = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ importedCount: number; errors: string[] } | null>(null)

  const load = () => {
    setLoading(true)
    fetch(`/api/admin/site-imports/${jobId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) { router.push('/admin/login'); return }
        setJob(data.data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(load, [jobId, router]) // eslint-disable-line

  const patchRow = async (rowId: string, body: Record<string, unknown>) => {
    setSaving(true)
    const res = await fetch(`/api/admin/site-imports/${jobId}/rows/${rowId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    if (res.ok) {
      load()
      setEditingId(null)
    } else {
      const data = await res.json()
      alert(data.error ?? '저장 실패')
    }
  }

  const toggleApprove = (row: ImportRow) => {
    if (row.importedSiteId) return
    const newStatus = row.validationStatus === 'APPROVED' ? 'READY' : 'APPROVED'
    patchRow(row.id, { validationStatus: newStatus })
  }

  const approveAllReady = () => {
    if (!job) return
    const readyRows = job.rows.filter((r) => r.validationStatus === 'READY')
    if (readyRows.length === 0) { alert('승인 가능한 READY 행이 없습니다.'); return }
    if (!confirm(`READY 상태 ${readyRows.length}개 행을 모두 승인하시겠습니까?`)) return
    Promise.all(readyRows.map((r) => patchRow(r.id, { validationStatus: 'APPROVED' }))).then(load)
  }

  const handleImport = async () => {
    if (!job) return
    const count = job.rows.filter((r) => r.validationStatus === 'APPROVED').length
    if (count === 0) { alert('승인된 행이 없습니다.'); return }
    if (!confirm(`승인된 ${count}개 행을 실제 현장으로 등록하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return
    setImporting(true)
    setImportResult(null)
    const res = await fetch(`/api/admin/site-imports/${jobId}/import`, { method: 'POST' })
    const data = await res.json()
    setImporting(false)
    if (data.success) {
      setImportResult(data.data)
      load()
    } else {
      alert(data.error ?? '등록 실패')
    }
  }

  const startEdit = (row: ImportRow) => {
    setEditingId(row.id)
    setEditForm({
      siteName: row.siteName,
      normalizedAddress: row.normalizedAddress ?? '',
      latitude: row.latitude ?? undefined,
      longitude: row.longitude ?? undefined,
      allowedRadiusMeters: row.allowedRadiusMeters ?? 100,
    })
  }

  const saveEdit = () => {
    if (!editingId) return
    const body: Record<string, unknown> = { ...editForm }
    // 수정 후 좌표가 있으면 NEEDS_REVIEW → READY 로 격상 시도
    if (body.latitude && body.longitude) {
      const row = job?.rows.find((r) => r.id === editingId)
      if (row && row.validationStatus === 'NEEDS_REVIEW') body.validationStatus = 'READY'
      if (row && row.validationStatus === 'FAILED') body.validationStatus = 'NEEDS_REVIEW'
    }
    patchRow(editingId, body)
  }

  if (loading) return <div style={{ padding: '60px', textAlign: 'center', color: '#888' }}>로딩 중...</div>
  if (!job) return <div style={{ padding: '60px', textAlign: 'center', color: '#888' }}>작업을 찾을 수 없습니다.</div>

  const filteredRows = filter === 'ALL' ? job.rows : job.rows.filter((r) => r.validationStatus === filter)
  const approvedCount = job.rows.filter((r) => r.validationStatus === 'APPROVED').length

  return (
    <div style={styles.layout}>
      <nav style={styles.sidebar}>
        <div style={styles.sidebarTitle}>해한 출퇴근</div>
        {[
          ['/admin', '대시보드'], ['/admin/workers', '근로자 관리'], ['/admin/companies', '회사 관리'],
          ['/admin/sites', '현장 관리'], ['/admin/attendance', '출퇴근 조회'],
          ['/admin/presence-checks', '체류확인 현황'], ['/admin/labor', '투입현황/노임서류'],
          ['/admin/exceptions', '예외 승인'], ['/admin/device-requests', '기기 변경'],
          ['/admin/audit-logs', '감사 로그'], ['/admin/site-imports', '현장 엑셀 업로드'],
        ].map(([href, label]) => (
          <Link key={href} href={href} style={{ ...styles.navItem, ...(href === '/admin/site-imports' ? styles.navActive : {}) }}>
            {label}
          </Link>
        ))}
      </nav>

      <main style={styles.main}>
        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap' as const, gap: '12px' }}>
          <div>
            <Link href="/admin/site-imports" style={{ fontSize: '13px', color: '#888', textDecoration: 'none' }}>← 목록으로</Link>
            <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '4px 0 2px' }}>{job.originalFilename}</h1>
            <div style={{ fontSize: '12px', color: '#999' }}>
              업로드: {new Date(job.createdAt).toLocaleString('ko-KR')} · 전체 {job.totalRows}행
            </div>
          </div>

          {/* 액션 버튼 */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' as const }}>
            <button onClick={approveAllReady} style={styles.approveAllBtn}>
              READY 전체 승인 ({job.readyRows})
            </button>
            <button
              onClick={handleImport}
              disabled={importing || approvedCount === 0}
              style={{ ...styles.importBtn, opacity: importing || approvedCount === 0 ? 0.5 : 1 }}
            >
              {importing ? '등록 중...' : `승인된 현장 등록 (${approvedCount}건)`}
            </button>
          </div>
        </div>

        {/* 통계 바 */}
        <div style={styles.statsRow}>
          {[
            { label: 'READY', count: job.readyRows, color: '#2e7d32', bg: '#e8f5e9' },
            { label: '검수필요+실패', count: job.failedRows, color: '#e65100', bg: '#fff3e0' },
            { label: '승인', count: job.approvedRows, color: '#1565c0', bg: '#e3f2fd' },
            { label: '등록완료', count: job.importedRows, color: '#4a148c', bg: '#f3e5f5' },
          ].map((s) => (
            <div key={s.label} style={{ ...styles.statBox, background: s.bg }}>
              <div style={{ fontSize: '22px', fontWeight: 700, color: s.color }}>{s.count}</div>
              <div style={{ fontSize: '11px', color: s.color }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* 등록 결과 */}
        {importResult && (
          <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: '10px', padding: '14px 18px', marginBottom: '16px' }}>
            <div style={{ fontWeight: 700, color: '#2e7d32', marginBottom: '4px' }}>✅ {importResult.importedCount}개 현장 등록 완료</div>
            {importResult.errors.length > 0 && (
              <div style={{ fontSize: '12px', color: '#b71c1c', marginTop: '6px' }}>
                오류 {importResult.errors.length}건:<br />
                {importResult.errors.map((e, i) => <span key={i}>{e}<br /></span>)}
              </div>
            )}
          </div>
        )}

        {/* 필터 탭 */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' as const }}>
          {(['ALL', 'READY', 'NEEDS_REVIEW', 'FAILED', 'APPROVED', 'IMPORTED'] as FilterStatus[]).map((s) => {
            const count = s === 'ALL' ? job.rows.length : job.rows.filter((r) => r.validationStatus === s).length
            return (
              <button
                key={s}
                onClick={() => setFilter(s)}
                style={{
                  padding: '6px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                  background: filter === s ? (STATUS_BG[s] ?? '#1976d2') : '#f0f0f0',
                  color: filter === s ? (STATUS_COLOR[s] ?? '#1976d2') : '#666',
                }}
              >
                {s === 'ALL' ? '전체' : STATUS_LABEL[s]} ({count})
              </button>
            )
          })}
        </div>

        {/* 테이블 */}
        <div style={{ ...styles.tableCard, overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead>
              <tr>
                {['행', '현장명', '원본 주소', '정제 주소', '위도', '경도', '반경(m)', '상태', '메시지', '수정', '승인'].map((h) => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr><td colSpan={11} style={{ textAlign: 'center', padding: '32px', color: '#999' }}>해당 상태의 행이 없습니다.</td></tr>
              ) : filteredRows.map((row) => (
                <>
                  <tr key={row.id} style={{ background: editingId === row.id ? '#f0f7ff' : 'white' }}>
                    <td style={{ ...styles.td, textAlign: 'center' as const, color: '#888', fontSize: '11px' }}>{row.rowNumber}</td>
                    <td style={styles.td}><span style={{ fontWeight: 600, color: '#1a1a2e' }}>{row.siteName}</span></td>
                    <td style={{ ...styles.td, maxWidth: '160px', fontSize: '11px', color: '#888' }}>{row.rawAddress}</td>
                    <td style={{ ...styles.td, maxWidth: '200px', fontSize: '11px', color: '#555' }}>
                      {row.normalizedAddress ?? <span style={{ color: '#ccc' }}>-</span>}
                    </td>
                    <td style={{ ...styles.td, fontSize: '11px', fontFamily: 'monospace' }}>
                      {row.latitude != null ? row.latitude.toFixed(5) : <span style={{ color: '#e65100' }}>없음</span>}
                    </td>
                    <td style={{ ...styles.td, fontSize: '11px', fontFamily: 'monospace' }}>
                      {row.longitude != null ? row.longitude.toFixed(5) : <span style={{ color: '#e65100' }}>없음</span>}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'center' as const }}>
                      {row.allowedRadiusMeters ?? <span style={{ color: '#e65100' }}>-</span>}
                    </td>
                    <td style={styles.td}>
                      <span style={{
                        fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px',
                        color: STATUS_COLOR[row.validationStatus], background: STATUS_BG[row.validationStatus],
                      }}>
                        {STATUS_LABEL[row.validationStatus]}
                      </span>
                    </td>
                    <td style={{ ...styles.td, maxWidth: '160px', fontSize: '11px', color: '#e65100' }}>
                      {row.validationMessage ?? ''}
                    </td>
                    <td style={styles.td}>
                      {!row.importedSiteId && (
                        <button onClick={() => editingId === row.id ? setEditingId(null) : startEdit(row)} style={styles.editBtn}>
                          {editingId === row.id ? '닫기' : '수정'}
                        </button>
                      )}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'center' as const }}>
                      {row.importedSiteId ? (
                        <span style={{ fontSize: '11px', color: '#4a148c' }}>등록됨</span>
                      ) : (
                        <input
                          type="checkbox"
                          checked={row.validationStatus === 'APPROVED'}
                          onChange={() => toggleApprove(row)}
                          disabled={saving || row.validationStatus === 'FAILED'}
                          style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                        />
                      )}
                    </td>
                  </tr>

                  {/* 인라인 수정 폼 */}
                  {editingId === row.id && (
                    <tr key={`${row.id}-edit`} style={{ background: '#f0f7ff' }}>
                      <td colSpan={11} style={{ padding: '16px 20px', borderBottom: '2px solid #bbdefb' }}>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' as const, alignItems: 'flex-end' }}>
                          <div>
                            <div style={editLabel}>현장명</div>
                            <input
                              value={editForm.siteName ?? ''}
                              onChange={(e) => setEditForm((f) => ({ ...f, siteName: e.target.value }))}
                              style={editInput}
                              placeholder="현장명"
                            />
                          </div>
                          <div>
                            <div style={editLabel}>정제 주소</div>
                            <input
                              value={editForm.normalizedAddress ?? ''}
                              onChange={(e) => setEditForm((f) => ({ ...f, normalizedAddress: e.target.value }))}
                              style={{ ...editInput, width: '240px' }}
                              placeholder="주소"
                            />
                          </div>
                          <div>
                            <div style={editLabel}>위도</div>
                            <input
                              type="number"
                              step="0.00001"
                              value={editForm.latitude ?? ''}
                              onChange={(e) => setEditForm((f) => ({ ...f, latitude: parseFloat(e.target.value) || undefined }))}
                              style={{ ...editInput, width: '110px' }}
                              placeholder="37.12345"
                            />
                          </div>
                          <div>
                            <div style={editLabel}>경도</div>
                            <input
                              type="number"
                              step="0.00001"
                              value={editForm.longitude ?? ''}
                              onChange={(e) => setEditForm((f) => ({ ...f, longitude: parseFloat(e.target.value) || undefined }))}
                              style={{ ...editInput, width: '110px' }}
                              placeholder="126.12345"
                            />
                          </div>
                          <div>
                            <div style={editLabel}>허용반경(m)</div>
                            <input
                              type="number"
                              min={10}
                              max={5000}
                              value={editForm.allowedRadiusMeters ?? ''}
                              onChange={(e) => setEditForm((f) => ({ ...f, allowedRadiusMeters: parseInt(e.target.value) || undefined }))}
                              style={{ ...editInput, width: '80px' }}
                              placeholder="100"
                            />
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={saveEdit} disabled={saving} style={{ ...styles.importBtn, padding: '8px 16px', fontSize: '13px' }}>
                              {saving ? '저장 중...' : '저장'}
                            </button>
                            <button onClick={() => setEditingId(null)} style={styles.editBtn}>취소</button>
                          </div>
                        </div>
                        <div style={{ marginTop: '8px', fontSize: '11px', color: '#888' }}>
                          * 좌표 수정 후 저장하면 NEEDS_REVIEW → READY로 자동 격상됩니다.
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}

const editLabel: React.CSSProperties = { fontSize: '11px', color: '#888', marginBottom: '4px' }
const editInput: React.CSSProperties = { padding: '7px 10px', border: '1px solid #90caf9', borderRadius: '6px', fontSize: '13px', width: '160px' }

const styles: Record<string, React.CSSProperties> = {
  layout:      { display: 'flex', minHeight: '100vh', background: '#f5f5f5' },
  sidebar:     { width: '220px', background: '#1a1a2e', padding: '24px 0', flexShrink: 0 },
  sidebarTitle:{ color: 'white', fontSize: '16px', fontWeight: 700, padding: '0 20px 24px' },
  navItem:     { display: 'block', color: 'rgba(255,255,255,0.8)', padding: '10px 20px', fontSize: '14px', textDecoration: 'none' },
  navActive:   { color: 'white', background: 'rgba(255,255,255,0.1)', fontWeight: 700 },
  main:        { flex: 1, padding: '32px', minWidth: 0 },
  statsRow:    { display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' as const },
  statBox:     { borderRadius: '10px', padding: '14px 20px', textAlign: 'center' as const, minWidth: '80px' },
  approveAllBtn:{ padding: '8px 18px', background: '#e8f5e9', color: '#2e7d32', border: '1px solid #a5d6a7', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 },
  importBtn:   { padding: '8px 20px', background: '#1976d2', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 },
  tableCard:   { background: 'white', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  table:       { width: '100%', borderCollapse: 'collapse' as const },
  th:          { textAlign: 'left' as const, padding: '10px 12px', fontSize: '11px', color: '#888', borderBottom: '2px solid #f0f0f0', background: '#fafafa', whiteSpace: 'nowrap' as const },
  td:          { padding: '10px 12px', fontSize: '13px', borderBottom: '1px solid #f5f5f5', verticalAlign: 'top' as const },
  editBtn:     { padding: '4px 12px', background: '#f5f5f5', border: '1px solid #e0e0e0', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#555' },
}
