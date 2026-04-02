'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { MobileCardList, MobileCard, MobileCardField, MobileCardFields, MobileCardActions } from '@/components/admin/ui'

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
  if (!cells || cells.length === 0) return <div className="py-6 text-[#718096] text-center">셀 데이터가 없습니다</div>
  return (
    <div className="hidden sm:block overflow-x-auto overflow-y-auto max-h-[60vh]">
      <table className="border-collapse text-[12px]" style={{ tableLayout: 'auto', minWidth: '100%' }}>
        <tbody>
          {cells.slice(0, maxDisplayRows).map((row, rowIdx) => (
            <tr key={rowIdx}>
              <td className="px-[6px] py-[2px] border border-white/[0.12] bg-brand text-[#718096] text-[11px] text-right whitespace-nowrap select-none min-w-[32px] sticky left-0 z-[1]">
                {rowIdx === 0 ? '' : rowIdx}
              </td>
              {row.map((cell, i) => (
                <td key={i} rowSpan={cell.rowspan ?? 1} colSpan={cell.colspan ?? 1}
                  className="px-[6px] py-[3px] border border-white/[0.12] whitespace-nowrap max-w-[240px] overflow-hidden text-ellipsis align-middle"
                  style={{ background: rowIdx === 0 ? '#fafafa' : 'white', fontWeight: rowIdx === 0 ? 600 : 400 }}
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
    <div className="fixed inset-0 bg-black/40 z-[1000] flex items-center justify-center">
      <div className="bg-card rounded-[12px] p-7 w-[520px] max-w-[95vw] shadow-[0_8px_32px_rgba(0,0,0,0.18)]">
        <div className="flex justify-between items-center mb-5">
          <h3 className="m-0 text-base font-bold">행 수동 보정</h3>
          <button onClick={onClose} className="bg-transparent border-0 text-[20px] cursor-pointer text-muted-brand">×</button>
        </div>

        {/* 원문 정보 */}
        <div className="bg-brand rounded-md px-[14px] py-[10px] mb-[18px] text-[12px] text-muted-brand">
          <div className="font-bold mb-1 text-dim-brand">원문 (수정불가)</div>
          <div>품명: {row.rawItemName || '-'} / 규격: {row.rawSpec || '-'} / 단위: {row.rawUnit || '-'} / 수량: {row.rawQuantity || '-'}</div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-[12px] text-muted-brand block mb-1">수동 품명</label>
            <input value={itemName} onChange={e => setItemName(e.target.value)} placeholder={row.normalized?.normalizedItemName ?? row.rawItemName ?? ''} className="w-full px-[10px] py-[7px] border border-[rgba(91,164,217,0.3)] rounded-md text-[13px] bg-brand text-white box-border" />
          </div>
          <div>
            <label className="text-[12px] text-muted-brand block mb-1">수동 규격</label>
            <input value={spec} onChange={e => setSpec(e.target.value)} placeholder={row.normalized?.normalizedSpec ?? row.rawSpec ?? ''} className="w-full px-[10px] py-[7px] border border-[rgba(91,164,217,0.3)] rounded-md text-[13px] bg-brand text-white box-border" />
          </div>
          <div>
            <label className="text-[12px] text-muted-brand block mb-1">수동 단위</label>
            <input value={unit} onChange={e => setUnit(e.target.value)} placeholder={row.normalized?.normalizedUnit ?? row.rawUnit ?? ''} className="w-full px-[10px] py-[7px] border border-[rgba(91,164,217,0.3)] rounded-md text-[13px] bg-brand text-white box-border" />
          </div>
          <div>
            <label className="text-[12px] text-muted-brand block mb-1">수동 수량</label>
            <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder={row.rawQuantity ?? ''} className="w-full px-[10px] py-[7px] border border-[rgba(91,164,217,0.3)] rounded-md text-[13px] bg-brand text-white box-border" />
          </div>
          <div className="col-span-2">
            <label className="text-[12px] text-muted-brand block mb-1">수동 그룹 키 <span className="text-muted-brand font-normal">(같은 값끼리 집계 묶음)</span></label>
            <input value={groupKey} onChange={e => setGroupKey(e.target.value)} placeholder={row.normalized?.groupKey ?? ''} className="w-full px-[10px] py-[7px] border border-[rgba(91,164,217,0.3)] rounded-md text-[13px] bg-brand text-white box-border" />
          </div>
          <div className="col-span-2">
            <label className="text-[12px] text-muted-brand block mb-1">보정 사유</label>
            <input value={reason} onChange={e => setReason(e.target.value)} placeholder="보정 사유 입력 (선택)" className="w-full px-[10px] py-[7px] border border-[rgba(91,164,217,0.3)] rounded-md text-[13px] bg-brand text-white box-border" />
          </div>
        </div>

        {error && <div className="text-[#b71c1c] text-[13px] mb-3">{error}</div>}

        <div className="flex justify-between gap-2">
          <button onClick={handleClearAll} disabled={saving} className="px-[14px] py-2 bg-red-light text-[#b71c1c] border border-[#ef9a9a] rounded-md cursor-pointer text-[13px] font-semibold">
            보정 전체 해제
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} disabled={saving} className="px-4 py-2 bg-[rgba(91,164,217,0.1)] text-muted-brand border border-[rgba(91,164,217,0.3)] rounded-md cursor-pointer text-[13px]">취소</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-brand-accent text-white border-0 rounded-md cursor-pointer text-[13px] font-semibold">
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

  const fmt = (v: string | null | undefined) => v || <span className="text-[#bbb]">-</span>

  return (
    <div>
      {editingRow && (
        <OverrideModal row={editingRow} docId={docId} onClose={() => setEditingRow(null)} onSaved={fetchRows} />
      )}

      {/* Filters */}
      <div className="flex gap-[10px] items-center mb-[14px] flex-wrap">
        <select value={sheetId} onChange={e => setSheetId(e.target.value)} className="px-3 py-[7px] border border-[rgba(91,164,217,0.3)] rounded-md text-[13px] bg-[#1E3048] text-[#E2E8F0]">
          <option value="">전체 시트</option>
          {sheets.map(sh => (
            <option key={sh.id} value={sh.id}>{sh.sheetIndex + 1}. {sh.sheetName}</option>
          ))}
        </select>
        <select value={rowTypeFilter} onChange={e => setRowTypeFilter(e.target.value)} className="px-3 py-[7px] border border-[rgba(91,164,217,0.3)] rounded-md text-[13px] bg-[#1E3048] text-[#E2E8F0]">
          <option value="">전체 행 유형</option>
          {Object.entries(ROW_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {[
          { label: '검토필요', val: reviewOnly, set: setReviewOnly },
          { label: '제외된 행', val: excludedOnly, set: setExcludedOnly },
          { label: '보정된 행', val: overriddenOnly, set: setOverriddenOnly },
          { label: '수동 그룹키', val: hasManualGroupKey, set: setHasManualGroupKey },
        ].map(({ label, val, set }) => (
          <label key={label} className="flex items-center gap-[5px] text-[13px] cursor-pointer whitespace-nowrap">
            <input type="checkbox" checked={val} onChange={e => set(e.target.checked)} />
            {label}
          </label>
        ))}
        {result && <span className="text-[13px] text-muted-brand">총 {result.total}행</span>}
      </div>

      {loading ? <div className="py-10 text-center text-muted-brand">로딩 중...</div> : (
        <div>
          {/* 모바일 카드 */}
          <div className="sm:hidden">
            {!result || result.items.length === 0 ? (
              <div className="py-8 text-center text-[#999]">데이터가 없습니다</div>
            ) : (
              <MobileCardList
                items={result.items}
                renderCard={(row) => {
                  const isExcluded = row.excludeFromAggregation
                  const isOverridden = !!row.overriddenAt
                  return (
                    <MobileCard
                      title={isOverridden && row.manualItemName ? row.manualItemName : (row.rawItemName ?? '-')}
                      subtitle={row.sheetName}
                      badge={ROW_TYPE_LABEL[row.rowType] ?? row.rowType}
                      style={{ opacity: isExcluded ? 0.6 : 1 }}
                    >
                      <MobileCardFields>
                        <MobileCardField label="행번호" value={String(row.rowNo + 1)} />
                        <MobileCardField label="규격" value={isOverridden && row.manualSpec ? row.manualSpec : (row.rawSpec ?? '-')} />
                        <MobileCardField label="단위" value={isOverridden && row.manualUnit ? row.manualUnit : (row.rawUnit ?? '-')} />
                        <MobileCardField label="수량" value={isOverridden && row.manualQuantity ? row.manualQuantity : (row.rawQuantity ?? '-')} />
                        <MobileCardField label="그룹키" value={row.manualGroupKey ?? row.normalized?.groupKey ?? '-'} />
                      </MobileCardFields>
                      {isExcluded && <div className="text-[11px] text-[#b71c1c] font-bold mt-1">집계 제외됨</div>}
                      {isOverridden && <div className="text-[11px] text-secondary-brand font-semibold mt-1">보정됨{row.overrideReason ? ` — ${row.overrideReason}` : ''}</div>}
                      {row.reviewRequired && <div className="text-[11px] text-accent-hover mt-1">검토 필요</div>}
                      <MobileCardActions>
                        <button
                          onClick={() => handleToggleExclude(row)}
                          disabled={togglingId === row.id}
                          style={{ padding: '4px 10px', fontSize: '12px', fontWeight: 600, borderRadius: '4px', cursor: 'pointer', border: isExcluded ? '1px solid #a5d6a7' : '1px solid #ef9a9a', background: isExcluded ? '#e8f5e9' : '#ffebee', color: isExcluded ? '#2e7d32' : '#b71c1c' }}>
                          {isExcluded ? '제외해제' : '제외'}
                        </button>
                        <button
                          onClick={() => setEditingRow(row)}
                          className="px-3 py-[4px] text-[12px] font-semibold rounded cursor-pointer border border-[#F47920] bg-[rgba(244,121,32,0.12)] text-accent">
                          보정
                        </button>
                      </MobileCardActions>
                    </MobileCard>
                  )
                }}
              />
            )}
          </div>
          {/* 데스크탑 테이블 */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {['행번호', '시트', '유형', '품명', '규격', '단위', '수량', '집계', '보정', '자동 그룹키', '수동 그룹키', '상태', '액션'].map(h => (
                    <th key={h} className="text-left px-3 py-[10px] text-[12px] text-muted-brand border-b-2 border-[rgba(91,164,217,0.2)] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!result || result.items.length === 0 ? (
                  <tr><td colSpan={13} className="py-8 text-center text-[#999]">데이터가 없습니다</td></tr>
                ) : result.items.map(row => {
                  const isExcluded = row.excludeFromAggregation
                  const isOverridden = !!row.overriddenAt
                  const rowBg = isExcluded ? '#fafafa' : row.reviewRequired ? '#fff8f0' : 'white'
                  return (
                    <tr key={row.id} style={{ background: rowBg, opacity: isExcluded ? 0.6 : 1 }}>
                      <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.1)] align-top"><span className="text-[#718096] text-[12px]">{row.rowNo + 1}</span></td>
                      <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.1)] align-top"><span className="text-[11px] text-muted-brand">{row.sheetName}</span></td>
                      <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.1)] align-top"><RowTypeBadge type={row.rowType} /></td>
                      <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.1)] align-top max-w-[160px] overflow-hidden text-ellipsis whitespace-nowrap">
                        {row.sectionName && <span className="text-[11px] text-[#718096] block">{row.sectionName}</span>}
                        {isOverridden && row.manualItemName
                          ? <><span className="text-secondary-brand font-semibold">{row.manualItemName}</span><span className="text-[11px] text-[#bbb] ml-1">({row.rawItemName})</span></>
                          : fmt(row.rawItemName)}
                      </td>
                      <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.1)] align-top max-w-[100px] overflow-hidden text-ellipsis whitespace-nowrap text-[12px]">
                        {isOverridden && row.manualSpec ? <span className="text-secondary-brand">{row.manualSpec}</span> : fmt(row.rawSpec)}
                      </td>
                      <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.1)] align-top">
                        {isOverridden && row.manualUnit ? <span className="text-secondary-brand">{row.manualUnit}</span> : fmt(row.rawUnit)}
                      </td>
                      <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.1)] align-top text-right text-[12px]">
                        {isOverridden && row.manualQuantity ? <span className="text-secondary-brand">{row.manualQuantity}</span> : fmt(row.rawQuantity)}
                      </td>
                      <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.1)] align-top">
                        {row.aggregateCandidate
                          ? <span className="text-[#2e7d32] font-bold text-[12px]">Y</span>
                          : <span className="text-[#bbb] text-[12px]">-</span>}
                      </td>
                      <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.1)] align-top">
                        {isOverridden
                          ? <span className="text-[11px] text-secondary-brand font-semibold" title={row.overrideReason ?? ''}>보정됨</span>
                          : <span className="text-[#bbb] text-[12px]">-</span>}
                      </td>
                      <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.1)] align-top max-w-[120px] overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-muted-brand">
                        {row.normalized?.groupKey ?? '-'}
                      </td>
                      <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.1)] align-top max-w-[120px] overflow-hidden text-ellipsis whitespace-nowrap text-[11px]">
                        {row.manualGroupKey
                          ? <span className="text-[#7b1fa2] font-bold">{row.manualGroupKey}</span>
                          : <span className="text-[#bbb]">-</span>}
                      </td>
                      <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.1)] align-top">
                        {isExcluded
                          ? <span className="text-[11px] px-[6px] py-[2px] rounded-[8px] bg-red-light text-[#b71c1c] font-bold">제외</span>
                          : row.reviewRequired
                            ? <span className="text-[11px] text-accent-hover">검토</span>
                            : null}
                      </td>
                      <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.1)] align-top whitespace-nowrap">
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleToggleExclude(row)}
                            disabled={togglingId === row.id}
                            style={{ padding: '3px 8px', fontSize: '11px', fontWeight: 600, borderRadius: '4px', cursor: 'pointer', border: isExcluded ? '1px solid #a5d6a7' : '1px solid #ef9a9a', background: isExcluded ? '#e8f5e9' : '#ffebee', color: isExcluded ? '#2e7d32' : '#b71c1c' }}>
                            {isExcluded ? '제외해제' : '제외'}
                          </button>
                          <button
                            onClick={() => setEditingRow(row)}
                            className="px-2 py-[3px] text-[11px] font-semibold rounded cursor-pointer border border-[#F47920] bg-[rgba(244,121,32,0.12)] text-accent">
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
          </div>
          {result && result.totalPages > 1 && (
            <div className="flex gap-2 justify-center mt-4 items-center">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-[14px] py-[6px] bg-[rgba(91,164,217,0.1)] text-muted-brand border border-[rgba(91,164,217,0.3)] rounded-md cursor-pointer text-[13px]">이전</button>
              <span className="text-[13px] text-muted-brand">{page} / {result.totalPages}</span>
              <button onClick={() => setPage(p => Math.min(result.totalPages, p + 1))} disabled={page === result.totalPages} className="px-[14px] py-[6px] bg-[rgba(91,164,217,0.1)] text-muted-brand border border-[rgba(91,164,217,0.3)] rounded-md cursor-pointer text-[13px]">다음</button>
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
      <div className="flex gap-[10px] items-center mb-4 flex-wrap px-4 py-3 bg-brand rounded-lg border border-brand">
        <button
          onClick={handleRebuild}
          disabled={rebuilding}
          className="px-4 py-2 bg-[#7b1fa2] text-white border-0 rounded-md cursor-pointer text-[13px] font-bold">
          {rebuilding ? '재집계 중...' : '보정 반영 재집계'}
        </button>
        <button onClick={() => handleBulkStatus('REVIEWED')} disabled={statusChanging} className="px-[14px] py-[6px] bg-[rgba(244,121,32,0.12)] text-accent border border-[#90caf9] rounded-md cursor-pointer text-[13px] font-semibold">검토완료</button>
        <button onClick={() => handleBulkStatus('CONFIRMED')} disabled={statusChanging} className="px-[14px] py-[6px] bg-green-light text-[#2e7d32] border border-[#a5d6a7] rounded-md cursor-pointer text-[13px] font-semibold">전체 확정</button>
        <button onClick={() => handleBulkStatus('DRAFT')} disabled={statusChanging} className="px-[14px] py-[6px] bg-[#fff3e0] text-accent-hover border border-[#ffcc80] rounded-md cursor-pointer text-[13px] font-semibold">확정 해제</button>
        <label className="flex items-center gap-[5px] text-[13px] cursor-pointer ml-2">
          <input type="checkbox" checked={reviewOnly} onChange={e => setReviewOnly(e.target.checked)} />
          검토필요만
        </label>
        <span className="text-[13px] text-muted-brand ml-2">
          총 {items.length}건
          {reviewCount > 0 && <span className="text-accent-hover"> / 검토 {reviewCount}건</span>}
          {confirmedCount > 0 && <span className="text-[#2e7d32]"> / 확정 {confirmedCount}건</span>}
          {overrideCount > 0 && <span className="text-[#7b1fa2]"> / 보정 {overrideCount}건</span>}
        </span>
        {rebuildMsg && (
          <span className="text-[13px] font-semibold" style={{ color: rebuildMsg.startsWith('오류') ? '#b71c1c' : '#2e7d32' }}>{rebuildMsg}</span>
        )}
      </div>

      {isAllConfirmed && (
        <div className="px-4 py-[10px] bg-green-light rounded-md mb-[14px] text-[13px] text-[#2e7d32] font-semibold border border-[#a5d6a7]">
          모든 집계가 확정 상태입니다. 수정하려면 "확정 해제"를 클릭하세요.
        </div>
      )}

      <div className="flex gap-6">
        {/* Aggregate list */}
        <div className="flex-1 min-w-0">
          {loading ? <div className="py-10 text-center text-muted-brand">로딩 중...</div> : (
            <>
            {/* 모바일 카드 */}
            <div className="sm:hidden">
              {items.length === 0 ? (
                <div className="py-8 text-center text-[#999]">집계 결과가 없습니다. 재집계를 실행하세요.</div>
              ) : (
                <MobileCardList
                  items={items}
                  renderCard={(row) => {
                    const isConfirmed = row.aggregationStatus === 'CONFIRMED'
                    return (
                      <MobileCard
                        title={row.normalizedItemName}
                        subtitle={row.normalizedSpec ?? undefined}
                        badge={AGG_STATUS_LABEL[row.aggregationStatus] ?? row.aggregationStatus}
                        style={{ background: selectedAgg?.id === row.id ? 'rgba(25,118,210,0.12)' : undefined }}
                      >
                        <MobileCardFields>
                          <MobileCardField label="단위" value={row.normalizedUnit ?? '-'} />
                          <MobileCardField label="총수량" value={fmtNum(row.totalQuantity)} />
                          <MobileCardField label="총금액" value={fmtNum(row.totalAmount)} />
                          <MobileCardField label="출처행" value={`${row.sourceRowCount}행`} />
                        </MobileCardFields>
                        {row.manualOverrideUsed && <div className="text-[11px] text-[#7b1fa2] font-bold mt-1">보정 사용됨</div>}
                        {row.reviewRequired && <div className="text-[11px] text-accent-hover mt-1">검토 필요</div>}
                        <MobileCardActions>
                          <button onClick={() => handleRowClick(row)} className="px-3 py-[5px] text-[12px] font-semibold rounded cursor-pointer border border-[rgba(91,164,217,0.3)] bg-brand text-muted-brand">출처보기</button>
                          {!isConfirmed ? (
                            <>
                              <button onClick={() => handleSingleStatus(row, 'REVIEWED')} className="px-3 py-[5px] text-[12px] rounded cursor-pointer border border-[#F47920] bg-[rgba(244,121,32,0.12)] text-accent font-semibold">검토</button>
                              <button onClick={() => handleSingleStatus(row, 'CONFIRMED')} className="px-3 py-[5px] text-[12px] rounded cursor-pointer border border-[#a5d6a7] bg-green-light text-[#2e7d32] font-semibold">확정</button>
                            </>
                          ) : (
                            <button onClick={() => handleSingleStatus(row, 'REVIEWED')} className="px-3 py-[5px] text-[12px] rounded cursor-pointer border border-[#ffcc80] bg-[#fff3e0] text-accent-hover">해제</button>
                          )}
                        </MobileCardActions>
                      </MobileCard>
                    )
                  }}
                />
              )}
            </div>
            {/* 데스크탑 테이블 */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>{['상태', '품명', '규격', '단위', '총수량', '총금액', '출처', '보정', '검토', '액션'].map(h => (
                    <th key={h} className="text-left px-3 py-[10px] text-[12px] text-muted-brand border-b-2 border-[rgba(91,164,217,0.2)] whitespace-nowrap">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={10} className="py-8 text-center text-[#999]">
                      집계 결과가 없습니다. 재집계를 실행하세요.
                    </td></tr>
                  ) : items.map(row => {
                    const isConfirmed = row.aggregationStatus === 'CONFIRMED'
                    return (
                      <tr key={row.id}
                        onClick={() => handleRowClick(row)}
                        style={{ cursor: 'pointer', background: selectedAgg?.id === row.id ? '#e3f2fd' : row.reviewRequired ? '#fff8f0' : 'white' }}>
                        <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.1)] align-top" onClick={e => e.stopPropagation()}>
                          <AggStatusBadge status={row.aggregationStatus} />
                        </td>
                        <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.1)] align-top max-w-[180px] overflow-hidden text-ellipsis whitespace-nowrap">
                          <strong>{row.normalizedItemName}</strong>
                          {row.manualOverrideUsed && <span className="ml-1 text-[11px] text-[#7b1fa2] font-bold">보정</span>}
                        </td>
                        <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.1)] align-top max-w-[100px] overflow-hidden text-ellipsis whitespace-nowrap text-[12px] text-muted-brand">
                          {row.normalizedSpec || '-'}
                        </td>
                        <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.1)] align-top">{row.normalizedUnit || '-'}</td>
                        <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.1)] align-top text-right">{fmtNum(row.totalQuantity)}</td>
                        <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.1)] align-top text-right">{fmtNum(row.totalAmount)}</td>
                        <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.1)] align-top text-center">
                          <span className="text-[12px] px-2 py-[1px] rounded-[10px] bg-green-light text-[#2e7d32] font-semibold">
                            {row.sourceRowCount}행
                          </span>
                        </td>
                        <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.1)] align-top">
                          {row.manualOverrideUsed
                            ? <span className="text-[11px] text-[#7b1fa2] font-bold">Y</span>
                            : <span className="text-[#bbb] text-[11px]">-</span>}
                        </td>
                        <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.1)] align-top">
                          {row.reviewRequired && <span className="text-[12px] text-accent-hover font-bold">검토</span>}
                        </td>
                        <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.1)] align-top whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          {!isConfirmed ? (
                            <div className="flex gap-1">
                              <button onClick={() => handleSingleStatus(row, 'REVIEWED')} className="px-[7px] py-[2px] text-[11px] rounded cursor-pointer border border-[#F47920] bg-[rgba(244,121,32,0.12)] text-accent">검토</button>
                              <button onClick={() => handleSingleStatus(row, 'CONFIRMED')} className="px-[7px] py-[2px] text-[11px] rounded cursor-pointer border border-[#a5d6a7] bg-green-light text-[#2e7d32]">확정</button>
                            </div>
                          ) : (
                            <button onClick={() => handleSingleStatus(row, 'REVIEWED')} className="px-[7px] py-[2px] text-[11px] rounded cursor-pointer border border-[#ffcc80] bg-[#fff3e0] text-accent-hover">해제</button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>

        {/* Source rows drill-down */}
        {selectedAgg && (
          <div className="w-[440px] shrink-0 bg-[#f8faff] rounded-lg p-4 border border-[#e3f2fd]">
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="font-bold text-sm">{selectedAgg.normalizedItemName}</div>
                <div className="text-[12px] text-muted-brand mt-[2px]">{selectedAgg.normalizedSpec || '-'} / {selectedAgg.normalizedUnit || '-'}</div>
                <div className="mt-[6px] flex gap-[6px] items-center">
                  <AggStatusBadge status={selectedAgg.aggregationStatus} />
                  {selectedAgg.manualOverrideUsed && <span className="text-[11px] text-[#7b1fa2] font-bold">보정 사용됨</span>}
                </div>
                <div className="text-[11px] text-muted-brand mt-1">
                  그룹키: <code className="text-[11px] bg-brand px-1 rounded">{selectedAgg.groupKey}</code>
                </div>
                {selectedAgg.regeneratedAt && (
                  <div className="text-[11px] text-muted-brand mt-[2px]">
                    재집계: {new Date(selectedAgg.regeneratedAt).toLocaleString('ko-KR')}
                  </div>
                )}
                {selectedAgg.confirmedAt && (
                  <div className="text-[11px] text-[#2e7d32] mt-[2px]">
                    확정: {new Date(selectedAgg.confirmedAt).toLocaleString('ko-KR')} ({selectedAgg.confirmedBy})
                  </div>
                )}
              </div>
              <button onClick={() => setSelectedAgg(null)} className="bg-transparent border-0 cursor-pointer text-muted-brand text-[18px] px-1">×</button>
            </div>

            {sourceLoading ? (
              <div className="py-5 text-center text-muted-brand">로딩 중...</div>
            ) : (
              <div>
                <div className="text-[12px] text-muted-brand mb-2">출처 행 {sourceRows.length}건</div>
                {sourceRows.map(row => {
                  const isOverridden = !!row.overriddenAt
                  const isExcluded = row.excludeFromAggregation
                  return (
                    <div key={row.id} className="px-3 py-[10px] mb-2 bg-[#1E3350] rounded-md text-[12px]"
                      style={{ border: isExcluded ? '1px solid #ef9a9a' : isOverridden ? '1px solid #90caf9' : '1px solid #e0e0e0' }}>
                      <div className="flex justify-between mb-1">
                        <span className="text-muted-brand">{row.sheetName} 행 {row.rowNo + 1}</span>
                        <div className="flex gap-1 items-center">
                          {isExcluded && <span className="text-[#b71c1c] font-bold text-[11px]">제외</span>}
                          {isOverridden && <span className="text-secondary-brand font-bold text-[11px]">보정</span>}
                          {row.reviewRequired && <span className="text-accent-hover font-semibold text-[11px]">검토</span>}
                        </div>
                      </div>
                      {/* 원문 vs 보정값 비교 */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] mb-[6px]">
                        <div className="text-muted-brand">
                          <div>원문 품명: {row.rawItemName || '-'}</div>
                          <div>원문 규격: {row.rawSpec || '-'}</div>
                          <div>원문 단위: {row.rawUnit || '-'} / 수량: {row.rawQuantity || '-'}</div>
                        </div>
                        {isOverridden && (
                          <div className="text-secondary-brand">
                            <div>보정 품명: {row.manualItemName || <span className="text-[#bbb]">-</span>}</div>
                            <div>보정 규격: {row.manualSpec || <span className="text-[#bbb]">-</span>}</div>
                            <div>보정 단위: {row.manualUnit || '-'} / 수량: {row.manualQuantity || '-'}</div>
                          </div>
                        )}
                      </div>
                      {row.manualGroupKey && (
                        <div className="text-[11px] mb-1">
                          수동 그룹키: <span className="text-[#7b1fa2] font-bold">{row.manualGroupKey}</span>
                        </div>
                      )}
                      {/* 즉시 액션 */}
                      {selectedAgg.aggregationStatus !== 'CONFIRMED' && (
                        <div className="flex gap-1 mt-[6px]">
                          <button
                            onClick={async () => {
                              await fetch(`/api/admin/materials/estimates/${docId}/rows/${row.id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ excludeFromAggregation: !isExcluded, overrideReason: isExcluded ? '제외 해제' : '집계 제외' }),
                              })
                              handleRowClick(selectedAgg)
                            }}
                            style={{ padding: '2px 8px', fontSize: '11px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, border: isExcluded ? '1px solid #a5d6a7' : '1px solid #ef9a9a', background: isExcluded ? '#e8f5e9' : '#ffebee', color: isExcluded ? '#2e7d32' : '#b71c1c' }}>
                            {isExcluded ? '제외해제' : '제외'}
                          </button>
                          <button
                            onClick={() => setEditingSourceRow(row)}
                            className="px-2 py-[2px] text-[11px] rounded cursor-pointer border border-[#F47920] bg-[rgba(244,121,32,0.12)] text-accent font-semibold">
                            보정편집
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
                {overrides.length > 0 && (
                  <div className="mt-3">
                    <div className="text-[12px] font-bold text-muted-brand mb-[6px]">보정 이력</div>
                    {overrides.map(o => (
                      <div key={o.id} className="text-[11px] text-muted-brand mb-1">
                        {new Date(o.changedAt).toLocaleString('ko-KR')} {o.changedBy} — {o.fieldName}: {o.beforeValue ?? '-'} → {o.afterValue ?? '-'}
                        {o.reason && <span className="text-[#aaa]"> ({o.reason})</span>}
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

  useEffect(() => { fetchDoc() }, [fetchDoc])
  useEffect(() => { fetchSheets() }, [fetchSheets])
  useEffect(() => {
    if (activeTab === 'raw' && selectedSheetId) fetchRawSheet(selectedSheetId)
  }, [activeTab, selectedSheetId, fetchRawSheet])
  useEffect(() => {
    if (activeTab === 'raw' && !selectedSheetId && sheets.length > 0) setSelectedSheetId(sheets[0].id)
  }, [activeTab, sheets, selectedSheetId])

  if (loading) return <div className="flex justify-center items-center min-h-screen">로딩 중...</div>
  if (!doc) return <div className="p-10 text-[#b71c1c]">문서를 찾을 수 없습니다</div>

  const tabs = [
    { key: 'sheets', label: `시트 목록 (${sheets.length})` },
    { key: 'raw', label: '시트 원문' },
    { key: 'review', label: '파싱 검토' },
    { key: 'aggregate', label: '자재집계표' },
  ] as const

  return (
    <div className="p-8 min-w-0">
        <div className="flex items-center gap-2 mb-5 text-sm text-muted-brand">
          <Link href="/admin/materials" className="text-secondary-brand no-underline">자재관리</Link>
          <span>/</span>
          <span className="text-dim-brand">{doc.fileName}</span>
        </div>

        {/* Header card */}
        <div className="bg-card rounded-[12px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)] mb-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-[20px] font-bold m-0 mb-2">{doc.fileName}</h1>
              <div className="flex gap-4 flex-wrap text-sm text-muted-brand">
                {doc.site && <span>현장: <strong>{doc.site.name}</strong></span>}
                <span>유형: <strong>{DOC_TYPE_LABEL[doc.documentType] ?? doc.documentType}</strong></span>
                <span>업로드: {new Date(doc.uploadedAt).toLocaleDateString('ko-KR')}</span>
                <span>버전: v{doc.parseVersion}</span>
                <span>시트: <strong>{doc.sheetCount}</strong></span>
              </div>
              {doc.notes && <div className="mt-2 text-[13px] text-muted-brand">{doc.notes}</div>}
              {doc.errorMessage && (
                <div className="mt-2 px-3 py-2 bg-red-light rounded-md text-[#b71c1c] text-[13px]">
                  오류: {doc.errorMessage}
                </div>
              )}
            </div>
            <div className="flex gap-3 items-center">
              <span className="px-[14px] py-1 rounded-[20px] text-[13px] font-semibold"
                style={{ background: `${STATUS_COLOR[doc.parseStatus]}20`, color: STATUS_COLOR[doc.parseStatus] }}>
                {STATUS_LABEL[doc.parseStatus] ?? doc.parseStatus}
              </span>
              <button onClick={handleReparse} className="px-4 py-2 bg-[#f3e5f5] text-[#7b1fa2] border border-[#ce93d8] rounded-md cursor-pointer text-[13px] font-semibold">재파싱</button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b-2 border-brand">
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '12px 20px', border: 'none', background: 'none', fontSize: '14px',
                fontWeight: activeTab === tab.key ? 700 : 400,
                color: activeTab === tab.key ? '#1976d2' : '#666',
                borderBottom: activeTab === tab.key ? '2px solid #1976d2' : '2px solid transparent',
                marginBottom: '-2px', cursor: 'pointer',
              }}>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="bg-card rounded-b-[12px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">

          {/* Tab: Sheet List */}
          {activeTab === 'sheets' && (
            sheetsLoading ? <div className="py-10 text-center text-muted-brand">로딩 중...</div> : (
              <>
              {/* 모바일 카드 */}
              <div className="sm:hidden">
                {sheets.length === 0 ? (
                  <div className="py-8 text-center text-[#999]">파싱 후 시트 목록이 표시됩니다</div>
                ) : (
                  <MobileCardList
                    items={sheets}
                    renderCard={(sheet) => (
                      <MobileCard
                        title={sheet.sheetName}
                        subtitle={SHEET_TYPE_LABEL[sheet.sheetType] ?? sheet.sheetType}
                        badge={STATUS_LABEL[sheet.parseStatus] ?? sheet.parseStatus}
                        style={{ opacity: sheet.isHidden ? 0.6 : 1 }}
                      >
                        <MobileCardFields>
                          <MobileCardField label="#" value={String(sheet.sheetIndex + 1)} />
                          <MobileCardField label="공종" value={sheet.discipline ?? '-'} />
                          <MobileCardField label="행수" value={String(sheet.maxRows)} />
                          <MobileCardField label="열수" value={String(sheet.maxCols)} />
                        </MobileCardFields>
                        {sheet.isHidden && <div className="text-[11px] text-muted-brand mt-1">(숨김 시트)</div>}
                        {sheet.needsReview && <div className="text-[11px] text-accent-hover mt-1">검토필요</div>}
                        <MobileCardActions>
                          <button onClick={() => { setActiveTab('raw'); setSelectedSheetId(sheet.id) }} className="px-3 py-[6px] bg-green-light text-[#2e7d32] border border-[#a5d6a7] rounded cursor-pointer text-[12px] font-semibold">원문보기</button>
                        </MobileCardActions>
                      </MobileCard>
                    )}
                  />
                )}
              </div>
              {/* 데스크탑 테이블 */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead><tr>{['#', '시트명', '유형', '공종', '행수', '열수', '검토필요', '상태', '보기'].map(h => (
                    <th key={h} className="text-left px-3 py-[10px] text-[12px] text-muted-brand border-b-2 border-[rgba(91,164,217,0.2)] whitespace-nowrap">{h}</th>
                  ))}</tr></thead>
                  <tbody>
                    {sheets.length === 0 ? (
                      <tr><td colSpan={9} className="py-8 text-center text-[#999]">파싱 후 시트 목록이 표시됩니다</td></tr>
                    ) : sheets.map(sheet => (
                      <tr key={sheet.id}>
                        <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.1)] align-top">{sheet.sheetIndex + 1}</td>
                        <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.1)] align-top"><strong>{sheet.sheetName}</strong>{sheet.isHidden && <span className="ml-[6px] text-[11px] text-[#999]">(숨김)</span>}</td>
                        <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.1)] align-top"><span className="text-[12px] px-2 py-[2px] rounded-[10px] bg-[rgba(244,121,32,0.12)] text-accent">{SHEET_TYPE_LABEL[sheet.sheetType] ?? sheet.sheetType}</span></td>
                        <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.1)] align-top">{sheet.discipline ?? <span className="text-[#bbb]">-</span>}</td>
                        <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.1)] align-top">{sheet.maxRows}</td>
                        <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.1)] align-top">{sheet.maxCols}</td>
                        <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.1)] align-top">{sheet.needsReview ? <span className="text-[12px] px-2 py-[2px] rounded-[10px] bg-[#fff3e0] text-accent-hover font-semibold">검토필요</span> : <span className="text-[12px] text-[#bbb]">-</span>}</td>
                        <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.1)] align-top"><span className="text-[12px] font-semibold" style={{ color: STATUS_COLOR[sheet.parseStatus] }}>{STATUS_LABEL[sheet.parseStatus] ?? sheet.parseStatus}</span></td>
                        <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.1)] align-top"><button onClick={() => { setActiveTab('raw'); setSelectedSheetId(sheet.id) }} className="px-[10px] py-1 bg-green-light text-[#2e7d32] border border-[#a5d6a7] rounded cursor-pointer text-[12px] font-semibold">원문보기</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            )
          )}

          {/* Tab: Raw Viewer */}
          {activeTab === 'raw' && (
            <div>
              <div className="flex gap-3 items-center mb-4">
                <label className="text-sm font-semibold text-muted-brand whitespace-nowrap">시트 선택:</label>
                <select value={selectedSheetId} onChange={e => setSelectedSheetId(e.target.value)} className="px-3 py-[7px] border border-[rgba(91,164,217,0.3)] rounded-md text-[13px] bg-[#1E3048] text-[#E2E8F0]">
                  <option value="">-- 시트를 선택하세요 --</option>
                  {sheets.map(sh => <option key={sh.id} value={sh.id}>{sh.sheetIndex + 1}. {sh.sheetName}{sh.discipline ? ` (${sh.discipline})` : ''}{sh.isHidden ? ' [숨김]' : ''}</option>)}
                </select>
                {rawCells && <span className="text-[13px] text-muted-brand">{rawCells.length}행 표시 중 (최대 {displayRows}행)</span>}
              </div>
              {!selectedSheetId && <div className="py-10 text-center text-[#999]">위에서 시트를 선택하세요</div>}
              {rawLoading && <div className="py-10 text-center text-muted-brand">로딩 중...</div>}
              {!rawLoading && rawCells && (
                <div>
                  <RawSheetGrid cells={rawCells} maxDisplayRows={displayRows} />
                  {rawCells.length > displayRows && (
                    <div className="text-center py-4">
                      <button onClick={() => setDisplayRows(d => d + 500)} className="px-5 py-2 bg-[rgba(91,164,217,0.1)] text-muted-brand border border-[rgba(91,164,217,0.3)] rounded-md cursor-pointer text-[13px]">더 보기 ({rawCells.length - displayRows}행 남음)</button>
                    </div>
                  )}
                </div>
              )}
              {!rawLoading && selectedSheetId && !rawCells && <div className="py-10 text-center text-[#999]">원문 데이터가 없습니다. 재파싱을 시도하세요.</div>}
            </div>
          )}

          {/* Tab: Parse Review */}
          {activeTab === 'review' && <ParseReviewTab docId={docId} sheets={sheets} />}

          {/* Tab: Material Aggregate */}
          {activeTab === 'aggregate' && <MaterialAggregateTab docId={docId} />}

        </div>
    </div>
  )
}
