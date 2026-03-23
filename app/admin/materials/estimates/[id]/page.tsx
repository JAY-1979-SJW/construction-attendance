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
}
interface AggRow {
  id: string; normalizedItemName: string; normalizedSpec: string | null; normalizedUnit: string | null
  totalQuantity: string; totalAmount: string | null; sourceRowCount: number
  reviewRequired: boolean; discipline: string | null; itemCategory: string | null
}
interface PagedResult { items: BillRow[]; total: number; page: number; totalPages: number }

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

// ─── Sub-components ───────────────────────────────────────────

function RawSheetGrid({ cells, maxDisplayRows }: { cells: CellData[][], maxDisplayRows: number }) {
  if (!cells || cells.length === 0) return <div style={{ padding: '24px', color: '#999', textAlign: 'center' }}>셀 데이터가 없습니다</div>
  return (
    <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '60vh' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: '12px', tableLayout: 'auto', minWidth: '100%' }}>
        <tbody>
          {cells.slice(0, maxDisplayRows).map((row, rowIdx) => (
            <tr key={rowIdx}>
              <td style={{ padding: '2px 6px', border: '1px solid #e0e0e0', background: '#f5f5f5', color: '#999', fontSize: '11px', textAlign: 'right', whiteSpace: 'nowrap', userSelect: 'none', minWidth: '32px', position: 'sticky', left: 0, zIndex: 1 }}>
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

function ParseReviewTab({ docId, sheets }: { docId: string; sheets: SheetSummary[] }) {
  const [sheetId, setSheetId] = useState('')
  const [rowTypeFilter, setRowTypeFilter] = useState('')
  const [reviewOnly, setReviewOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<PagedResult | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchRows = useCallback(() => {
    setLoading(true)
    const p = new URLSearchParams()
    if (sheetId) p.set('sheetId', sheetId)
    if (rowTypeFilter) p.set('rowType', rowTypeFilter)
    if (reviewOnly) p.set('reviewOnly', 'true')
    p.set('page', String(page))
    fetch(`/api/admin/materials/estimates/${docId}/rows?${p}`)
      .then(r => r.json())
      .then(d => { if (d.success) setResult(d.data) })
      .finally(() => setLoading(false))
  }, [docId, sheetId, rowTypeFilter, reviewOnly, page])

  useEffect(() => { setPage(1) }, [sheetId, rowTypeFilter, reviewOnly])
  useEffect(() => { fetchRows() }, [fetchRows])

  const fmt = (v: string | null | undefined) => v || <span style={{ color: '#bbb' }}>-</span>

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
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
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
          <input type="checkbox" checked={reviewOnly} onChange={e => setReviewOnly(e.target.checked)} />
          검토필요만
        </label>
        {result && <span style={{ fontSize: '13px', color: '#888' }}>총 {result.total}행</span>}
      </div>

      {loading ? <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>로딩 중...</div> : (
        <div>
          <div style={{ overflowX: 'auto' }}>
            <table style={s.table}>
              <thead>
                <tr>{['행번호', '시트', '유형', '품명', '규격', '단위', '수량', '금액', '집계', '검토'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {!result || result.items.length === 0 ? (
                  <tr><td colSpan={10} style={{ padding: '32px', textAlign: 'center', color: '#999' }}>데이터가 없습니다</td></tr>
                ) : result.items.map(row => (
                  <tr key={row.id} style={{ background: row.reviewRequired ? '#fff8f0' : 'white' }}>
                    <td style={s.td}><span style={{ color: '#999', fontSize: '12px' }}>{row.rowNo + 1}</span></td>
                    <td style={s.td}><span style={{ fontSize: '11px', color: '#888' }}>{row.sheetName}</span></td>
                    <td style={s.td}><RowTypeBadge type={row.rowType} /></td>
                    <td style={{ ...s.td, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.rawItemName ?? ''}>
                      {row.sectionName && <span style={{ fontSize: '10px', color: '#999', display: 'block' }}>{row.sectionName}</span>}
                      {fmt(row.rawItemName)}
                    </td>
                    <td style={{ ...s.td, maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fmt(row.rawSpec)}</td>
                    <td style={s.td}>{fmt(row.rawUnit)}</td>
                    <td style={{ ...s.td, textAlign: 'right' }}>{fmt(row.rawQuantity)}</td>
                    <td style={{ ...s.td, textAlign: 'right' }}>{fmt(row.rawAmount)}</td>
                    <td style={s.td}>
                      {row.aggregateCandidate
                        ? <span style={{ color: '#2e7d32', fontWeight: 700, fontSize: '12px' }}>Y</span>
                        : <span style={{ color: '#bbb', fontSize: '12px' }}>-</span>}
                    </td>
                    <td style={s.td}>
                      {row.reviewRequired && (
                        <span style={{ fontSize: '11px', color: '#e65100', fontWeight: 600 }} title={row.reviewReasonsJson ?? ''}>
                          {(() => { try { return (JSON.parse(row.reviewReasonsJson ?? '[]') as string[]).join(', ') } catch { return '검토' } })()}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
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

function MaterialAggregateTab({ docId }: { docId: string }) {
  const [reviewOnly, setReviewOnly] = useState(false)
  const [items, setItems] = useState<AggRow[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedAgg, setSelectedAgg] = useState<AggRow | null>(null)
  const [sourceRows, setSourceRows] = useState<BillRow[]>([])
  const [sourceLoading, setSourceLoading] = useState(false)

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
    setSourceLoading(true)
    fetch(`/api/admin/materials/estimates/${docId}/aggregate/${agg.id}/sources`)
      .then(r => r.json())
      .then(d => { if (d.success) setSourceRows(d.data) })
      .finally(() => setSourceLoading(false))
  }

  const fmtNum = (v: string | null) => {
    if (!v) return '-'
    const n = parseFloat(v)
    return isNaN(n) ? v : n.toLocaleString('ko-KR', { maximumFractionDigits: 4 })
  }

  const reviewCount = items.filter(i => i.reviewRequired).length

  return (
    <div style={{ display: 'flex', gap: '24px' }}>
      {/* Aggregate list */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
            <input type="checkbox" checked={reviewOnly} onChange={e => setReviewOnly(e.target.checked)} />
            검토필요만
          </label>
          <span style={{ fontSize: '13px', color: '#888' }}>
            총 {items.length}건 {reviewCount > 0 && <span style={{ color: '#e65100' }}>/ 검토 {reviewCount}건</span>}
          </span>
        </div>

        {loading ? <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>로딩 중...</div> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={s.table}>
              <thead>
                <tr>{['품명', '규격', '단위', '총수량', '총금액', '출처', '검토'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: '#999' }}>
                    집계 결과가 없습니다. 재파싱을 실행하세요.
                  </td></tr>
                ) : items.map(row => (
                  <tr key={row.id}
                    onClick={() => handleRowClick(row)}
                    style={{ cursor: 'pointer', background: selectedAgg?.id === row.id ? '#e3f2fd' : row.reviewRequired ? '#fff8f0' : 'white' }}>
                    <td style={{ ...s.td, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <strong>{row.normalizedItemName}</strong>
                    </td>
                    <td style={{ ...s.td, maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '12px', color: '#666' }}>
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
                      {row.reviewRequired && <span style={{ fontSize: '12px', color: '#e65100', fontWeight: 700 }}>검토</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Source rows drill-down */}
      {selectedAgg && (
        <div style={{ width: '420px', flexShrink: 0, background: '#f8faff', borderRadius: '8px', padding: '16px', border: '1px solid #e3f2fd' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px' }}>{selectedAgg.normalizedItemName}</div>
              <div style={{ fontSize: '12px', color: '#888' }}>{selectedAgg.normalizedSpec} / {selectedAgg.normalizedUnit}</div>
            </div>
            <button onClick={() => setSelectedAgg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '18px' }}>×</button>
          </div>
          {sourceLoading ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>로딩 중...</div>
          ) : (
            <div>
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>출처 행 {sourceRows.length}건</div>
              {sourceRows.map(row => (
                <div key={row.id} style={{ padding: '8px 10px', marginBottom: '6px', background: 'white', borderRadius: '6px', border: row.reviewRequired ? '1px solid #ffccbc' : '1px solid #e0e0e0', fontSize: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: '#888' }}>{row.sheetName} 행 {row.rowNo + 1}</span>
                    {row.reviewRequired && <span style={{ color: '#e65100', fontWeight: 600 }}>검토</span>}
                  </div>
                  <div style={{ color: '#333' }}>{row.rawItemName} {row.rawSpec && <span style={{ color: '#888' }}>/ {row.rawSpec}</span>}</div>
                  <div style={{ color: '#555', marginTop: '2px' }}>
                    {row.rawUnit && <span>단위: {row.rawUnit} </span>}
                    {row.rawQuantity && <span>수량: {row.rawQuantity} </span>}
                    {row.rawAmount && <span>금액: {row.rawAmount}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', fontSize: '14px', color: '#888' }}>
          <Link href="/admin/materials" style={{ color: '#1976d2', textDecoration: 'none' }}>자재관리</Link>
          <span>/</span>
          <span style={{ color: '#333' }}>{doc.fileName}</span>
        </div>

        {/* Header card */}
        <div style={{ background: 'white', borderRadius: '10px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '24px' }}>
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
              {doc.notes && <div style={{ marginTop: '8px', fontSize: '13px', color: '#888' }}>{doc.notes}</div>}
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

        <div style={{ background: 'white', borderRadius: '0 0 10px 10px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>

          {/* Tab: Sheet List */}
          {activeTab === 'sheets' && (
            sheetsLoading ? <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>로딩 중...</div> : (
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
                        <td style={s.td}><span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '10px', background: '#e3f2fd', color: '#1565c0' }}>{SHEET_TYPE_LABEL[sheet.sheetType] ?? sheet.sheetType}</span></td>
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
                {rawCells && <span style={{ fontSize: '13px', color: '#888' }}>{rawCells.length}행 표시 중 (최대 {displayRows}행)</span>}
              </div>
              {!selectedSheetId && <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>위에서 시트를 선택하세요</div>}
              {rawLoading && <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>로딩 중...</div>}
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
  layout: { display: 'flex', minHeight: '100vh', background: '#f5f5f5' },
  sidebar: { width: '220px', background: '#1a1a2e', padding: '24px 0', flexShrink: 0, display: 'flex', flexDirection: 'column' },
  sidebarTitle: { color: 'white', fontSize: '16px', fontWeight: 700, padding: '0 20px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)' },
  navSection: { color: 'rgba(255,255,255,0.4)', fontSize: '11px', padding: '16px 20px 8px', textTransform: 'uppercase', letterSpacing: '1px' },
  navItem: { display: 'block', color: 'rgba(255,255,255,0.8)', padding: '10px 20px', fontSize: '14px', textDecoration: 'none' },
  navItemActive: { display: 'block', color: 'white', padding: '10px 20px', fontSize: '14px', textDecoration: 'none', background: 'rgba(255,255,255,0.12)', borderLeft: '3px solid #90caf9' },
  logoutBtn: { margin: '24px 20px 0', padding: '10px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '13px' },
  main: { flex: 1, padding: '32px', minWidth: 0 },
  secondaryBtn: { padding: '8px 16px', background: '#f3e5f5', color: '#7b1fa2', border: '1px solid #ce93d8', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '10px 12px', fontSize: '12px', color: '#888', borderBottom: '2px solid #f0f0f0', whiteSpace: 'nowrap' },
  td: { padding: '10px 12px', fontSize: '13px', borderBottom: '1px solid #f5f5f5', verticalAlign: 'top' },
  tr: {},
  filterSelect: { padding: '7px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '13px', background: 'white' },
  viewBtn: { padding: '4px 10px', background: '#e8f5e9', color: '#2e7d32', border: '1px solid #a5d6a7', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 },
  loadMoreBtn: { padding: '8px 20px', background: '#f5f5f5', color: '#555', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' },
  pageBtn: { padding: '6px 14px', background: '#f5f5f5', color: '#555', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' },
}
