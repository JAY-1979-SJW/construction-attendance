'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Site {
  id: string
  name: string
}

interface Company {
  id: string
  companyName: string
}

interface Settlement {
  id: string
  monthKey: string
  siteId: string
  companyId: string
  workerCount: number
  confirmedWorkUnits: number
  grossAmount: number
  taxAmount: number
  retirementMutualAmount: number
  finalPayableAmount: number
  site: { id: string; name: string }
  company: { id: string; companyName: string; businessNumber: string }
}

interface Totals {
  workerCount: number
  grossAmount: number
  taxAmount: number
  finalPayableAmount: number
}

function getMonthKey() {
  const now = new Date(Date.now() + 9 * 3600000)
  return now.toISOString().slice(0, 7)
}

export default function SubcontractorSettlementsPage() {
  const router = useRouter()
  const [monthKey, setMonthKey] = useState(getMonthKey)
  const [siteFilter, setSiteFilter] = useState('')
  const [subFilter, setSubFilter] = useState('')
  const [sites, setSites] = useState<Site[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [totals, setTotals] = useState<Totals | null>(null)
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [msg, setMsg] = useState('')

  // Load sites + subcontractors
  useEffect(() => {
    fetch('/api/admin/sites?pageSize=200')
      .then(r => r.json())
      .then(d => {
        if (d.success) setSites(d.data?.items?.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })) ?? [])
      })
    fetch('/api/admin/companies?pageSize=200')
      .then(r => r.json())
      .then(d => {
        if (d.success) setCompanies(d.data?.items ?? [])
      })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ monthKey })
      if (siteFilter) params.set('siteId', siteFilter)
      if (subFilter) params.set('companyId', subFilter)
      const res = await fetch(`/api/admin/subcontractor-settlements?${params}`)
      if (res.status === 401) { router.push('/admin/login'); return }
      const data = await res.json()
      setSettlements(data.settlements ?? [])
      setTotals(data.totals ?? null)
    } finally {
      setLoading(false)
    }
  }, [monthKey, siteFilter, subFilter, router])

  useEffect(() => { load() }, [load])

  const handleRun = async () => {
    if (!confirm(`${monthKey} 협력사 정산을 실행하시겠습니까?`)) return
    setRunning(true)
    setMsg('')
    try {
      const res = await fetch('/api/admin/subcontractor-settlements/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monthKey,
          siteId: siteFilter || undefined,
          companyId: subFilter || undefined,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setMsg(`정산 완료 — ${data.count ?? 0}건`)
        load()
      } else {
        setMsg(`정산 실패: ${data.error ?? '알 수 없는 오류'}`)
      }
    } finally {
      setRunning(false) }
  }

  const handleDownload = async () => {
    setDownloading(true)
    setMsg('')
    try {
      const res = await fetch('/api/admin/document-center', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monthKey,
          documentType: 'SUBCONTRACTOR_SETTLEMENT',
          siteId: siteFilter || undefined,
          companyId: subFilter || undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        setMsg(`다운로드 실패: ${err.error}`)
        return
      }
      const rowCount = res.headers.get('X-Row-Count')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${monthKey}_협력사정산서.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setMsg(`다운로드 완료 (${rowCount ?? '?'}행)`)
    } finally {
      setDownloading(false)
    }
  }

  const fmt = (n: number) => n.toLocaleString('ko-KR')
  const fmtWon = (n: number) => fmt(n) + '원'
  const isSuccess = msg.startsWith('정산 완료') || msg.startsWith('다운로드 완료')

  return (
    <div style={s.layout}>
      <nav style={s.sidebar}>
        <div style={s.sidebarTitle}>해한 출퇴근</div>
        <div style={s.navSection}>관리</div>
        {NAV_ITEMS.map(item => (
          <Link
            key={item.href}
            href={item.href}
            style={{ ...s.navItem, ...(item.href === '/admin/subcontractor-settlements' ? s.navActive : {}) }}
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
        <h1 style={s.pageTitle}>협력사 정산</h1>

        {/* 필터 + 실행 버튼 */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
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
            <label style={s.label}>현장</label>
            <select
              value={siteFilter}
              onChange={e => setSiteFilter(e.target.value)}
              style={{ ...s.input, minWidth: '160px' }}
            >
              <option value="">전체 현장</option>
              {sites.map(site => (
                <option key={site.id} value={site.id}>{site.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={s.label}>협력사</label>
            <select
              value={subFilter}
              onChange={e => setSubFilter(e.target.value)}
              style={{ ...s.input, minWidth: '160px' }}
            >
              <option value="">전체 협력사</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.companyName}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleRun}
            disabled={running}
            style={{ ...s.btn, background: '#7b1fa2', opacity: running ? 0.6 : 1 }}
          >
            {running ? '정산 중...' : '정산 실행'}
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            style={{ ...s.btn, background: '#E06810', opacity: downloading ? 0.6 : 1 }}
          >
            {downloading ? '생성 중...' : 'CSV 다운로드'}
          </button>
        </div>

        {msg && (
          <div style={{
            ...s.msg,
            background: isSuccess ? '#e8f5e9' : '#ffebee',
            color: isSuccess ? '#2e7d32' : '#c62828',
          }}>
            {msg}
          </div>
        )}

        {/* 요약 카드 */}
        {totals && (
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {[
              { label: '협력사수', value: fmt(settlements.length) + '개사', color: '#5BA4D9' },
              { label: '총 인원', value: fmt(totals.workerCount) + '명', color: '#388e3c' },
              { label: '총 지급액', value: fmtWon(totals.grossAmount), color: '#e65100' },
              { label: '총 원천세', value: fmtWon(totals.taxAmount), color: '#b71c1c' },
              { label: '최종지급예정액', value: fmtWon(totals.finalPayableAmount), color: '#6a1b9a' },
            ].map(c => (
              <div key={c.label} style={{ ...s.summaryCard, borderTop: `4px solid ${c.color}` }}>
                <div style={{ fontSize: '18px', fontWeight: 700, color: c.color }}>{c.value}</div>
                <div style={{ fontSize: '12px', color: '#A0AEC0' }}>{c.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* 테이블 */}
        <div style={s.tableCard}>
          {loading ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#999' }}>로딩 중...</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    {['현장', '협력사', '사업자번호', '인원', '공수', '지급총액', '원천세', '퇴직공제', '최종지급예정액'].map(h => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {settlements.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '24px', color: '#999' }}>
                        데이터 없음 — 정산 실행을 먼저 하세요
                      </td>
                    </tr>
                  ) : settlements.map(row => (
                    <tr key={row.id}>
                      <td style={s.td}>{row.site.name}</td>
                      <td style={s.td}>{row.company.companyName}</td>
                      <td style={{ ...s.td, fontSize: '12px', color: '#A0AEC0' }}>{row.company.businessNumber}</td>
                      <td style={{ ...s.td, textAlign: 'center' as const }}>{fmt(row.workerCount)}명</td>
                      <td style={{ ...s.td, textAlign: 'center' as const }}>{Number(row.confirmedWorkUnits).toFixed(1)}공수</td>
                      <td style={{ ...s.td, textAlign: 'right' as const }}>{fmt(row.grossAmount)}</td>
                      <td style={{ ...s.td, textAlign: 'right' as const, color: '#b71c1c' }}>{fmt(row.taxAmount)}</td>
                      <td style={{ ...s.td, textAlign: 'right' as const, color: '#6a1b9a' }}>{fmt(row.retirementMutualAmount)}</td>
                      <td style={{ ...s.td, textAlign: 'right' as const, fontWeight: 700 }}>{fmt(row.finalPayableAmount)}</td>
                    </tr>
                  ))}
                </tbody>
                {settlements.length > 0 && totals && (
                  <tfoot>
                    <tr style={{ background: '#1B2838', fontWeight: 700 }}>
                      <td style={{ ...s.td, fontWeight: 700 }} colSpan={3}>합계</td>
                      <td style={{ ...s.td, textAlign: 'center' as const, fontWeight: 700 }}>{fmt(totals.workerCount)}명</td>
                      <td style={s.td}></td>
                      <td style={{ ...s.td, textAlign: 'right' as const, fontWeight: 700 }}>{fmt(totals.grossAmount)}</td>
                      <td style={{ ...s.td, textAlign: 'right' as const, fontWeight: 700, color: '#b71c1c' }}>{fmt(totals.taxAmount)}</td>
                      <td style={s.td}></td>
                      <td style={{ ...s.td, textAlign: 'right' as const, fontWeight: 700 }}>{fmt(totals.finalPayableAmount)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

const NAV_ITEMS = [
  { href: '/admin',                         label: '대시보드' },
  { href: '/admin/workers',                 label: '근로자 관리' },
  { href: '/admin/companies', label: '회사 관리' },
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
  layout:       { display: 'flex', minHeight: '100vh', background: '#1B2838' },
  sidebar:      { width: '220px', background: '#141E2A', padding: '24px 0', flexShrink: 0, display: 'flex', flexDirection: 'column' },
  sidebarTitle: { color: 'white', fontSize: '16px', fontWeight: 700, padding: '0 20px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)' },
  navSection:   { color: 'rgba(255,255,255,0.4)', fontSize: '11px', padding: '16px 20px 8px', textTransform: 'uppercase', letterSpacing: '1px' },
  navItem:      { display: 'block', color: 'rgba(255,255,255,0.8)', padding: '10px 20px', fontSize: '13px', textDecoration: 'none' },
  navActive:    { background: 'rgba(255,255,255,0.1)', color: 'white', fontWeight: 700 },
  logoutBtn:    { margin: '24px 20px 0', padding: '10px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '13px' },
  main:         { flex: 1, padding: '32px', overflow: 'auto' },
  pageTitle:    { fontSize: '24px', fontWeight: 700, margin: '0 0 24px' },
  label:        { display: 'block', fontSize: '12px', color: '#A0AEC0', marginBottom: '4px', fontWeight: 600 },
  input:        { padding: '8px 10px', border: '1px solid rgba(91,164,217,0.2)', borderRadius: '6px', fontSize: '14px', background: '#243144' },
  btn:          { padding: '8px 16px', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 },
  msg:          { padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' },
  summaryCard:  { background: '#243144', borderRadius: '10px', padding: '16px 20px', minWidth: '140px', boxShadow: '0 2px 8px rgba(0,0,0,0.35)' },
  tableCard:    { background: '#243144', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.35)', overflow: 'hidden' },
  table:        { width: '100%', borderCollapse: 'collapse' as const },
  th:           { padding: '12px 16px', textAlign: 'left' as const, fontSize: '12px', fontWeight: 600, color: '#A0AEC0', borderBottom: '1px solid rgba(91,164,217,0.2)', whiteSpace: 'nowrap' as const },
  td:           { padding: '12px 16px', fontSize: '13px', color: '#CBD5E0', borderBottom: '1px solid #f9f9f9' },
}
