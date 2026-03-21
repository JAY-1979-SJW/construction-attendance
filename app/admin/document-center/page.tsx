'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const XLSX_SUPPORTED = ['WAGE_LEDGER', 'INSURANCE_REPORT', 'TAX_REPORT', 'RETIREMENT_MUTUAL_SUMMARY', 'SUBCONTRACTOR_SETTLEMENT']

const DOC_TYPES = [
  { value: 'WAGE_LEDGER', label: '노임대장', desc: '근로자별 일별 임금 지급 내역' },
  { value: 'MONTHLY_ATTENDANCE', label: '월 출역표', desc: '근로자별 월간 출역 현황' },
  { value: 'INSURANCE_REPORT', label: '보험판정표', desc: '4대보험 적용/제외 판정 결과' },
  { value: 'TAX_REPORT', label: '세금계산표', desc: '원천세 계산 내역' },
  { value: 'RETIREMENT_MUTUAL_SUMMARY', label: '퇴직공제 요약표', desc: '퇴직공제 인정일수 요약' },
  { value: 'SUBCONTRACTOR_SETTLEMENT', label: '협력사 정산서', desc: '협력사별 노무비 정산 기초자료' },
]

interface Site {
  id: string
  name: string
}

interface PreflightIssue {
  level: 'ERROR' | 'WARNING' | 'INFO'
  message: string
}

interface PreflightResult {
  canDownload: boolean
  errorCount: number
  warningCount: number
  infoCount: number
  issues: PreflightIssue[]
  checkedAt: string
}

function getMonthKey() {
  const now = new Date(Date.now() + 9 * 3600000)
  return now.toISOString().slice(0, 7)
}

