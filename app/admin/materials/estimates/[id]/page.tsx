'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

// ─── Types ───────────────────────────────────────────────────

interface EstimateDoc {
  id: string; fileName: string; fileSize: number | null; documentType: string
  parseStatus: string; parseVersion: number; sheetCount: number
  notes: string | null; uploadedAt: string; errorMessage: string | null
  site: { id: string; name: string } | null
}
interface SheetSummary {
  id: string; sheetName: string; sheetIndex: number; sheetType: string
  discipline: string | null; maxRows: number; maxCols: number
  isHidden: boolean; needsReview: boolean; parseStatus: string; rowCount: number
}
interface CellData { r: number; c: number; v: string | number | null; t?: string; rowspan?: number; colspan?: number }

interface BillRow {
  id: string; rowNo: number; rowType: string; sheetName: string
  rawItemName: string | null; rawSpec: string | null; rawUnit: string | null
  rawQuantity: string | null; rawAmount: string | null
  aggregateCandidate: boolean; reviewRequired: boolean; reviewReasonsJson: string | null
  parseConfidence: number | null; sectionName: string | null
  normalized: { normalizedItemName: string | null; normalizedSpec: string | null; normalizedUnit: string | null; groupKey: string | null } | null
  // Phase 3
  manualItemName: string | null; manualSpec: string | null; manualUnit: string | null
  manualQuantity: string | null; manualGroupKey: string | null
  excludeFromAggregation: boolean; overrideReason: string | null; overriddenAt: string | null
}
interface AggRow {
  id: string; normalizedItemName: string; normalizedSpec: string | null; normalizedUnit: string | null
  totalQuantity: string; totalAmount: string | null; sourceRowCount: number
  reviewRequired: boolean; discipline: string | null; itemCategory: string | null
  // Phase 3
  aggregationStatus: string; manualOverrideUsed: boolean; confirmedBy: string | null; confirmedAt: string | null; regeneratedAt: string | null
  groupKey: string
}
interface PagedResult { items: BillRow[]; total: number; page: number; totalPages: number }

interface OverrideRecord {
  id: string; fieldName: string; beforeValue: string | null; afterValue: string | null
  reason: string | null; changedBy: string; changedAt: string
}

// ─── Constants ───────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  UPLOADED: '업로드됨', PARSING: '파싱중', PARSED: '완료', REVIEW_REQUIRED: '검토필요', FAILED: '실패',
}
const STATUS_COLOR: Record<string, string> = {
  UPLOADED: '#607d8b', PARSING: '#f9a825', PARSED: '#2e7d32', REVIEW_REQUIRED: '#e65100', FAILED: '#b71c1c',
}
const SHEET_TYPE_LABEL: Record<string, string> = {
  SUMMARY: '총괄/원가계산', TRADE_SUMMARY: '공종별 집계표', DETAIL_BILL: '내역서',
  UNIT_PRICE: '일위대가', PRICE_TABLE: '단가표', REFERENCE: '참고/개요', UNKNOWN: '미분류',
}
const DOC_TYPE_LABEL: Record<string, string> = {
  ESTIMATE: '내역서', CHANGE_ESTIMATE: '설계변경', UNIT_PRICE_SOURCE: '일위대가', PRICE_TABLE: '단가표', OTHER: '기타',
}
const ROW_TYPE_LABEL: Record<string, string> = {
  HEADER_ROW: '헤더', DATA_ROW: '항목', GROUP_ROW: '그룹', SUMMARY_ROW: '소계', NOTE_ROW: '비고', EMPTY_ROW: '공백',
}
const ROW_TYPE_COLOR: Record<string, string> = {
  HEADER_ROW: '#1565c0', DATA_ROW: '#2e7d32', GROUP_ROW: '#6a1b9a', SUMMARY_ROW: '#e65100', NOTE_ROW: '#795548', EMPTY_ROW: '#bbb',
}
const AGG_STATUS_LABEL: Record<string, string> = { DRAFT: '초안', REVIEWED: '검토완료', CONFIRMED: '확정' }
const AGG_STATUS_COLOR: Record<string, string> = { DRAFT: '#607d8b', REVIEWED: '#1565c0', CONFIRMED: '#2e7d32' }

// ─── Sub-components ───────────────────────────────────────────

