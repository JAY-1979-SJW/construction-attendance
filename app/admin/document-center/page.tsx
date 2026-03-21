'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetch('/api/admin/sites?pageSize=200')
      .then(r => r.json())
      .then(d => {
        if (d.success) setSites(d.data?.items?.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })) ?? [])
      })
  }, [])

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

  const selectedDoc = DOC_TYPES.find(d => d.value === docType)
  const isSuccess = msg.startsWith('다운로드')

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
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>{d.label}</div>
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
            </div>
          )}

          {/* 다운로드 버튼 */}
          <button
            onClick={handleDownload}
            disabled={loading}
            style={{ ...s.downloadBtn, opacity: loading ? 0.6 : 1 }}
          >
            {loading ? '생성 중...' : '다운로드'}
          </button>

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
                {['서식명', '포함 내용', '주요 활용'].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: '노임대장', desc: '근로자별 일별 임금 지급 내역', use: '노무비 정산, 현장 제출용' },
                { label: '월 출역표', desc: '근로자별 월간 출역 현황 및 공수', use: '공사일보 첨부, 현장 기록' },
                { label: '보험판정표', desc: '4대보험 적용/제외 판정 결과', use: '보험 신고 기초자료' },
                { label: '세금계산표', desc: '원천세 계산 내역 (과세/비과세)', use: '세무 신고용' },
                { label: '퇴직공제 요약표', desc: '퇴직공제 인정일수 집계', use: '건설근로자공제회 신고' },
                { label: '협력사 정산서', desc: '협력사별 노무비 정산 기초자료', use: '협력사 노무비 지급' },
              ].map(row => (
                <tr key={row.label}>
                  <td style={{ ...s.td, fontWeight: 600 }}>{row.label}</td>
                  <td style={s.td}>{row.desc}</td>
                  <td style={{ ...s.td, color: '#666' }}>{row.use}</td>
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
  layout:         { display: 'flex', minHeight: '100vh', background: '#f5f5f5' },
  sidebar:        { width: '220px', background: '#1a1a2e', padding: '24px 0', flexShrink: 0, display: 'flex', flexDirection: 'column' },
  sidebarTitle:   { color: 'white', fontSize: '16px', fontWeight: 700, padding: '0 20px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)' },
  navSection:     { color: 'rgba(255,255,255,0.4)', fontSize: '11px', padding: '16px 20px 8px', textTransform: 'uppercase', letterSpacing: '1px' },
  navItem:        { display: 'block', color: 'rgba(255,255,255,0.8)', padding: '10px 20px', fontSize: '13px', textDecoration: 'none' },
  navActive:      { background: 'rgba(255,255,255,0.1)', color: 'white', fontWeight: 700 },
  logoutBtn:      { margin: '24px 20px 0', padding: '10px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '13px' },
  main:           { flex: 1, padding: '32px', overflow: 'auto' },
  pageTitle:      { fontSize: '24px', fontWeight: 700, margin: '0 0 24px' },
  card:           { background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '20px' },
  label:          { display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px', fontWeight: 600 },
  input:          { padding: '8px 10px', border: '1px solid #e0e0e0', borderRadius: '6px', fontSize: '14px', background: 'white' },
  docTypeBtn:     { textAlign: 'left', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e0e0e0', cursor: 'pointer', background: 'white', transition: 'all 0.1s' },
  docTypeBtnActive: { background: '#e3f2fd', borderColor: '#1976d2', color: '#1565c0' },
  infoBox:        { background: '#e3f2fd', borderRadius: '6px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#1565c0' },
  downloadBtn:    { width: '100%', padding: '12px', background: '#1976d2', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: 700 },
  msgBox:         { marginTop: '12px', padding: '10px 14px', borderRadius: '6px', fontSize: '13px' },
  table:          { width: '100%', borderCollapse: 'collapse' },
  th:             { padding: '10px 12px', textAlign: 'left', fontSize: '12px', color: '#888', borderBottom: '2px solid #f0f0f0', whiteSpace: 'nowrap' },
  td:             { padding: '12px', fontSize: '13px', color: '#333', borderBottom: '1px solid #f5f5f5' },
}
