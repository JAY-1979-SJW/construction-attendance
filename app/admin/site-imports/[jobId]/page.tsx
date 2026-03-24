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

  if (loading) return <div className="px-16 py-16 text-center text-muted-brand">로딩 중...</div>
  if (!job) return <div className="px-16 py-16 text-center text-muted-brand">작업을 찾을 수 없습니다.</div>

  const filteredRows = filter === 'ALL' ? job.rows : job.rows.filter((r) => r.validationStatus === filter)
  const approvedCount = job.rows.filter((r) => r.validationStatus === 'APPROVED').length

  return (
    <div className="p-8 min-w-0">
        {/* 헤더 */}
        <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
          <div>
            <Link href="/admin/site-imports" className="text-[13px] text-muted-brand no-underline">← 목록으로</Link>
            <h1 className="text-xl font-bold my-1">{job.originalFilename}</h1>
            <div className="text-xs text-[#999]">
              업로드: {new Date(job.createdAt).toLocaleString('ko-KR')} · 전체 {job.totalRows}행
            </div>
          </div>

          {/* 액션 버튼 */}
          <div className="flex gap-2.5 items-center flex-wrap">
            <button onClick={approveAllReady} className="px-4 py-2 bg-[#e8f5e9] text-[#2e7d32] border border-[#a5d6a7] rounded-lg cursor-pointer text-[13px] font-semibold">
              READY 전체 승인 ({job.readyRows})
            </button>
            <button
              onClick={handleImport}
              disabled={importing || approvedCount === 0}
              className="px-5 py-2 bg-[#F47920] text-white border-0 rounded-lg cursor-pointer text-[13px] font-semibold"
              style={{ opacity: importing || approvedCount === 0 ? 0.5 : 1 }}
            >
              {importing ? '등록 중...' : `승인된 현장 등록 (${approvedCount}건)`}
            </button>
          </div>
        </div>

        {/* 통계 바 */}
        <div className="flex gap-3 mb-5 flex-wrap">
          {[
            { label: 'READY', count: job.readyRows, color: '#2e7d32', bg: '#e8f5e9' },
            { label: '검수필요+실패', count: job.failedRows, color: '#e65100', bg: '#fff3e0' },
            { label: '승인', count: job.approvedRows, color: '#4A93C8', bg: '#e3f2fd' },
            { label: '등록완료', count: job.importedRows, color: '#4a148c', bg: '#f3e5f5' },
          ].map((s) => (
            <div key={s.label} className="rounded-[10px] px-5 py-3.5 text-center min-w-[80px]" style={{ background: s.bg }}>
              <div className="text-[22px] font-bold" style={{ color: s.color }}>{s.count}</div>
              <div className="text-[11px]" style={{ color: s.color }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* 등록 결과 */}
        {importResult && (
          <div className="bg-[#e8f5e9] border border-[#a5d6a7] rounded-[10px] px-4 py-3.5 mb-4">
            <div className="font-bold text-[#2e7d32] mb-1">✅ {importResult.importedCount}개 현장 등록 완료</div>
            {importResult.errors.length > 0 && (
              <div className="text-xs text-[#b71c1c] mt-1.5">
                오류 {importResult.errors.length}건:<br />
                {importResult.errors.map((e, i) => <span key={i}>{e}<br /></span>)}
              </div>
            )}
          </div>
        )}

        {/* 필터 탭 */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {(['ALL', 'READY', 'NEEDS_REVIEW', 'FAILED', 'APPROVED', 'IMPORTED'] as FilterStatus[]).map((s) => {
            const count = s === 'ALL' ? job.rows.length : job.rows.filter((r) => r.validationStatus === s).length
            return (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className="px-3.5 py-1.5 rounded-full border-0 cursor-pointer text-xs font-semibold"
                style={{
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
        <div className="bg-card rounded-[10px] overflow-x-auto shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {['행', '현장명', '원본 주소', '정제 주소', '위도', '경도', '반경(m)', '상태', '메시지', '수정', '승인'].map((h) => (
                  <th key={h} className="text-left px-3 py-2.5 text-[11px] text-muted-brand border-b-2 border-[rgba(91,164,217,0.2)] bg-[#fafafa] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr><td colSpan={11} className="text-center py-8 text-[#999]">해당 상태의 행이 없습니다.</td></tr>
              ) : filteredRows.map((row) => (
                <>
                  <tr key={row.id} style={{ background: editingId === row.id ? '#f0f7ff' : 'white' }}>
                    <td className="px-3 py-2.5 text-[13px] border-b border-[rgba(91,164,217,0.1)] align-top text-center text-muted-brand text-[11px]">{row.rowNumber}</td>
                    <td className="px-3 py-2.5 text-[13px] border-b border-[rgba(91,164,217,0.1)] align-top"><span className="font-semibold text-white">{row.siteName}</span></td>
                    <td className="px-3 py-2.5 text-[13px] border-b border-[rgba(91,164,217,0.1)] align-top max-w-[160px] text-[11px] text-muted-brand">{row.rawAddress}</td>
                    <td className="px-3 py-2.5 text-[13px] border-b border-[rgba(91,164,217,0.1)] align-top max-w-[200px] text-[11px] text-muted-brand">
                      {row.normalizedAddress ?? <span className="text-[#ccc]">-</span>}
                    </td>
                    <td className="px-3 py-2.5 text-[13px] border-b border-[rgba(91,164,217,0.1)] align-top text-[11px] font-mono">
                      {row.latitude != null ? row.latitude.toFixed(5) : <span className="text-[#e65100]">없음</span>}
                    </td>
                    <td className="px-3 py-2.5 text-[13px] border-b border-[rgba(91,164,217,0.1)] align-top text-[11px] font-mono">
                      {row.longitude != null ? row.longitude.toFixed(5) : <span className="text-[#e65100]">없음</span>}
                    </td>
                    <td className="px-3 py-2.5 text-[13px] border-b border-[rgba(91,164,217,0.1)] align-top text-center">
                      {row.allowedRadiusMeters ?? <span className="text-[#e65100]">-</span>}
                    </td>
                    <td className="px-3 py-2.5 text-[13px] border-b border-[rgba(91,164,217,0.1)] align-top">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-[10px]"
                        style={{ color: STATUS_COLOR[row.validationStatus], background: STATUS_BG[row.validationStatus] }}>
                        {STATUS_LABEL[row.validationStatus]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[13px] border-b border-[rgba(91,164,217,0.1)] align-top max-w-[160px] text-[11px] text-[#e65100]">
                      {row.validationMessage ?? ''}
                    </td>
                    <td className="px-3 py-2.5 text-[13px] border-b border-[rgba(91,164,217,0.1)] align-top">
                      {!row.importedSiteId && (
                        <button onClick={() => editingId === row.id ? setEditingId(null) : startEdit(row)}
                          className="px-3 py-1 bg-brand border border-[rgba(91,164,217,0.2)] rounded-md cursor-pointer text-xs text-muted-brand">
                          {editingId === row.id ? '닫기' : '수정'}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-[13px] border-b border-[rgba(91,164,217,0.1)] align-top text-center">
                      {row.importedSiteId ? (
                        <span className="text-[11px] text-[#4a148c]">등록됨</span>
                      ) : (
                        <input
                          type="checkbox"
                          checked={row.validationStatus === 'APPROVED'}
                          onChange={() => toggleApprove(row)}
                          disabled={saving || row.validationStatus === 'FAILED'}
                          className="cursor-pointer w-4 h-4"
                        />
                      )}
                    </td>
                  </tr>

                  {/* 인라인 수정 폼 */}
                  {editingId === row.id && (
                    <tr key={`${row.id}-edit`} className="bg-[#f0f7ff]">
                      <td colSpan={11} className="px-5 py-4 border-b-2 border-[#bbdefb]">
                        <div className="flex gap-3 flex-wrap items-end">
                          <div>
                            <div className="text-[11px] text-muted-brand mb-1">현장명</div>
                            <input
                              value={editForm.siteName ?? ''}
                              onChange={(e) => setEditForm((f) => ({ ...f, siteName: e.target.value }))}
                              className="px-2.5 py-1.5 border border-[#90caf9] rounded-md text-[13px] w-40"
                              placeholder="현장명"
                            />
                          </div>
                          <div>
                            <div className="text-[11px] text-muted-brand mb-1">정제 주소</div>
                            <input
                              value={editForm.normalizedAddress ?? ''}
                              onChange={(e) => setEditForm((f) => ({ ...f, normalizedAddress: e.target.value }))}
                              className="px-2.5 py-1.5 border border-[#90caf9] rounded-md text-[13px] w-60"
                              placeholder="주소"
                            />
                          </div>
                          <div>
                            <div className="text-[11px] text-muted-brand mb-1">위도</div>
                            <input
                              type="number"
                              step="0.00001"
                              value={editForm.latitude ?? ''}
                              onChange={(e) => setEditForm((f) => ({ ...f, latitude: parseFloat(e.target.value) || undefined }))}
                              className="px-2.5 py-1.5 border border-[#90caf9] rounded-md text-[13px] w-28"
                              placeholder="37.12345"
                            />
                          </div>
                          <div>
                            <div className="text-[11px] text-muted-brand mb-1">경도</div>
                            <input
                              type="number"
                              step="0.00001"
                              value={editForm.longitude ?? ''}
                              onChange={(e) => setEditForm((f) => ({ ...f, longitude: parseFloat(e.target.value) || undefined }))}
                              className="px-2.5 py-1.5 border border-[#90caf9] rounded-md text-[13px] w-28"
                              placeholder="126.12345"
                            />
                          </div>
                          <div>
                            <div className="text-[11px] text-muted-brand mb-1">허용반경(m)</div>
                            <input
                              type="number"
                              min={10}
                              max={5000}
                              value={editForm.allowedRadiusMeters ?? ''}
                              onChange={(e) => setEditForm((f) => ({ ...f, allowedRadiusMeters: parseInt(e.target.value) || undefined }))}
                              className="px-2.5 py-1.5 border border-[#90caf9] rounded-md text-[13px] w-20"
                              placeholder="100"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={saveEdit} disabled={saving}
                              className="px-4 py-2 bg-[#F47920] text-white border-0 rounded-lg cursor-pointer text-[13px] font-semibold">
                              {saving ? '저장 중...' : '저장'}
                            </button>
                            <button onClick={() => setEditingId(null)}
                              className="px-3 py-1 bg-brand border border-[rgba(91,164,217,0.2)] rounded-md cursor-pointer text-xs text-muted-brand">
                              취소
                            </button>
                          </div>
                        </div>
                        <div className="mt-2 text-[11px] text-muted-brand">
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
    </div>
  )
}
