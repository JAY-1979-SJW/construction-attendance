'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface FilingExport {
  id: string
  monthKey: string
  exportType: string
  status: string
  rowCount: number
  version: number
  isLatest: boolean
  createdAt: string
}

const EXPORT_TYPES = [
  { value: 'DAILY_WAGE_NTS',         label: '일용근로소득 지급명세 (국세청)' },
  { value: 'BUSINESS_INCOME_NTS',    label: '사업소득 간이지급명세 (국세청)' },
  { value: 'EI_DAILY_REPORT',        label: '고용보험 근로내용확인신고' },
  { value: 'NP_BASE',                label: '국민연금 판정 기초자료' },
  { value: 'HI_BASE',                label: '건강보험 판정 기초자료' },
  { value: 'RETIREMENT_MUTUAL_BASE', label: '퇴직공제 기초자료' },
]

function getMonthKey() {
  const now = new Date(Date.now() + 9 * 3600000)
  return now.toISOString().slice(0, 7)
}

export default function FilingExportsPage() {
  const router = useRouter()
  const [monthKey, setMonthKey]       = useState(getMonthKey())
  const [items, setItems]             = useState<FilingExport[]>([])
  const [loading, setLoading]         = useState(false)
  const [selectedType, setSelectedType] = useState('')
  const [generating, setGenerating]   = useState(false)
  const [msg, setMsg]                 = useState('')
  const [preview, setPreview]         = useState<{ exportId: string; rows: Record<string, unknown>[]; rowCount: number } | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/admin/filing-exports?monthKey=${monthKey}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) { router.push('/admin/login'); return }
        setItems(d.data.items)
        setLoading(false)
      })
  }, [monthKey, router])

  useEffect(() => { load() }, [load])

  const handleGenerate = async () => {
    if (!selectedType) { setMsg('내보내기 유형을 선택하세요'); return }
    setGenerating(true)
    setPreview(null)
    const r = await fetch('/api/admin/filing-exports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monthKey, exportType: selectedType }),
    }).then((r) => r.json())
    setGenerating(false)
    if (r.success) {
      setMsg(`생성 완료 — ${r.data.rowCount}건`)
      setPreview(r.data)
      load()
    } else {
      setMsg('생성 실패: ' + r.message)
    }
  }

  const handleDownload = (id: string) => {
    window.location.href = `/api/admin/filing-exports/${id}/download`
  }

  const fmtDate = (iso: string) => new Date(iso).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })

  // Group items by exportType to determine which is the latest version per type+month
  const latestByTypeMonth = items.reduce<Record<string, string>>((acc, item) => {
    const key = `${item.monthKey}__${item.exportType}`
    if (!acc[key] || new Date(item.createdAt) > new Date(items.find((i) => i.id === acc[key])?.createdAt ?? '')) {
      acc[key] = item.id
    }
    return acc
  }, {})

  return (
    <div style={s.layout}>
      <nav style={s.sidebar}>
        <div style={s.sidebarTitle}>해한 출퇴근</div>
        <div style={s.navSection}>관리</div>
        {NAV_ITEMS.map((item) => (
          <Link key={item.href} href={item.href} style={{ ...s.navItem, ...(item.href === '/admin/filing-exports' ? s.navActive : {}) }}>
            {item.label}
          </Link>
        ))}
        <button onClick={() => fetch('/api/admin/auth/logout', { method: 'POST' }).then(() => router.push('/admin/login'))} style={s.logoutBtn}>로그아웃</button>
      </nav>

      <main style={s.main}>
        <h1 style={s.pageTitle}>신고자료 내보내기</h1>
        <p style={{ fontSize: '13px', color: '#888', margin: '-12px 0 20px' }}>
          근무확정 → 보험판정 → 세금계산 완료 후 내보내기를 실행하세요
        </p>

        {/* 생성 영역 */}
        <div style={s.generateCard}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={s.label}>귀속연월</label>
              <input type="month" value={monthKey} onChange={(e) => setMonthKey(e.target.value)} style={s.input} />
            </div>
            <div>
              <label style={s.label}>자료 유형</label>
              <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} style={{ ...s.input, minWidth: '240px' }}>
                <option value="">유형 선택</option>
                {EXPORT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <button onClick={handleGenerate} disabled={generating} style={{ ...s.btn, background: '#7b1fa2' }}>
              {generating ? '생성 중...' : '기초자료 생성'}
            </button>
          </div>
        </div>

        {msg && <div style={s.msg}>{msg}</div>}

        {/* 미리보기 */}
        {preview && preview.rows.length > 0 && (
          <div style={{ ...s.tableCard, marginBottom: '24px' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '14px' }}>미리보기 (전체 {preview.rowCount}건 중 상위 5건)</span>
              <button onClick={() => handleDownload(preview.exportId)} style={s.btn}>CSV 다운로드</button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={s.table}>
                <thead>
                  <tr>{Object.keys(preview.rows[0]).map((h) => <th key={h} style={s.th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 5).map((row, i) => (
                    <tr key={i} style={s.tr}>
                      {Object.values(row).map((v, j) => (
                        <td key={j} style={s.td}>{String(v ?? '-')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 이력 */}
        <div style={s.tableCard}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', fontWeight: 700, fontSize: '14px' }}>생성 이력</div>
          {loading ? <div style={{ padding: '32px', textAlign: 'center', color: '#999' }}>로딩 중...</div> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={s.table}>
                <thead>
                  <tr>{['귀속연월', '자료유형', '건수', '버전', '생성일시', ''].map((h) => <th key={h} style={s.th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: '#999' }}>이력 없음</td></tr>
                  ) : items.map((item) => {
                    const typeMonthKey = `${item.monthKey}__${item.exportType}`
                    const isLatest = latestByTypeMonth[typeMonthKey] === item.id
                    return (
                      <tr key={item.id} style={s.tr}>
                        <td style={s.td}>{item.monthKey}</td>
                        <td style={s.td}>
                          {EXPORT_TYPES.find((t) => t.value === item.exportType)?.label ?? item.exportType}
                          {!isLatest && (
                            <span style={{ marginLeft: '6px', fontSize: '11px', background: '#fff3e0', color: '#e65100', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                              구버전
                            </span>
                          )}
                        </td>
                        <td style={{ ...s.td, textAlign: 'center' as const }}>{item.rowCount}건</td>
                        <td style={{ ...s.td, textAlign: 'center' as const }}>
                          <span style={{ fontSize: '12px', color: isLatest ? '#2e7d32' : '#9e9e9e', fontWeight: 600 }}>
                            v{item.version ?? 1}
                            {isLatest && <span style={{ marginLeft: '4px', fontSize: '10px', background: '#e8f5e9', color: '#2e7d32', padding: '1px 5px', borderRadius: '3px' }}>최신</span>}
                          </span>
                        </td>
                        <td style={s.td}>{fmtDate(item.createdAt)}</td>
                        <td style={s.td}>
                          <button
                            onClick={() => handleDownload(item.id)}
                            style={{ ...s.btn, padding: '4px 12px', fontSize: '12px', background: isLatest ? '#1976d2' : '#9e9e9e' }}
                          >
                            다운로드
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

const NAV_ITEMS = [
  { href: '/admin',                       label: '대시보드' },
  { href: '/admin/workers',               label: '근로자 관리' },
  { href: '/admin/sites',                 label: '현장 관리' },
  { href: '/admin/attendance',            label: '출퇴근 조회' },
  { href: '/admin/presence-checks',       label: '체류확인 현황' },
  { href: '/admin/presence-report',       label: '체류확인 리포트' },
  { href: '/admin/work-confirmations',    label: '근무확정' },
  { href: '/admin/contracts',             label: '인력/계약 관리' },
  { href: '/admin/insurance-eligibility', label: '보험판정' },
  { href: '/admin/wage-calculations',     label: '세금/노임 계산' },
  { href: '/admin/filing-exports',        label: '신고자료 내보내기' },
  { href: '/admin/retirement-mutual',     label: '퇴직공제' },
  { href: '/admin/labor-cost-summaries',  label: '노무비 집계' },
  { href: '/admin/month-closings',        label: '월마감' },
  { href: '/admin/corrections',           label: '정정 이력' },
  { href: '/admin/exceptions',            label: '예외 승인' },
  { href: '/admin/device-requests',       label: '기기 변경' },
]

const s: Record<string, React.CSSProperties> = {
  layout:       { display: 'flex', minHeight: '100vh', background: '#f5f5f5' },
  sidebar:      { width: '220px', background: '#1a1a2e', padding: '24px 0', flexShrink: 0, display: 'flex', flexDirection: 'column' },
  sidebarTitle: { color: 'white', fontSize: '16px', fontWeight: 700, padding: '0 20px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)' },
  navSection:   { color: 'rgba(255,255,255,0.4)', fontSize: '11px', padding: '16px 20px 8px', textTransform: 'uppercase' as const, letterSpacing: '1px' },
  navItem:      { display: 'block', color: 'rgba(255,255,255,0.8)', padding: '10px 20px', fontSize: '13px', textDecoration: 'none' },
  navActive:    { background: 'rgba(255,255,255,0.1)', color: 'white', fontWeight: 700 },
  logoutBtn:    { margin: '24px 20px 0', padding: '10px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '13px' },
  main:         { flex: 1, padding: '32px', overflow: 'auto' },
  pageTitle:    { fontSize: '24px', fontWeight: 700, margin: '0 0 8px' },
  label:        { display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px', fontWeight: 600 },
  input:        { padding: '8px 10px', border: '1px solid #e0e0e0', borderRadius: '6px', fontSize: '14px', background: 'white' },
  btn:          { padding: '8px 16px', background: '#1976d2', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 },
  msg:          { padding: '12px 16px', background: '#e3f2fd', borderRadius: '8px', marginBottom: '16px', fontSize: '14px', color: '#1565c0' },
  generateCard: { background: 'white', borderRadius: '12px', padding: '24px', marginBottom: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  tableCard:    { background: 'white', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' },
  table:        { width: '100%', borderCollapse: 'collapse' as const },
  th:           { padding: '12px 16px', textAlign: 'left' as const, fontSize: '12px', fontWeight: 600, color: '#666', borderBottom: '1px solid #f0f0f0', whiteSpace: 'nowrap' as const },
  td:           { padding: '12px 16px', fontSize: '13px', color: '#333', borderBottom: '1px solid #f9f9f9', verticalAlign: 'top' as const },
  tr:           { cursor: 'default' },
}
