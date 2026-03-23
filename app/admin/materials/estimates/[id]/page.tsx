'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

// ─── Types ───────────────────────────────────────────────────

interface EstimateDoc {
  id: string
  fileName: string
  fileSize: number | null
  documentType: string
  parseStatus: string
  parseVersion: number
  sheetCount: number
  notes: string | null
  uploadedAt: string
  errorMessage: string | null
  site: { id: string; name: string } | null
}

interface SheetSummary {
  id: string
  sheetName: string
  sheetIndex: number
  sheetType: string
  discipline: string | null
  maxRows: number
  maxCols: number
  isHidden: boolean
  needsReview: boolean
  parseStatus: string
  rowCount: number
}

interface CellData {
  r: number
  c: number
  v: string | number | null
  t?: string
  rowspan?: number
  colspan?: number
}

// ─── Constants ───────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  UPLOADED: '업로드됨', PARSING: '파싱중', PARSED: '완료', REVIEW_REQUIRED: '검토필요', FAILED: '실패',
}
const STATUS_COLOR: Record<string, string> = {
  UPLOADED: '#607d8b', PARSING: '#f9a825', PARSED: '#2e7d32', REVIEW_REQUIRED: '#e65100', FAILED: '#b71c1c',
}
const SHEET_TYPE_LABEL: Record<string, string> = {
  SUMMARY: '총괄/원가계산',
  TRADE_SUMMARY: '공종별 집계표',
  DETAIL_BILL: '내역서',
  UNIT_PRICE: '일위대가',
  PRICE_TABLE: '단가표',
  REFERENCE: '참고/개요',
  UNKNOWN: '미분류',
}
const DOC_TYPE_LABEL: Record<string, string> = {
  ESTIMATE: '내역서', CHANGE_ESTIMATE: '설계변경', UNIT_PRICE_SOURCE: '일위대가', PRICE_TABLE: '단가표', OTHER: '기타',
}

// ─── Raw Grid Component ───────────────────────────────────────