export default function DocumentCenterPage() {
  const router = useRouter()
  const [monthKey, setMonthKey] = useState(getMonthKey)
  const [docType, setDocType] = useState('WAGE_LEDGER')
  const [siteId, setSiteId] = useState('')
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(false)
  const [preflightLoading, setPreflightLoading] = useState(false)
  const [xlsxLoading, setXlsxLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [preflight, setPreflight] = useState<PreflightResult | null>(null)

  useEffect(() => {
    fetch('/api/admin/sites?pageSize=200')
      .then(r => r.json())
      .then(d => {
        if (d.success) setSites(d.data?.items?.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })) ?? [])
      })
  }, [])

  // 월/서식 바뀌면 사전검사 결과 초기화
  useEffect(() => {
    setPreflight(null)
    setMsg('')
  }, [monthKey, docType, siteId])

  const handlePreflight = async () => {
    setPreflightLoading(true)
    setMsg('')
    try {
      const res = await fetch('/api/admin/document-center/preflight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthKey, documentType: docType, siteId: siteId || undefined }),
      })
      if (res.status === 401) { router.push('/admin/login'); return }
      const data = await res.json()
      if (!res.ok) { setMsg(`사전검사 실패: ${data.error ?? res.status}`); return }
      setPreflight(data)
    } finally {
      setPreflightLoading(false)
    }
  }

  const handleDownload = async () => {
    setLoading(true)
    setMsg('')
    try {
      const res = await fetch('/api/admin/document-center', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthKey, documentType: docType, siteId: siteId || undefined }),
      })

      if (!res.ok) {
        const err = await res.json()
        setMsg(`실패: ${err.error}`)
        return
      }

      const rowCount = res.headers.get('X-Row-Count')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const label = DOC_TYPES.find(d => d.value === docType)?.label ?? docType
      a.href = url
      a.download = `${monthKey}_${label}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setMsg(`다운로드 완료 (${rowCount ?? '?'}행)`)
    } finally {
      setLoading(false)
    }
  }

  const handleXlsxDownload = async () => {
    setXlsxLoading(true)
    setMsg('')
    try {
      const res = await fetch('/api/admin/document-center/xlsx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthKey, documentType: docType, siteId: siteId || undefined }),
      })

      if (!res.ok) {
        const err = await res.json()
        setMsg(`XLSX 생성 실패: ${err.error}`)
        return
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const label = DOC_TYPES.find(d => d.value === docType)?.label ?? docType
      a.href = url
      a.download = `${monthKey}_${label}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setMsg('XLSX 다운로드 완료')
    } finally {
      setXlsxLoading(false)
    }
  }

  const selectedDoc = DOC_TYPES.find(d => d.value === docType)
  const isSuccess = msg.startsWith('다운로드') || msg.startsWith('XLSX 다운로드')
  const hasXlsx = XLSX_SUPPORTED.includes(docType)
  const downloadBlocked = preflight !== null && !preflight.canDownload

  return (
    <div style={s.layout}>
      <nav style={s.sidebar}>
        <div style={s.sidebarTitle}>해한 출퇴근</div>
        <div style={s.navSection}>관리</div>
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{ ...s.navItem, ...(item.href === '/admin/document-center' ? s.navActive : {}) }}
          >
            {item.label}
          </Link>
        ))}
        <button
          onClick={() => fetch('/api/admin/auth/logout', { method: 'POST' }).then(() => router.push('/admin/login'))}
          style={s.logoutBtn}
        >
          로그아웃
        </button>
      </nav>

      <main style={s.main}>
        <h1 style={s.pageTitle}>서식 출력 센터</h1>

        <div style={s.card}>
          {/* 귀속연월 + 현장 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div>
              <label style={s.label}>귀속연월</label>
              <input
                type="month"
                value={monthKey}
                onChange={e => setMonthKey(e.target.value)}
                style={s.input}
              />
            </div>
            <div>
              <label style={s.label}>현장 (선택)</label>
              <select
                value={siteId}
                onChange={e => setSiteId(e.target.value)}
                style={{ ...s.input, width: '100%' }}
              >
                <option value="">전체 현장</option>
                {sites.map(site => (
                  <option key={site.id} value={site.id}>{site.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 서식 종류 선택 */}
          <div style={{ marginBottom: '20px' }}>
            <label style={s.label}>서식 종류</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
              {DOC_TYPES.map(d => (
                <button
                  key={d.value}
                  onClick={() => setDocType(d.value)}
                  style={{
                    ...s.docTypeBtn,
                    ...(docType === d.value ? s.docTypeBtnActive : {}),
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {d.label}
                    {XLSX_SUPPORTED.includes(d.value) && (
                      <span style={{ fontSize: '10px', background: '#e8f5e9', color: '#2e7d32', padding: '1px 5px', borderRadius: '3px', fontWeight: 700 }}>
                        XLSX
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: docType === d.value ? '#1565c0' : '#9e9e9e', marginTop: '2px' }}>
                    {d.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 선택된 서식 설명 */}
          {selectedDoc && (
            <div style={s.infoBox}>
              <strong>{selectedDoc.label}</strong>: {selectedDoc.desc}
              {hasXlsx && (
                <span style={{ marginLeft: '8px', fontSize: '12px', color: '#2e7d32', fontWeight: 600 }}>
                  (XLSX 실서식 출력 지원)
                </span>
              )}
            </div>
          )}

          {/* 사전검사 버튼 */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
            <button
              onClick={handlePreflight}
              disabled={preflightLoading}
              style={{ ...s.preflightBtn, opacity: preflightLoading ? 0.6 : 1 }}
            >
              {preflightLoading ? '검사 중...' : '사전검사 실행'}
            </button>

            {preflight && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                {preflight.errorCount > 0 && (
                  <span style={{ color: '#c62828', fontWeight: 600 }}>오류 {preflight.errorCount}건</span>
                )}
                {preflight.warningCount > 0 && (
                  <span style={{ color: '#f57f17', fontWeight: 600 }}>경고 {preflight.warningCount}건</span>
                )}
                {preflight.canDownload && (
                  <span style={{ color: '#2e7d32', fontWeight: 600 }}>다운로드 가능</span>
                )}
                <span style={{ color: '#999' }}>
                  {new Date(preflight.checkedAt).toLocaleTimeString('ko-KR')} 검사
                </span>
              </div>
            )}
          </div>

          {/* 사전검사 결과 패널 */}
          {preflight && preflight.issues.length > 0 && (
            <div style={{ marginBottom: '16px', border: '1px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', background: '#fafafa', borderBottom: '1px solid #e0e0e0', fontSize: '13px', fontWeight: 600 }}>
                사전검사 결과
              </div>
              <div style={{ padding: '10px 14px' }}>
                {preflight.issues.map((issue, i) => {
                  const styles = {
                    ERROR:   { bg: '#ffebee', color: '#c62828', icon: 'x' },
                    WARNING: { bg: '#fff8e1', color: '#f57f17', icon: '!' },
                    INFO:    { bg: '#e3f2fd', color: '#1565c0', icon: 'i' },
                  }[issue.level]
                  return (
                    <div key={i} style={{
                      background: styles.bg, color: styles.color,
                      padding: '7px 12px', borderRadius: '5px', marginBottom: '5px',
                      fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'flex-start',
                    }}>
                      <span style={{ fontWeight: 700, flexShrink: 0 }}>{styles.icon}</span>
                      <span>{issue.message}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 다운로드 버튼 영역 */}
          <div style={{ display: 'flex', gap: '10px' }}>
            {/* CSV 다운로드 */}
            <button
              onClick={handleDownload}
              disabled={loading || downloadBlocked}
              style={{
                ...s.downloadBtn,
                flex: hasXlsx ? '1' : undefined,
                width: hasXlsx ? undefined : '100%',
                opacity: (loading || downloadBlocked) ? 0.5 : 1,
              }}
            >
              {loading ? '생성 중...' : downloadBlocked ? '오류 해결 필요 (CSV)' : 'CSV 다운로드'}
            </button>

            {/* XLSX 다운로드 (지원되는 서식만) */}
            {hasXlsx && (
              <button
                onClick={handleXlsxDownload}
                disabled={xlsxLoading || downloadBlocked}
                style={{
                  ...s.downloadBtn,
                  flex: 1,
                  background: downloadBlocked ? '#bdbdbd' : '#2e7d32',
                  opacity: (xlsxLoading || downloadBlocked) ? 0.5 : 1,
                }}
              >
                {xlsxLoading ? '생성 중...' : downloadBlocked ? '오류 해결 필요 (XLSX)' : 'XLSX 다운로드'}
              </button>
            )}
          </div>

          {/* 결과 메시지 */}
          {msg && (
            <div style={{
              ...s.msgBox,
              background: isSuccess ? '#e8f5e9' : '#ffebee',
              color: isSuccess ? '#2e7d32' : '#c62828',
            }}>
              {msg}
            </div>
          )}
        </div>

        {/* 서식 안내 테이블 */}
        <div style={s.card}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 16px' }}>서식별 포함 내용</h2>
          <table style={s.table}>
            <thead>
              <tr>
                {['서식명', '포함 내용', '주요 활용', '형식'].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: '노임대장', desc: '근로자별 일별 임금 지급 내역', use: '노무비 정산, 현장 제출용', xlsx: true },
                { label: '월 출역표', desc: '근로자별 월간 출역 현황 및 공수', use: '공사일보 첨부, 현장 기록', xlsx: false },
                { label: '보험판정표', desc: '4대보험 적용/제외 판정 결과', use: '보험 신고 기초자료', xlsx: true },
                { label: '세금계산표', desc: '원천세 계산 내역 (과세/비과세)', use: '세무 신고용', xlsx: true },
                { label: '퇴직공제 요약표', desc: '퇴직공제 인정일수 집계', use: '건설근로자공제회 신고', xlsx: true },
                { label: '협력사 정산서', desc: '협력사별 노무비 정산 기초자료', use: '협력사 노무비 지급', xlsx: true },
              ].map(row => (
                <tr key={row.label}>
                  <td style={{ ...s.td, fontWeight: 600 }}>{row.label}</td>
                  <td style={s.td}>{row.desc}</td>
                  <td style={{ ...s.td, color: '#666' }}>{row.use}</td>
                  <td style={s.td}>
                    <span style={{ fontSize: '12px', color: '#666' }}>CSV</span>
                    {row.xlsx && (
                      <span style={{ marginLeft: '6px', fontSize: '12px', background: '#e8f5e9', color: '#2e7d32', padding: '1px 6px', borderRadius: '3px', fontWeight: 700 }}>
                        XLSX
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}

const NAV_ITEMS = [
  { href: '/admin',                         label: '대시보드' },
  { href: '/admin/operations-dashboard',    label: '운영 대시보드' },
  { href: '/admin/workers',                 label: '근로자 관리' },
  { href: '/admin/sites',                   label: '현장 관리' },
  { href: '/admin/attendance',              label: '출퇴근 조회' },
  { href: '/admin/presence-checks',         label: '체류확인 현황' },
  { href: '/admin/presence-report',         label: '체류확인 리포트' },
  { href: '/admin/work-confirmations',      label: '근무확정' },
  { href: '/admin/contracts',               label: '인력/계약 관리' },
  { href: '/admin/insurance-eligibility',   label: '보험판정' },
  { href: '/admin/wage-calculations',       label: '세금/노임 계산' },
  { href: '/admin/filing-exports',          label: '신고자료 내보내기' },
  { href: '/admin/retirement-mutual',       label: '퇴직공제' },
  { href: '/admin/labor-cost-summaries',    label: '노무비 집계' },
  { href: '/admin/subcontractor-settlements', label: '협력사 정산' },
  { href: '/admin/document-center',         label: '서식 출력 센터' },
  { href: '/admin/month-closings',          label: '월마감' },
  { href: '/admin/corrections',             label: '정정 이력' },
  { href: '/admin/exceptions',              label: '예외 승인' },
  { href: '/admin/device-requests',         label: '기기 변경' },
]

const s: Record<string, React.CSSProperties> = {
  layout:           { display: 'flex', minHeight: '100vh', background: '#f5f5f5' },
  sidebar:          { width: '220px', background: '#1a1a2e', padding: '24px 0', flexShrink: 0, display: 'flex', flexDirection: 'column' },
  sidebarTitle:     { color: 'white', fontSize: '16px', fontWeight: 700, padding: '0 20px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)' },
  navSection:       { color: 'rgba(255,255,255,0.4)', fontSize: '11px', padding: '16px 20px 8px', textTransform: 'uppercase', letterSpacing: '1px' },
  navItem:          { display: 'block', color: 'rgba(255,255,255,0.8)', padding: '10px 20px', fontSize: '13px', textDecoration: 'none' },
  navActive:        { background: 'rgba(255,255,255,0.1)', color: 'white', fontWeight: 700 },
  logoutBtn:        { margin: '24px 20px 0', padding: '10px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '13px' },
  main:             { flex: 1, padding: '32px', overflow: 'auto' },
  pageTitle:        { fontSize: '24px', fontWeight: 700, margin: '0 0 24px' },
  card:             { background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '20px' },
  label:            { display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px', fontWeight: 600 },
  input:            { padding: '8px 10px', border: '1px solid #e0e0e0', borderRadius: '6px', fontSize: '14px', background: 'white' },
  docTypeBtn:       { textAlign: 'left', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e0e0e0', cursor: 'pointer', background: 'white', transition: 'all 0.1s' },
  docTypeBtnActive: { background: '#e3f2fd', borderColor: '#1976d2', color: '#1565c0' },
  infoBox:          { background: '#e3f2fd', borderRadius: '6px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#1565c0' },
  preflightBtn:     { padding: '9px 18px', background: '#455a64', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 },
  downloadBtn:      { padding: '12px', background: '#1976d2', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: 700 },
  msgBox:           { marginTop: '12px', padding: '10px 14px', borderRadius: '6px', fontSize: '13px' },
  table:            { width: '100%', borderCollapse: 'collapse' },
  th:               { padding: '10px 12px', textAlign: 'left', fontSize: '12px', color: '#888', borderBottom: '2px solid #f0f0f0', whiteSpace: 'nowrap' },
  td:               { padding: '12px', fontSize: '13px', color: '#333', borderBottom: '1px solid #f5f5f5' },
}
