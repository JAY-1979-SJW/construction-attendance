'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface CorrectionRecord {
  id: string
  createdAt: string
  domainType: string
  targetId: string
  action: string
  reason: string | null
  operatorId: string | null
  operatorName: string | null
  beforeJson: Record<string, unknown> | null
  afterJson: Record<string, unknown> | null
}

const DOMAIN_TYPES = [
  { value: '', label: '전체 도메인' },
  { value: 'ATTENDANCE',         label: '출퇴근' },
  { value: 'WORK_CONFIRMATION',  label: '근무확정' },
  { value: 'INSURANCE',          label: '보험판정' },
  { value: 'WAGE',               label: '세금/노임' },
  { value: 'FILING_EXPORT',      label: '신고자료' },
  { value: 'RETIREMENT_MUTUAL',  label: '퇴직공제' },
  { value: 'CONTRACT',           label: '계약' },
  { value: 'WORKER',             label: '근로자' },
]

function getDefaultDateRange() {
  const now = new Date(Date.now() + 9 * 3600000)
  const to = now.toISOString().slice(0, 10)
  const from = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10)
  return { from, to }
}

export default function CorrectionsPage() {
  const router = useRouter()
  const { from: defaultFrom, to: defaultTo } = getDefaultDateRange()

  const [domainFilter, setDomainFilter] = useState('')
  const [dateFrom, setDateFrom] = useState(defaultFrom)
  const [dateTo, setDateTo] = useState(defaultTo)
  const [items, setItems] = useState<CorrectionRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const PAGE_SIZE = 50

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        dateFrom,
        dateTo,
        page: String(page),
        pageSize: String(PAGE_SIZE),
      })
      if (domainFilter) params.set('domainType', domainFilter)
      const res = await fetch(`/api/admin/corrections?${params}`)
      const data = await res.json()
      if (!data.success) { router.push('/admin/login'); return }
      setItems(data.data?.items ?? [])
      setTotal(data.data?.total ?? 0)
    } finally { setLoading(false) }
  }, [domainFilter, dateFrom, dateTo, page, router])

  useEffect(() => { load() }, [load])

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })

  const domainLabel = (type: string) =>
    DOMAIN_TYPES.find((d) => d.value === type)?.label ?? type

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div style={s.layout}>
      <nav style={s.sidebar}>
        <div style={s.sidebarTitle}>해한 출퇴근</div>
        <div style={s.navSection}>관리</div>
        {NAV_ITEMS.map((item) => (
          <Link key={item.href} href={item.href} style={{ ...s.navItem, ...(item.href === '/admin/corrections' ? s.navActive : {}) }}>
            {item.label}
          </Link>
        ))}
        <button onClick={() => fetch('/api/admin/auth/logout', { method: 'POST' }).then(() => router.push('/admin/login'))} style={s.logoutBtn}>로그아웃</button>
      </nav>

      <main style={s.main}>
        <h1 style={s.pageTitle}>정정 이력</h1>
        <p style={{ fontSize: '13px', color: '#888', margin: '-12px 0 20px' }}>
          데이터 수정/정정 이력을 조회합니다
        </p>

        {/* 필터 영역 */}
        <div style={s.filterCard}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={s.label}>도메인</label>
              <select value={domainFilter} onChange={(e) => { setDomainFilter(e.target.value); setPage(1) }} style={s.input}>
                {DOMAIN_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <label style={s.label}>시작일</label>
              <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1) }} style={s.input} />
            </div>
            <div>
              <label style={s.label}>종료일</label>
              <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1) }} style={s.input} />
            </div>
            <button onClick={() => { setPage(1); load() }} style={s.btn}>조회</button>
          </div>
        </div>

        {/* 결과 테이블 */}
        <div style={s.tableCard}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: '14px' }}>정정 이력 목록</span>
            <span style={{ fontSize: '12px', color: '#888' }}>전체 {total.toLocaleString('ko-KR')}건</span>
          </div>
          {loading ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#999' }}>로딩 중...</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    {['일시', '도메인', '대상 ID', '액션', '사유', '처리자', '변경 전/후'].map((h) => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: '#999' }}>이력 없음</td></tr>
                  ) : items.map((item) => (
                    <>
                      <tr key={item.id} style={s.tr}>
                        <td style={s.td}>{fmtDate(item.createdAt)}</td>
                        <td style={s.td}>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#1565c0', background: '#e3f2fd', padding: '2px 8px', borderRadius: '4px' }}>
                            {domainLabel(item.domainType)}
                          </span>
                        </td>
                        <td style={{ ...s.td, fontFamily: 'monospace', fontSize: '12px', color: '#555', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.targetId}
                        </td>
                        <td style={s.td}>
                          <span style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: item.action === 'DELETE' ? '#c62828' : item.action === 'CREATE' ? '#2e7d32' : '#e65100',
                          }}>
                            {item.action}
                          </span>
                        </td>
                        <td style={{ ...s.td, maxWidth: '200px', fontSize: '12px', color: '#666' }}>{item.reason ?? '-'}</td>
                        <td style={s.td}>{item.operatorName ?? item.operatorId ?? '-'}</td>
                        <td style={s.td}>
                          {(item.beforeJson || item.afterJson) && (
                            <button
                              onClick={() => toggleExpand(item.id)}
                              style={{ ...s.btn, padding: '3px 10px', fontSize: '12px', background: expandedId === item.id ? '#455a64' : '#607d8b' }}
                            >
                              {expandedId === item.id ? '접기' : '보기'}
                            </button>
                          )}
                        </td>
                      </tr>
                      {expandedId === item.id && (
                        <tr key={`${item.id}-expand`}>
                          <td colSpan={7} style={{ padding: '0', background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0' }}>
                              <div style={{ padding: '16px', borderRight: '1px solid #f0f0f0' }}>
                                <div style={{ fontSize: '11px', fontWeight: 700, color: '#c62828', marginBottom: '8px', textTransform: 'uppercase' }}>
                                  변경 전 (Before)
                                </div>
                                <pre style={{ fontSize: '11px', color: '#333', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                  {item.beforeJson ? JSON.stringify(item.beforeJson, null, 2) : '(없음)'}
                                </pre>
                              </div>
                              <div style={{ padding: '16px' }}>
                                <div style={{ fontSize: '11px', fontWeight: 700, color: '#2e7d32', marginBottom: '8px', textTransform: 'uppercase' }}>
                                  변경 후 (After)
                                </div>
                                <pre style={{ fontSize: '11px', color: '#333', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                  {item.afterJson ? JSON.stringify(item.afterJson, null, 2) : '(없음)'}
                                </pre>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div style={{ padding: '16px 20px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{ ...s.pageBtn, opacity: page === 1 ? 0.4 : 1 }}
              >
                이전
              </button>
              <span style={{ fontSize: '13px', color: '#666' }}>{page} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{ ...s.pageBtn, opacity: page === totalPages ? 0.4 : 1 }}
              >
                다음
              </button>
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
  { href: '/admin/companies', label: '회사 관리' },
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
  layout:     { display: 'flex', minHeight: '100vh', background: '#f5f5f5' },
  sidebar:    { width: '220px', background: '#1a1a2e', padding: '24px 0', flexShrink: 0, display: 'flex', flexDirection: 'column' },
  sidebarTitle: { color: 'white', fontSize: '16px', fontWeight: 700, padding: '0 20px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)' },
  navSection: { color: 'rgba(255,255,255,0.4)', fontSize: '11px', padding: '16px 20px 8px', textTransform: 'uppercase' as const, letterSpacing: '1px' },
  navItem:    { display: 'block', color: 'rgba(255,255,255,0.8)', padding: '10px 20px', fontSize: '13px', textDecoration: 'none' },
  navActive:  { background: 'rgba(255,255,255,0.1)', color: 'white', fontWeight: 700 },
  logoutBtn:  { margin: '24px 20px 0', padding: '10px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '13px' },
  main:       { flex: 1, padding: '32px', overflow: 'auto' },
  pageTitle:  { fontSize: '24px', fontWeight: 700, margin: '0 0 8px' },
  label:      { display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px', fontWeight: 600 },
  input:      { padding: '8px 10px', border: '1px solid #e0e0e0', borderRadius: '6px', fontSize: '14px', background: 'white' },
  btn:        { padding: '8px 16px', background: '#1976d2', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 },
  filterCard: { background: 'white', borderRadius: '12px', padding: '24px', marginBottom: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  tableCard:  { background: 'white', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' },
  table:      { width: '100%', borderCollapse: 'collapse' as const },
  th:         { padding: '12px 16px', textAlign: 'left' as const, fontSize: '12px', fontWeight: 600, color: '#666', borderBottom: '1px solid #f0f0f0', whiteSpace: 'nowrap' as const },
  td:         { padding: '12px 16px', fontSize: '13px', color: '#333', borderBottom: '1px solid #f9f9f9', verticalAlign: 'top' as const },
  tr:         { cursor: 'default' },
  pageBtn:    { padding: '6px 14px', border: '1px solid #e0e0e0', borderRadius: '6px', background: 'white', cursor: 'pointer', fontSize: '13px' },
}