function RawSheetGrid({ cells, maxDisplayRows }: { cells: CellData[][], maxDisplayRows: number }) {
  if (!cells || cells.length === 0) return <div style={{ padding: '24px', color: '#718096', textAlign: 'center' }}>셀 데이터가 없습니다</div>
  return (
    <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '60vh' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: '12px', tableLayout: 'auto', minWidth: '100%' }}>
        <tbody>
          {cells.slice(0, maxDisplayRows).map((row, rowIdx) => (
            <tr key={rowIdx}>
              <td style={{ padding: '2px 6px', border: '1px solid #e0e0e0', background: '#1B2838', color: '#718096', fontSize: '11px', textAlign: 'right', whiteSpace: 'nowrap', userSelect: 'none', minWidth: '32px', position: 'sticky', left: 0, zIndex: 1 }}>
                {rowIdx === 0 ? '' : rowIdx}
              </td>
              {row.map((cell, i) => (
                <td key={i} rowSpan={cell.rowspan ?? 1} colSpan={cell.colspan ?? 1}
                  style={{ padding: '3px 6px', border: '1px solid #e0e0e0', whiteSpace: 'nowrap', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'middle', background: rowIdx === 0 ? '#fafafa' : 'white', fontWeight: rowIdx === 0 ? 600 : 400 }}
                  title={cell.v != null ? String(cell.v) : ''}>
                  {cell.v != null ? String(cell.v) : ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RowTypeBadge({ type }: { type: string }) {
  const label = ROW_TYPE_LABEL[type] ?? type
  const color = ROW_TYPE_COLOR[type] ?? '#888'
  return (
    <span style={{ display: 'inline-block', padding: '1px 7px', borderRadius: '10px', fontSize: '11px', fontWeight: 700, background: color + '1a', color, border: `1px solid ${color}40` }}>
      {label}
    </span>
  )
}

function AggStatusBadge({ status }: { status: string }) {
  const label = AGG_STATUS_LABEL[status] ?? status
  const color = AGG_STATUS_COLOR[status] ?? '#888'
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700, background: color + '20', color, border: `1px solid ${color}50` }}>
      {label}
    </span>
  )
}

// ─── Override Edit Modal ──────────────────────────────────────

interface OverrideModalProps {
  row: BillRow
  docId: string
  onClose: () => void
  onSaved: () => void
}

function OverrideModal({ row, docId, onClose, onSaved }: OverrideModalProps) {
  const [itemName, setItemName] = useState(row.manualItemName ?? '')
  const [spec, setSpec] = useState(row.manualSpec ?? '')
  const [unit, setUnit] = useState(row.manualUnit ?? '')
  const [quantity, setQuantity] = useState(row.manualQuantity ?? '')
  const [groupKey, setGroupKey] = useState(row.manualGroupKey ?? '')
  const [reason, setReason] = useState(row.overrideReason ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const body: Record<string, unknown> = { overrideReason: reason || null }
      if (itemName !== (row.manualItemName ?? '')) body.manualItemName = itemName || null
      if (spec !== (row.manualSpec ?? '')) body.manualSpec = spec || null
      if (unit !== (row.manualUnit ?? '')) body.manualUnit = unit || null
      if (quantity !== (row.manualQuantity ?? '')) body.manualQuantity = quantity ? parseFloat(quantity) : null
      if (groupKey !== (row.manualGroupKey ?? '')) body.manualGroupKey = groupKey || null

      const res = await fetch(`/api/admin/materials/estimates/${docId}/rows/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!data.success) { setError(data.error ?? '저장 실패'); return }
      onSaved()
      onClose()
    } catch {
      setError('네트워크 오류')
    } finally {
      setSaving(false)
    }
  }

  const handleClearAll = async () => {
    if (!confirm('모든 보정값을 해제하고 자동값으로 되돌리겠습니까?')) return
    setSaving(true)
    try {
      await fetch(`/api/admin/materials/estimates/${docId}/rows/${row.id}`, { method: 'DELETE' })
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#243144', borderRadius: '12px', padding: '28px', width: '520px', maxWidth: '95vw', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>행 수동 보정</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#A0AEC0' }}>×</button>
        </div>

        {/* 원문 정보 */}
        <div style={{ background: '#1B2838', borderRadius: '6px', padding: '10px 14px', marginBottom: '18px', fontSize: '12px', color: '#666' }}>
          <div style={{ fontWeight: 700, marginBottom: '4px', color: '#333' }}>원문 (수정불가)</div>
          <div>품명: {row.rawItemName || '-'} / 규격: {row.rawSpec || '-'} / 단위: {row.rawUnit || '-'} / 수량: {row.rawQuantity || '-'}</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div>
            <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>수동 품명</label>
            <input value={itemName} onChange={e => setItemName(e.target.value)} placeholder={row.normalized?.normalizedItemName ?? row.rawItemName ?? ''} style={s.input} />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>수동 규격</label>
            <input value={spec} onChange={e => setSpec(e.target.value)} placeholder={row.normalized?.normalizedSpec ?? row.rawSpec ?? ''} style={s.input} />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>수동 단위</label>
            <input value={unit} onChange={e => setUnit(e.target.value)} placeholder={row.normalized?.normalizedUnit ?? row.rawUnit ?? ''} style={s.input} />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>수동 수량</label>
            <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder={row.rawQuantity ?? ''} style={s.input} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>수동 그룹 키 <span style={{ color: '#A0AEC0', fontWeight: 400 }}>(같은 값끼리 집계 묶음)</span></label>
            <input value={groupKey} onChange={e => setGroupKey(e.target.value)} placeholder={row.normalized?.groupKey ?? ''} style={s.input} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>보정 사유</label>
            <input value={reason} onChange={e => setReason(e.target.value)} placeholder="보정 사유 입력 (선택)" style={s.input} />
          </div>
        </div>

        {error && <div style={{ color: '#b71c1c', fontSize: '13px', marginBottom: '12px' }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
          <button onClick={handleClearAll} disabled={saving} style={{ padding: '8px 14px', background: '#ffebee', color: '#b71c1c', border: '1px solid #ef9a9a', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
            보정 전체 해제
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={onClose} disabled={saving} style={{ padding: '8px 16px', background: 'rgba(91,164,217,0.1)', color: '#A0AEC0', border: '1px solid rgba(91,164,217,0.3)', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>취소</button>
            <button onClick={handleSave} disabled={saving} style={{ padding: '8px 16px', background: '#F47920', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Parse Review Tab (Phase 3 확장) ─────────────────────────

function ParseReviewTab({ docId, sheets }: { docId: string; sheets: SheetSummary[] }) {
  const [sheetId, setSheetId] = useState('')
  const [rowTypeFilter, setRowTypeFilter] = useState('')
  const [reviewOnly, setReviewOnly] = useState(false)
  const [excludedOnly, setExcludedOnly] = useState(false)
  const [overriddenOnly, setOverriddenOnly] = useState(false)
  const [hasManualGroupKey, setHasManualGroupKey] = useState(false)
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<PagedResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [editingRow, setEditingRow] = useState<BillRow | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const fetchRows = useCallback(() => {
    setLoading(true)
    const p = new URLSearchParams()
    if (sheetId) p.set('sheetId', sheetId)
    if (rowTypeFilter) p.set('rowType', rowTypeFilter)
    if (reviewOnly) p.set('reviewOnly', 'true')
    if (excludedOnly) p.set('excludedOnly', 'true')
    if (overriddenOnly) p.set('overriddenOnly', 'true')
    if (hasManualGroupKey) p.set('hasManualGroupKey', 'true')
    p.set('page', String(page))
    fetch(`/api/admin/materials/estimates/${docId}/rows?${p}`)
      .then(r => r.json())
      .then(d => { if (d.success) setResult(d.data) })
      .finally(() => setLoading(false))
  }, [docId, sheetId, rowTypeFilter, reviewOnly, excludedOnly, overriddenOnly, hasManualGroupKey, page])

  useEffect(() => { setPage(1) }, [sheetId, rowTypeFilter, reviewOnly, excludedOnly, overriddenOnly, hasManualGroupKey])
  useEffect(() => { fetchRows() }, [fetchRows])

  const handleToggleExclude = async (row: BillRow) => {
    setTogglingId(row.id)
    await fetch(`/api/admin/materials/estimates/${docId}/rows/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ excludeFromAggregation: !row.excludeFromAggregation, overrideReason: row.excludeFromAggregation ? '제외 해제' : '집계 제외' }),
    })
    setTogglingId(null)
    fetchRows()
  }

  const fmt = (v: string | null | undefined) => v || <span style={{ color: '#bbb' }}>-</span>

  return (
    <div>
      {editingRow && (
        <OverrideModal row={editingRow} docId={docId} onClose={() => setEditingRow(null)} onSaved={fetchRows} />
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap' }}>
        <select value={sheetId} onChange={e => setSheetId(e.target.value)} style={s.filterSelect}>
          <option value="">전체 시트</option>
          {sheets.map(sh => (
            <option key={sh.id} value={sh.id}>{sh.sheetIndex + 1}. {sh.sheetName}</option>
          ))}
        </select>
        <select value={rowTypeFilter} onChange={e => setRowTypeFilter(e.target.value)} style={s.filterSelect}>
          <option value="">전체 행 유형</option>
          {Object.entries(ROW_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {[
          { label: '검토필요', val: reviewOnly, set: setReviewOnly },
          { label: '제외된 행', val: excludedOnly, set: setExcludedOnly },
          { label: '보정된 행', val: overriddenOnly, set: setOverriddenOnly },
          { label: '수동 그룹키', val: hasManualGroupKey, set: setHasManualGroupKey },
        ].map(({ label, val, set }) => (
          <label key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={val} onChange={e => set(e.target.checked)} />
            {label}
          </label>
        ))}
        {result && <span style={{ fontSize: '13px', color: '#A0AEC0' }}>총 {result.total}행</span>}
      </div>

      {loading ? <div style={{ padding: '40px', textAlign: 'center', color: '#A0AEC0' }}>로딩 중...</div> : (
        <div>
          <div style={{ overflowX: 'auto' }}>
            <table style={s.table}>
              <thead>
                <tr>
                  {['행번호', '시트', '유형', '품명', '규격', '단위', '수량', '집계', '보정', '자동 그룹키', '수동 그룹키', '상태', '액션'].map(h => <th key={h} style={s.th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {!result || result.items.length === 0 ? (
                  <tr><td colSpan={13} style={{ padding: '32px', textAlign: 'center', color: '#999' }}>데이터가 없습니다</td></tr>
                ) : result.items.map(row => {
                  const isExcluded = row.excludeFromAggregation
                  const isOverridden = !!row.overriddenAt
                  const rowBg = isExcluded ? '#fafafa' : row.reviewRequired ? '#fff8f0' : 'white'
                  return (
                    <tr key={row.id} style={{ background: rowBg, opacity: isExcluded ? 0.6 : 1 }}>
                      <td style={s.td}><span style={{ color: '#718096', fontSize: '12px' }}>{row.rowNo + 1}</span></td>
                      <td style={s.td}><span style={{ fontSize: '11px', color: '#A0AEC0' }}>{row.sheetName}</span></td>
                      <td style={s.td}><RowTypeBadge type={row.rowType} /></td>
                      <td style={{ ...s.td, maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.sectionName && <span style={{ fontSize: '10px', color: '#718096', display: 'block' }}>{row.sectionName}</span>}
                        {isOverridden && row.manualItemName
                          ? <><span style={{ color: '#5BA4D9', fontWeight: 600 }}>{row.manualItemName}</span><span style={{ fontSize: '10px', color: '#bbb', marginLeft: '4px' }}>({row.rawItemName})</span></>
                          : fmt(row.rawItemName)}
                      </td>
                      <td style={{ ...s.td, maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '12px' }}>
                        {isOverridden && row.manualSpec ? <span style={{ color: '#5BA4D9' }}>{row.manualSpec}</span> : fmt(row.rawSpec)}
                      </td>
                      <td style={s.td}>
                        {isOverridden && row.manualUnit ? <span style={{ color: '#5BA4D9' }}>{row.manualUnit}</span> : fmt(row.rawUnit)}
                      </td>
                      <td style={{ ...s.td, textAlign: 'right', fontSize: '12px' }}>
                        {isOverridden && row.manualQuantity ? <span style={{ color: '#5BA4D9' }}>{row.manualQuantity}</span> : fmt(row.rawQuantity)}
                      </td>
                      <td style={s.td}>
                        {row.aggregateCandidate
                          ? <span style={{ color: '#2e7d32', fontWeight: 700, fontSize: '12px' }}>Y</span>
                          : <span style={{ color: '#bbb', fontSize: '12px' }}>-</span>}
                      </td>
                      <td style={s.td}>
                        {isOverridden
                          ? <span style={{ fontSize: '11px', color: '#5BA4D9', fontWeight: 600 }} title={row.overrideReason ?? ''}>보정됨</span>
                          : <span style={{ color: '#bbb', fontSize: '12px' }}>-</span>}
                      </td>
                      <td style={{ ...s.td, maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '11px', color: '#A0AEC0' }}>
                        {row.normalized?.groupKey ?? '-'}
                      </td>
                      <td style={{ ...s.td, maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '11px' }}>
                        {row.manualGroupKey
                          ? <span style={{ color: '#7b1fa2', fontWeight: 700 }}>{row.manualGroupKey}</span>
                          : <span style={{ color: '#bbb' }}>-</span>}
                      </td>
                      <td style={s.td}>
                        {isExcluded
                          ? <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '8px', background: '#ffebee', color: '#b71c1c', fontWeight: 700 }}>제외</span>
                          : row.reviewRequired
                            ? <span style={{ fontSize: '11px', color: '#e65100' }}>검토</span>
                            : null}
                      </td>
                      <td style={{ ...s.td, whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            onClick={() => handleToggleExclude(row)}
                            disabled={togglingId === row.id}
                            style={{ padding: '3px 8px', fontSize: '11px', fontWeight: 600, borderRadius: '4px', cursor: 'pointer', border: isExcluded ? '1px solid #a5d6a7' : '1px solid #ef9a9a', background: isExcluded ? '#e8f5e9' : '#ffebee', color: isExcluded ? '#2e7d32' : '#b71c1c' }}>
                            {isExcluded ? '제외해제' : '제외'}
                          </button>
                          <button
                            onClick={() => setEditingRow(row)}
                            style={{ padding: '3px 8px', fontSize: '11px', fontWeight: 600, borderRadius: '4px', cursor: 'pointer', border: '1px solid #F47920', background: 'rgba(244,121,32,0.12)', color: '#F47920' }}>
                            보정
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {result && result.totalPages > 1 && (
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '16px', alignItems: 'center' }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={s.pageBtn}>이전</button>
              <span style={{ fontSize: '13px', color: '#666' }}>{page} / {result.totalPages}</span>
              <button onClick={() => setPage(p => Math.min(result.totalPages, p + 1))} disabled={page === result.totalPages} style={s.pageBtn}>다음</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Material Aggregate Tab (Phase 3 확장) ────────────────────

function MaterialAggregateTab({ docId }: { docId: string }) {
  const [reviewOnly, setReviewOnly] = useState(false)
  const [items, setItems] = useState<AggRow[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedAgg, setSelectedAgg] = useState<AggRow | null>(null)
  const [sourceRows, setSourceRows] = useState<BillRow[]>([])
  const [sourceLoading, setSourceLoading] = useState(false)
  const [overrides, setOverrides] = useState<OverrideRecord[]>([])
  const [rebuilding, setRebuilding] = useState(false)
  const [rebuildMsg, setRebuildMsg] = useState('')
  const [editingSourceRow, setEditingSourceRow] = useState<BillRow | null>(null)
  const [statusChanging, setStatusChanging] = useState(false)

  const fetchAgg = useCallback(() => {
    setLoading(true)
    const p = new URLSearchParams()
    if (reviewOnly) p.set('reviewOnly', 'true')
    fetch(`/api/admin/materials/estimates/${docId}/aggregate?${p}`)
      .then(r => r.json())
      .then(d => { if (d.success) setItems(d.data) })
      .finally(() => setLoading(false))
  }, [docId, reviewOnly])

  useEffect(() => { fetchAgg() }, [fetchAgg])

  const handleRowClick = (agg: AggRow) => {
    setSelectedAgg(agg)
    setSourceRows([])
    setOverrides([])
    setSourceLoading(true)
    fetch(`/api/admin/materials/estimates/${docId}/aggregate/${agg.id}/sources`)
      .then(r => r.json())
      .then(d => { if (d.success) setSourceRows(d.data) })
      .finally(() => setSourceLoading(false))
  }

  const handleRebuild = async () => {
    if (!confirm('보정값을 반영하여 자재집계표를 재생성합니다. 기존 집계 결과는 교체됩니다. 계속하시겠습니까?')) return
    setRebuilding(true)
    setRebuildMsg('')
    try {
      const res = await fetch(`/api/admin/materials/estimates/${docId}/aggregate/rebuild`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setRebuildMsg(`재집계 완료: ${data.data.aggregateCount}건 (검토필요 ${data.data.reviewRequiredCount}건)`)
        setSelectedAgg(null)
        fetchAgg()
      } else {
        setRebuildMsg(`오류: ${data.error}`)
      }
    } catch {
      setRebuildMsg('네트워크 오류')
    } finally {
      setRebuilding(false)
    }
  }

  const handleBulkStatus = async (status: string) => {
    const labels: Record<string, string> = { REVIEWED: '검토완료', CONFIRMED: '최종확정', DRAFT: '초안으로 되돌리기' }
    if (!confirm(`모든 집계행 상태를 "${labels[status]}"로 변경하시겠습니까?`)) return
    setStatusChanging(true)
    try {
      await fetch(`/api/admin/materials/estimates/${docId}/aggregate/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      fetchAgg()
      if (selectedAgg) setSelectedAgg(prev => prev ? { ...prev, aggregationStatus: status } : null)
    } finally {
      setStatusChanging(false)
    }
  }

  const handleSingleStatus = async (agg: AggRow, status: string) => {
    await fetch(`/api/admin/materials/estimates/${docId}/aggregate/${agg.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    fetchAgg()
    if (selectedAgg?.id === agg.id) setSelectedAgg(prev => prev ? { ...prev, aggregationStatus: status } : null)
  }

  const fmtNum = (v: string | null) => {
    if (!v) return '-'
    const n = parseFloat(v)
    return isNaN(n) ? v : n.toLocaleString('ko-KR', { maximumFractionDigits: 4 })
  }

  const reviewCount = items.filter(i => i.reviewRequired).length
  const confirmedCount = items.filter(i => i.aggregationStatus === 'CONFIRMED').length
  const overrideCount = items.filter(i => i.manualOverrideUsed).length

  // 확정 상태 편집 잠금 여부
  const isAllConfirmed = items.length > 0 && confirmedCount === items.length

  return (
    <div>
      {editingSourceRow && (
        <OverrideModal row={editingSourceRow} docId={docId} onClose={() => setEditingSourceRow(null)} onSaved={() => { setEditingSourceRow(null); if (selectedAgg) handleRowClick(selectedAgg) }} />
      )}

      {/* 집계 제어 툴바 */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', padding: '12px 16px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
        <button
          onClick={handleRebuild}
          disabled={rebuilding}
          style={{ padding: '8px 16px', background: '#7b1fa2', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 700 }}>
          {rebuilding ? '재집계 중...' : '보정 반영 재집계'}
        </button>
        <button onClick={() => handleBulkStatus('REVIEWED')} disabled={statusChanging} style={s.toolbarBtn}>검토완료</button>
        <button onClick={() => handleBulkStatus('CONFIRMED')} disabled={statusChanging} style={{ ...s.toolbarBtn, background: '#e8f5e9', color: '#2e7d32', borderColor: '#a5d6a7' }}>전체 확정</button>
        <button onClick={() => handleBulkStatus('DRAFT')} disabled={statusChanging} style={{ ...s.toolbarBtn, background: '#fff3e0', color: '#e65100', borderColor: '#ffcc80' }}>확정 해제</button>
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', cursor: 'pointer', marginLeft: '8px' }}>
          <input type="checkbox" checked={reviewOnly} onChange={e => setReviewOnly(e.target.checked)} />
          검토필요만
        </label>
        <span style={{ fontSize: '13px', color: '#A0AEC0', marginLeft: '8px' }}>
          총 {items.length}건
          {reviewCount > 0 && <span style={{ color: '#e65100' }}> / 검토 {reviewCount}건</span>}
          {confirmedCount > 0 && <span style={{ color: '#2e7d32' }}> / 확정 {confirmedCount}건</span>}
          {overrideCount > 0 && <span style={{ color: '#7b1fa2' }}> / 보정 {overrideCount}건</span>}
        </span>
        {rebuildMsg && (
          <span style={{ fontSize: '13px', color: rebuildMsg.startsWith('오류') ? '#b71c1c' : '#2e7d32', fontWeight: 600 }}>{rebuildMsg}</span>
        )}
      </div>

      {isAllConfirmed && (
        <div style={{ padding: '10px 16px', background: '#e8f5e9', borderRadius: '6px', marginBottom: '14px', fontSize: '13px', color: '#2e7d32', fontWeight: 600, border: '1px solid #a5d6a7' }}>
          모든 집계가 확정 상태입니다. 수정하려면 "확정 해제"를 클릭하세요.
        </div>
      )}

      <div style={{ display: 'flex', gap: '24px' }}>
        {/* Aggregate list */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {loading ? <div style={{ padding: '40px', textAlign: 'center', color: '#A0AEC0' }}>로딩 중...</div> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={s.table}>
                <thead>
                  <tr>{['상태', '품명', '규격', '단위', '총수량', '총금액', '출처', '보정', '검토', '액션'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={10} style={{ padding: '32px', textAlign: 'center', color: '#999' }}>
                      집계 결과가 없습니다. 재집계를 실행하세요.
                    </td></tr>
                  ) : items.map(row => {
                    const isConfirmed = row.aggregationStatus === 'CONFIRMED'
                    return (
                      <tr key={row.id}
                        onClick={() => handleRowClick(row)}
                        style={{ cursor: 'pointer', background: selectedAgg?.id === row.id ? '#e3f2fd' : row.reviewRequired ? '#fff8f0' : 'white' }}>
                        <td style={s.td} onClick={e => e.stopPropagation()}>
                          <AggStatusBadge status={row.aggregationStatus} />
                        </td>
                        <td style={{ ...s.td, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <strong>{row.normalizedItemName}</strong>
                          {row.manualOverrideUsed && <span style={{ marginLeft: '4px', fontSize: '10px', color: '#7b1fa2', fontWeight: 700 }}>보정</span>}
                        </td>
                        <td style={{ ...s.td, maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '12px', color: '#666' }}>
                          {row.normalizedSpec || '-'}
                        </td>
                        <td style={s.td}>{row.normalizedUnit || '-'}</td>
                        <td style={{ ...s.td, textAlign: 'right' }}>{fmtNum(row.totalQuantity)}</td>
                        <td style={{ ...s.td, textAlign: 'right' }}>{fmtNum(row.totalAmount)}</td>
                        <td style={{ ...s.td, textAlign: 'center' }}>
                          <span style={{ fontSize: '12px', padding: '1px 8px', borderRadius: '10px', background: '#e8f5e9', color: '#2e7d32', fontWeight: 600 }}>
                            {row.sourceRowCount}행
                          </span>
                        </td>
                        <td style={s.td}>
                          {row.manualOverrideUsed
                            ? <span style={{ fontSize: '11px', color: '#7b1fa2', fontWeight: 700 }}>Y</span>
                            : <span style={{ color: '#bbb', fontSize: '11px' }}>-</span>}
                        </td>
                        <td style={s.td}>
                          {row.reviewRequired && <span style={{ fontSize: '12px', color: '#e65100', fontWeight: 700 }}>검토</span>}
                        </td>
                        <td style={{ ...s.td, whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                          {!isConfirmed ? (
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button onClick={() => handleSingleStatus(row, 'REVIEWED')} style={{ padding: '2px 7px', fontSize: '11px', borderRadius: '4px', cursor: 'pointer', border: '1px solid #F47920', background: 'rgba(244,121,32,0.12)', color: '#F47920' }}>검토</button>
                              <button onClick={() => handleSingleStatus(row, 'CONFIRMED')} style={{ padding: '2px 7px', fontSize: '11px', borderRadius: '4px', cursor: 'pointer', border: '1px solid #a5d6a7', background: '#e8f5e9', color: '#2e7d32' }}>확정</button>
                            </div>
                          ) : (
                            <button onClick={() => handleSingleStatus(row, 'REVIEWED')} style={{ padding: '2px 7px', fontSize: '11px', borderRadius: '4px', cursor: 'pointer', border: '1px solid #ffcc80', background: '#fff3e0', color: '#e65100' }}>해제</button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Source rows drill-down */}
        {selectedAgg && (
          <div style={{ width: '440px', flexShrink: 0, background: '#f8faff', borderRadius: '8px', padding: '16px', border: '1px solid #e3f2fd' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '14px' }}>{selectedAgg.normalizedItemName}</div>
                <div style={{ fontSize: '12px', color: '#A0AEC0', marginTop: '2px' }}>{selectedAgg.normalizedSpec || '-'} / {selectedAgg.normalizedUnit || '-'}</div>
                <div style={{ marginTop: '6px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <AggStatusBadge status={selectedAgg.aggregationStatus} />
                  {selectedAgg.manualOverrideUsed && <span style={{ fontSize: '11px', color: '#7b1fa2', fontWeight: 700 }}>보정 사용됨</span>}
                </div>
                <div style={{ fontSize: '11px', color: '#A0AEC0', marginTop: '4px' }}>
                  그룹키: <code style={{ fontSize: '11px', background: '#1B2838', padding: '1px 4px', borderRadius: '3px' }}>{selectedAgg.groupKey}</code>
                </div>
                {selectedAgg.regeneratedAt && (
                  <div style={{ fontSize: '11px', color: '#A0AEC0', marginTop: '2px' }}>
                    재집계: {new Date(selectedAgg.regeneratedAt).toLocaleString('ko-KR')}
                  </div>
                )}
                {selectedAgg.confirmedAt && (
                  <div style={{ fontSize: '11px', color: '#2e7d32', marginTop: '2px' }}>
                    확정: {new Date(selectedAgg.confirmedAt).toLocaleString('ko-KR')} ({selectedAgg.confirmedBy})
                  </div>
                )}
              </div>
              <button onClick={() => setSelectedAgg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A0AEC0', fontSize: '18px', padding: '0 4px' }}>×</button>
            </div>

            {sourceLoading ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#A0AEC0' }}>로딩 중...</div>
            ) : (
              <div>
                <div style={{ fontSize: '12px', color: '#A0AEC0', marginBottom: '8px' }}>출처 행 {sourceRows.length}건</div>
                {sourceRows.map(row => {
                  const isOverridden = !!row.overriddenAt
                  const isExcluded = row.excludeFromAggregation
                  return (
                    <div key={row.id} style={{ padding: '10px 12px', marginBottom: '8px', background: '#1E3350', borderRadius: '6px', border: isExcluded ? '1px solid #ef9a9a' : isOverridden ? '1px solid #90caf9' : '1px solid #e0e0e0', fontSize: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ color: '#A0AEC0' }}>{row.sheetName} 행 {row.rowNo + 1}</span>
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          {isExcluded && <span style={{ color: '#b71c1c', fontWeight: 700, fontSize: '11px' }}>제외</span>}
                          {isOverridden && <span style={{ color: '#5BA4D9', fontWeight: 700, fontSize: '11px' }}>보정</span>}
                          {row.reviewRequired && <span style={{ color: '#e65100', fontWeight: 600, fontSize: '11px' }}>검토</span>}
                        </div>
                      </div>
                      {/* 원문 vs 보정값 비교 */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: '11px', marginBottom: '6px' }}>
                        <div style={{ color: '#A0AEC0' }}>
                          <div>원문 품명: {row.rawItemName || '-'}</div>
                          <div>원문 규격: {row.rawSpec || '-'}</div>
                          <div>원문 단위: {row.rawUnit || '-'} / 수량: {row.rawQuantity || '-'}</div>
                        </div>
                        {isOverridden && (
                          <div style={{ color: '#4A93C8' }}>
                            <div>보정 품명: {row.manualItemName || <span style={{ color: '#bbb' }}>-</span>}</div>
                            <div>보정 규격: {row.manualSpec || <span style={{ color: '#bbb' }}>-</span>}</div>
                            <div>보정 단위: {row.manualUnit || '-'} / 수량: {row.manualQuantity || '-'}</div>
                          </div>
                        )}
                      </div>
                      {row.manualGroupKey && (
                        <div style={{ fontSize: '11px', marginBottom: '4px' }}>
                          수동 그룹키: <span style={{ color: '#7b1fa2', fontWeight: 700 }}>{row.manualGroupKey}</span>
                        </div>
                      )}
                      {/* 즉시 액션 */}
                      {selectedAgg.aggregationStatus !== 'CONFIRMED' && (
                        <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                          <button
                            onClick={async () => {
                              await fetch(`/api/admin/materials/estimates/${docId}/rows/${row.id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ excludeFromAggregation: !isExcluded, overrideReason: isExcluded ? '제외 해제' : '집계 제외' }),
                              })
                              handleRowClick(selectedAgg)
                            }}
                            style={{ padding: '2px 8px', fontSize: '11px', borderRadius: '4px', cursor: 'pointer', border: isExcluded ? '1px solid #a5d6a7' : '1px solid #ef9a9a', background: isExcluded ? '#e8f5e9' : '#ffebee', color: isExcluded ? '#2e7d32' : '#b71c1c', fontWeight: 600 }}>
                            {isExcluded ? '제외해제' : '제외'}
                          </button>
                          <button
                            onClick={() => setEditingSourceRow(row)}
                            style={{ padding: '2px 8px', fontSize: '11px', borderRadius: '4px', cursor: 'pointer', border: '1px solid #F47920', background: 'rgba(244,121,32,0.12)', color: '#F47920', fontWeight: 600 }}>
                            보정편집
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
                {overrides.length > 0 && (
                  <div style={{ marginTop: '12px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#555', marginBottom: '6px' }}>보정 이력</div>
                    {overrides.map(o => (
                      <div key={o.id} style={{ fontSize: '11px', color: '#A0AEC0', marginBottom: '4px' }}>
                        {new Date(o.changedAt).toLocaleString('ko-KR')} {o.changedBy} — {o.fieldName}: {o.beforeValue ?? '-'} → {o.afterValue ?? '-'}
                        {o.reason && <span style={{ color: '#aaa' }}> ({o.reason})</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────

export default function EstimateDetailPage() {
  const router = useRouter()
  const params = useParams()
  const docId = params.id as string

  const [doc, setDoc] = useState<EstimateDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'sheets' | 'raw' | 'review' | 'aggregate'>('sheets')

  const [sheets, setSheets] = useState<SheetSummary[]>([])
  const [sheetsLoading, setSheetsLoading] = useState(false)

  const [selectedSheetId, setSelectedSheetId] = useState<string>('')
  const [rawCells, setRawCells] = useState<CellData[][] | null>(null)
  const [rawLoading, setRawLoading] = useState(false)
  const [displayRows, setDisplayRows] = useState(500)

  const fetchDoc = useCallback(() => {
    setLoading(true)
    fetch(`/api/admin/materials/estimates/${docId}`)
      .then(r => r.json())
      .then(data => {
        if (!data.success) { router.push('/admin/login'); return }
        setDoc(data.data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [docId, router])

  const fetchSheets = useCallback(() => {
    setSheetsLoading(true)
    fetch(`/api/admin/materials/estimates/${docId}/sheets`)
      .then(r => r.json())
      .then(data => { if (data.success) setSheets(data.data) })
      .finally(() => setSheetsLoading(false))
  }, [docId])

  const fetchRawSheet = useCallback((sid: string) => {
    if (!sid) return
    setRawLoading(true)
    setRawCells(null)
    setDisplayRows(500)
    fetch(`/api/admin/materials/estimates/${docId}/sheets/${sid}`)
      .then(r => r.json())
      .then(data => {
        if (data.success && data.data.rawDataJson) {
          try { setRawCells(JSON.parse(data.data.rawDataJson)) } catch { setRawCells(null) }
        }
      })
      .finally(() => setRawLoading(false))
  }, [docId])

  const handleReparse = async () => {
    await fetch(`/api/admin/materials/estimates/${docId}/parse`, { method: 'POST' })
    setTimeout(() => { fetchDoc(); fetchSheets() }, 1500)
  }

  const handleLogout = () => {
    fetch('/api/admin/auth/logout', { method: 'POST' }).then(() => router.push('/admin/login'))
  }

  useEffect(() => { fetchDoc() }, [fetchDoc])
  useEffect(() => { fetchSheets() }, [fetchSheets])
  useEffect(() => {
    if (activeTab === 'raw' && selectedSheetId) fetchRawSheet(selectedSheetId)
  }, [activeTab, selectedSheetId, fetchRawSheet])
  useEffect(() => {
    if (activeTab === 'raw' && !selectedSheetId && sheets.length > 0) setSelectedSheetId(sheets[0].id)
  }, [activeTab, sheets, selectedSheetId])

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>로딩 중...</div>
  if (!doc) return <div style={{ padding: '40px', color: '#b71c1c' }}>문서를 찾을 수 없습니다</div>

  const tabs = [
    { key: 'sheets', label: `시트 목록 (${sheets.length})` },
    { key: 'raw', label: '시트 원문' },
    { key: 'review', label: '파싱 검토' },
    { key: 'aggregate', label: '자재집계표' },
  ] as const

  return (
    <div style={s.layout}>
      <nav style={s.sidebar}>
        <div style={s.sidebarTitle}>해한 출퇴근</div>
        <div style={s.navSection}>관리</div>
        {[
          { href: '/admin', label: '대시보드' },
          { href: '/admin/workers', label: '근로자 관리' },
          { href: '/admin/companies', label: '회사 관리' },
          { href: '/admin/sites', label: '현장 관리' },
          { href: '/admin/attendance', label: '출퇴근 조회' },
          { href: '/admin/presence-checks', label: '체류확인 현황' },
          { href: '/admin/presence-report', label: '체류확인 리포트' },
          { href: '/admin/work-confirmations', label: '근무확정' },
          { href: '/admin/contracts', label: '인력/계약 관리' },
          { href: '/admin/insurance-eligibility', label: '보험판정' },
          { href: '/admin/wage-calculations', label: '세금/노임 계산' },
          { href: '/admin/filing-exports', label: '신고자료 내보내기' },
          { href: '/admin/exceptions', label: '예외 승인' },
          { href: '/admin/device-requests', label: '기기 변경' },
          { href: '/admin/materials', label: '자재관리' },
        ].map(item => (
          <Link key={item.href} href={item.href} style={item.href === '/admin/materials' ? s.navItemActive : s.navItem}>{item.label}</Link>
        ))}
        <button onClick={handleLogout} style={s.logoutBtn}>로그아웃</button>
      </nav>

      <main style={s.main}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', fontSize: '14px', color: '#A0AEC0' }}>
          <Link href="/admin/materials" style={{ color: '#5BA4D9', textDecoration: 'none' }}>자재관리</Link>
          <span>/</span>
          <span style={{ color: '#333' }}>{doc.fileName}</span>
        </div>

        {/* Header card */}
        <div style={{ background: '#243144', borderRadius: '10px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.35)', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 8px' }}>{doc.fileName}</h1>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '14px', color: '#666' }}>
                {doc.site && <span>현장: <strong>{doc.site.name}</strong></span>}
                <span>유형: <strong>{DOC_TYPE_LABEL[doc.documentType] ?? doc.documentType}</strong></span>
                <span>업로드: {new Date(doc.uploadedAt).toLocaleDateString('ko-KR')}</span>
                <span>버전: v{doc.parseVersion}</span>
                <span>시트: <strong>{doc.sheetCount}</strong></span>
              </div>
              {doc.notes && <div style={{ marginTop: '8px', fontSize: '13px', color: '#A0AEC0' }}>{doc.notes}</div>}
              {doc.errorMessage && (
                <div style={{ marginTop: '8px', padding: '8px 12px', background: '#ffebee', borderRadius: '6px', color: '#b71c1c', fontSize: '13px' }}>
                  오류: {doc.errorMessage}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <span style={{ padding: '4px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 600, background: `${STATUS_COLOR[doc.parseStatus]}20`, color: STATUS_COLOR[doc.parseStatus] }}>
                {STATUS_LABEL[doc.parseStatus] ?? doc.parseStatus}
              </span>
              <button onClick={handleReparse} style={s.secondaryBtn}>재파싱</button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #e0e0e0' }}>
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{ padding: '12px 20px', border: 'none', background: 'none', fontSize: '14px', fontWeight: activeTab === tab.key ? 700 : 400, color: activeTab === tab.key ? '#1976d2' : '#666', borderBottom: activeTab === tab.key ? '2px solid #1976d2' : '2px solid transparent', marginBottom: '-2px', cursor: 'pointer' }}>
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ background: 'white', borderRadius: '0 0 10px 10px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.35)' }}>

          {/* Tab: Sheet List */}
          {activeTab === 'sheets' && (
            sheetsLoading ? <div style={{ padding: '40px', textAlign: 'center', color: '#A0AEC0' }}>로딩 중...</div> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={s.table}>
                  <thead><tr>{['#', '시트명', '유형', '공종', '행수', '열수', '검토필요', '상태', '보기'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {sheets.length === 0 ? (
                      <tr><td colSpan={9} style={{ padding: '32px', textAlign: 'center', color: '#999' }}>파싱 후 시트 목록이 표시됩니다</td></tr>
                    ) : sheets.map(sheet => (
                      <tr key={sheet.id} style={s.tr}>
                        <td style={s.td}>{sheet.sheetIndex + 1}</td>
                        <td style={s.td}><strong>{sheet.sheetName}</strong>{sheet.isHidden && <span style={{ marginLeft: '6px', fontSize: '11px', color: '#999' }}>(숨김)</span>}</td>
                        <td style={s.td}><span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '10px', background: 'rgba(244,121,32,0.12)', color: '#F47920' }}>{SHEET_TYPE_LABEL[sheet.sheetType] ?? sheet.sheetType}</span></td>
                        <td style={s.td}>{sheet.discipline ?? <span style={{ color: '#bbb' }}>-</span>}</td>
                        <td style={s.td}>{sheet.maxRows}</td>
                        <td style={s.td}>{sheet.maxCols}</td>
                        <td style={s.td}>{sheet.needsReview ? <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '10px', background: '#fff3e0', color: '#e65100', fontWeight: 600 }}>검토필요</span> : <span style={{ fontSize: '12px', color: '#bbb' }}>-</span>}</td>
                        <td style={s.td}><span style={{ fontSize: '12px', fontWeight: 600, color: STATUS_COLOR[sheet.parseStatus] }}>{STATUS_LABEL[sheet.parseStatus] ?? sheet.parseStatus}</span></td>
                        <td style={s.td}><button onClick={() => { setActiveTab('raw'); setSelectedSheetId(sheet.id) }} style={s.viewBtn}>원문보기</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* Tab: Raw Viewer */}
          {activeTab === 'raw' && (
            <div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
                <label style={{ fontSize: '14px', fontWeight: 600, color: '#555', whiteSpace: 'nowrap' }}>시트 선택:</label>
                <select value={selectedSheetId} onChange={e => setSelectedSheetId(e.target.value)} style={s.filterSelect}>
                  <option value="">-- 시트를 선택하세요 --</option>
                  {sheets.map(sh => <option key={sh.id} value={sh.id}>{sh.sheetIndex + 1}. {sh.sheetName}{sh.discipline ? ` (${sh.discipline})` : ''}{sh.isHidden ? ' [숨김]' : ''}</option>)}
                </select>
                {rawCells && <span style={{ fontSize: '13px', color: '#A0AEC0' }}>{rawCells.length}행 표시 중 (최대 {displayRows}행)</span>}
              </div>
              {!selectedSheetId && <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>위에서 시트를 선택하세요</div>}
              {rawLoading && <div style={{ padding: '40px', textAlign: 'center', color: '#A0AEC0' }}>로딩 중...</div>}
              {!rawLoading && rawCells && (
                <div>
                  <RawSheetGrid cells={rawCells} maxDisplayRows={displayRows} />
                  {rawCells.length > displayRows && (
                    <div style={{ textAlign: 'center', padding: '16px' }}>
                      <button onClick={() => setDisplayRows(d => d + 500)} style={s.loadMoreBtn}>더 보기 ({rawCells.length - displayRows}행 남음)</button>
                    </div>
                  )}
                </div>
              )}
              {!rawLoading && selectedSheetId && !rawCells && <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>원문 데이터가 없습니다. 재파싱을 시도하세요.</div>}
            </div>
          )}

          {/* Tab: Parse Review */}
          {activeTab === 'review' && <ParseReviewTab docId={docId} sheets={sheets} />}

          {/* Tab: Material Aggregate */}
          {activeTab === 'aggregate' && <MaterialAggregateTab docId={docId} />}

        </div>
      </main>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  layout: { display: 'flex', minHeight: '100vh', background: '#1B2838' },
  sidebar: { width: '220px', background: '#141E2A', padding: '24px 0', flexShrink: 0, display: 'flex', flexDirection: 'column' },
  sidebarTitle: { color: 'white', fontSize: '16px', fontWeight: 700, padding: '0 20px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)' },
  navSection: { color: 'rgba(255,255,255,0.4)', fontSize: '11px', padding: '16px 20px 8px', textTransform: 'uppercase', letterSpacing: '1px' },
  navItem: { display: 'block', color: 'rgba(255,255,255,0.8)', padding: '10px 20px', fontSize: '14px', textDecoration: 'none' },
  navItemActive: { display: 'block', color: 'white', padding: '10px 20px', fontSize: '14px', textDecoration: 'none', background: 'rgba(244,121,32,0.15)', borderLeft: '3px solid #F47920' },
  logoutBtn: { margin: '24px 20px 0', padding: '10px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '13px' },
  main: { flex: 1, padding: '32px', minWidth: 0 },
  secondaryBtn: { padding: '8px 16px', background: '#f3e5f5', color: '#7b1fa2', border: '1px solid #ce93d8', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '10px 12px', fontSize: '12px', color: '#A0AEC0', borderBottom: '2px solid rgba(91,164,217,0.2)', whiteSpace: 'nowrap' },
  td: { padding: '10px 12px', fontSize: '13px', borderBottom: '1px solid rgba(91,164,217,0.1)', verticalAlign: 'top' },
  tr: {},
  filterSelect: { padding: '7px 12px', border: '1px solid rgba(91,164,217,0.3)', borderRadius: '6px', fontSize: '13px', background: '#1E3048', color: '#E2E8F0' },
  viewBtn: { padding: '4px 10px', background: '#e8f5e9', color: '#2e7d32', border: '1px solid #a5d6a7', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 },
  loadMoreBtn: { padding: '8px 20px', background: 'rgba(91,164,217,0.1)', color: '#A0AEC0', border: '1px solid rgba(91,164,217,0.3)', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' },
  pageBtn: { padding: '6px 14px', background: 'rgba(91,164,217,0.1)', color: '#A0AEC0', border: '1px solid rgba(91,164,217,0.3)', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' },
  input: { width: '100%', padding: '7px 10px', border: '1px solid rgba(91,164,217,0.3)', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' },
  toolbarBtn: { padding: '6px 14px', background: 'rgba(244,121,32,0.12)', color: '#F47920', border: '1px solid #90caf9', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 },
}