function RawSheetGrid({ cells, maxDisplayRows }: { cells: CellData[][], maxDisplayRows: number }) {
  if (!cells || cells.length === 0) {
    return <div style={{ padding: '24px', color: '#999', textAlign: 'center' }}>셀 데이터가 없습니다</div>
  }

  const displayRows = cells.slice(0, maxDisplayRows)

  return (
    <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '60vh' }}>
      <table style={{
        borderCollapse: 'collapse',
        fontSize: '12px',
        tableLayout: 'auto',
        minWidth: '100%',
      }}>
        <tbody>
          {displayRows.map((row, rowIdx) => (
            <tr key={rowIdx}>
              {/* Row number header */}
              <td style={{
                padding: '2px 6px',
                border: '1px solid #e0e0e0',
                background: '#f5f5f5',
                color: '#999',
                fontSize: '11px',
                textAlign: 'right',
                whiteSpace: 'nowrap',
                userSelect: 'none',
                minWidth: '32px',
                position: 'sticky',
                left: 0,
                zIndex: 1,
              }}>
                {rowIdx === 0 ? '' : rowIdx}
              </td>
              {row.map((cell, cellIdx) => (
                <td
                  key={cellIdx}
                  rowSpan={cell.rowspan ?? 1}
                  colSpan={cell.colspan ?? 1}
                  style={{
                    padding: '3px 6px',
                    border: '1px solid #e0e0e0',
                    whiteSpace: 'nowrap',
                    maxWidth: '240px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    verticalAlign: 'middle',
                    background: rowIdx === 0 ? '#fafafa' : 'white',
                    fontWeight: rowIdx === 0 ? 600 : 400,
                  }}
                  title={cell.v != null ? String(cell.v) : ''}
                >
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

// ─── Main Component ───────────────────────────────────────────

export default function EstimateDetailPage() {
  const router = useRouter()
  const params = useParams()
  const docId = params.id as string

  const [doc, setDoc] = useState<EstimateDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'sheets' | 'raw'>('sheets')

  // Sheets tab state
  const [sheets, setSheets] = useState<SheetSummary[]>([])
  const [sheetsLoading, setSheetsLoading] = useState(false)

  // Raw viewer tab state
  const [selectedSheetId, setSelectedSheetId] = useState<string>('')
  const [rawCells, setRawCells] = useState<CellData[][] | null>(null)
  const [rawLoading, setRawLoading] = useState(false)
  const [displayRows, setDisplayRows] = useState(500)

  const fetchDoc = () => {
    setLoading(true)
    fetch(`/api/admin/materials/estimates/${docId}`)
      .then(r => r.json())
      .then(data => {
        if (!data.success) { router.push('/admin/login'); return }
        setDoc(data.data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  const fetchSheets = () => {
    setSheetsLoading(true)
    fetch(`/api/admin/materials/estimates/${docId}/sheets`)
      .then(r => r.json())
      .then(data => {
        if (data.success) setSheets(data.data)
        setSheetsLoading(false)
      })
      .catch(() => setSheetsLoading(false))
  }

  const fetchRawSheet = (sheetId: string) => {
    if (!sheetId) return
    setRawLoading(true)
    setRawCells(null)
    setDisplayRows(500)
    fetch(`/api/admin/materials/estimates/${docId}/sheets/${sheetId}`)
      .then(r => r.json())
      .then(data => {
        if (data.success && data.data.rawDataJson) {
          try {
            setRawCells(JSON.parse(data.data.rawDataJson))
          } catch {
            setRawCells(null)
          }
        }
        setRawLoading(false)
      })
      .catch(() => setRawLoading(false))
  }

  const handleReparse = async () => {
    await fetch(`/api/admin/materials/estimates/${docId}/parse`, { method: 'POST' })
    setTimeout(() => { fetchDoc(); fetchSheets() }, 1500)
  }

  const handleLogout = () => {
    fetch('/api/admin/auth/logout', { method: 'POST' }).then(() => router.push('/admin/login'))
  }

  useEffect(() => { fetchDoc() }, [docId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { fetchSheets() }, [docId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab === 'raw' && selectedSheetId) {
      fetchRawSheet(selectedSheetId)
    }
  }, [activeTab, selectedSheetId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-select first sheet when switching to raw tab
  useEffect(() => {
    if (activeTab === 'raw' && !selectedSheetId && sheets.length > 0) {
      setSelectedSheetId(sheets[0].id)
    }
  }, [activeTab, sheets]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>로딩 중...</div>
  if (!doc) return <div style={{ padding: '40px', color: '#b71c1c' }}>문서를 찾을 수 없습니다</div>

  return (
    <div style={styles.layout}>
      {/* Sidebar */}
      <nav style={styles.sidebar}>
        <div style={styles.sidebarTitle}>해한 출퇴근</div>
        <div style={styles.navSection}>관리</div>
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
        ].map((item) => (
          <Link key={item.href} href={item.href} style={item.href === '/admin/materials' ? styles.navItemActive : styles.navItem}>{item.label}</Link>
        ))}
        <button onClick={handleLogout} style={styles.logoutBtn}>로그아웃</button>
      </nav>

      {/* Main */}
      <main style={styles.main}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', fontSize: '14px', color: '#888' }}>
          <Link href="/admin/materials" style={{ color: '#1976d2', textDecoration: 'none' }}>자재관리</Link>
          <span>/</span>
          <span style={{ color: '#333' }}>{doc.fileName}</span>
        </div>

        {/* Header */}
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
              <span style={{
                padding: '4px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 600,
                background: `${STATUS_COLOR[doc.parseStatus]}20`,
                color: STATUS_COLOR[doc.parseStatus],
              }}>
                {STATUS_LABEL[doc.parseStatus] ?? doc.parseStatus}
              </span>
              <button onClick={handleReparse} style={styles.secondaryBtn}>재파싱</button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #e0e0e0' }}>
          {[
            { key: 'sheets', label: `시트 목록 (${sheets.length})` },
            { key: 'raw', label: '시트 원문 보기' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as 'sheets' | 'raw')}
              style={{
                padding: '12px 20px',
                border: 'none',
                background: 'none',
                fontSize: '14px',
                fontWeight: activeTab === tab.key ? 700 : 400,
                color: activeTab === tab.key ? '#1976d2' : '#666',
                borderBottom: activeTab === tab.key ? '2px solid #1976d2' : '2px solid transparent',
                marginBottom: '-2px',
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ background: 'white', borderRadius: '0 0 10px 10px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>

          {/* Tab: Sheet List */}
          {activeTab === 'sheets' && (
            <div>
              {sheetsLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>로딩 중...</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        {['#', '시트명', '유형', '공종', '행수', '열수', '검토필요', '상태', '보기'].map(h => (
                          <th key={h} style={styles.th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sheets.length === 0 ? (
                        <tr><td colSpan={9} style={{ padding: '32px', textAlign: 'center', color: '#999' }}>파싱 후 시트 목록이 표시됩니다</td></tr>
                      ) : sheets.map(sheet => (
                        <tr key={sheet.id} style={styles.tr}>
                          <td style={styles.td}>{sheet.sheetIndex + 1}</td>
                          <td style={styles.td}>
                            <strong>{sheet.sheetName}</strong>
                            {sheet.isHidden && <span style={{ marginLeft: '6px', fontSize: '11px', color: '#999' }}>(숨김)</span>}
                          </td>
                          <td style={styles.td}>
                            <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '10px', background: '#e3f2fd', color: '#1565c0' }}>
                              {SHEET_TYPE_LABEL[sheet.sheetType] ?? sheet.sheetType}
                            </span>
                          </td>
                          <td style={styles.td}>{sheet.discipline ?? <span style={{ color: '#bbb' }}>-</span>}</td>
                          <td style={styles.td}>{sheet.maxRows}</td>
                          <td style={styles.td}>{sheet.maxCols}</td>
                          <td style={styles.td}>
                            {sheet.needsReview ? (
                              <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '10px', background: '#fff3e0', color: '#e65100', fontWeight: 600 }}>검토필요</span>
                            ) : (
                              <span style={{ fontSize: '12px', color: '#bbb' }}>-</span>
                            )}
                          </td>
                          <td style={styles.td}>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: STATUS_COLOR[sheet.parseStatus] }}>
                              {STATUS_LABEL[sheet.parseStatus] ?? sheet.parseStatus}
                            </span>
                          </td>
                          <td style={styles.td}>
                            <button
                              onClick={() => { setActiveTab('raw'); setSelectedSheetId(sheet.id) }}
                              style={styles.viewBtn}
                            >
                              원문보기
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab: Raw Sheet Viewer */}
          {activeTab === 'raw' && (
            <div>
              {/* Sheet selector */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
                <label style={{ fontSize: '14px', fontWeight: 600, color: '#555', whiteSpace: 'nowrap' }}>시트 선택:</label>
                <select
                  value={selectedSheetId}
                  onChange={e => setSelectedSheetId(e.target.value)}
                  style={styles.filterSelect}
                >
                  <option value="">-- 시트를 선택하세요 --</option>
                  {sheets.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.sheetIndex + 1}. {s.sheetName}
                      {s.discipline ? ` (${s.discipline})` : ''}
                      {s.isHidden ? ' [숨김]' : ''}
                    </option>
                  ))}
                </select>
                {rawCells && (
                  <span style={{ fontSize: '13px', color: '#888' }}>
                    {rawCells.length}행 표시 중 (최대 {displayRows}행)
                  </span>
                )}
              </div>

              {!selectedSheetId && (
                <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>위에서 시트를 선택하세요</div>
              )}

              {rawLoading && (
                <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>로딩 중...</div>
              )}

              {!rawLoading && rawCells && (
                <div>
                  <RawSheetGrid cells={rawCells} maxDisplayRows={displayRows} />
                  {rawCells.length > displayRows && (
                    <div style={{ textAlign: 'center', padding: '16px' }}>
                      <button
                        onClick={() => setDisplayRows(d => d + 500)}
                        style={styles.loadMoreBtn}
                      >
                        더 보기 ({rawCells.length - displayRows}행 남음)
                      </button>
                    </div>
                  )}
                </div>
              )}

              {!rawLoading && selectedSheetId && !rawCells && (
                <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
                  원문 데이터가 없습니다. 재파싱을 시도하세요.
                </div>
              )}
            </div>
          )}

        </div>
      </main>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
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
}
