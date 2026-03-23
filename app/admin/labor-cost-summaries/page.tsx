'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface LaborCostRow {
  id: string
  siteName: string
  siteId: string
  orgType: string
  companyName: string
  workerCount: number
  mandays: number
  totalWage: number
  taxableAmount: number
  withholdingTax: number
  npTargetCount: number
  hiTargetCount: number
  eiTargetCount: number
  retirementMutualDays: number
}

interface LaborCostTotals {
  workerCount: number
  totalWage: number
  withholdingTax: number
  mandays: number
}

interface SiteOption {
  id: string
  name: string
}

function getMonthKey() {
  const now = new Date(Date.now() + 9 * 3600000)
  return now.toISOString().slice(0, 7)
}

const ORG_TYPE_LABEL: Record<string, string> = {
  HEAD:       '원청',
  SUB:        '협력사',
  PARTNER:    '파트너',
  INDIVIDUAL: '개인',
}

export default function LaborCostSummariesPage() {
  const router = useRouter()
  const [monthKey, setMonthKey] = useState(getMonthKey())
  const [siteFilter, setSiteFilter] = useState('')
  const [items, setItems] = useState<LaborCostRow[]>([])
  const [totals, setTotals] = useState<LaborCostTotals | null>(null)
  const [sites, setSites] = useState<SiteOption[]>([])
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [msg, setMsg] = useState('')

  // Load site list for dropdown
  useEffect(() => {
    fetch('/api/admin/sites?pageSize=200')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setSites(d.data?.items?.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })) ?? [])
      })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ monthKey })
      if (siteFilter) params.set('siteId', siteFilter)
      const res = await fetch(`/api/admin/labor-cost-summaries?${params}`)
      const data = await res.json()
      if (!data.success) { router.push('/admin/login'); return }
      setItems(data.data?.items ?? [])
      setTotals(data.data?.totals ?? null)
    } finally { setLoading(false) }
  }, [monthKey, siteFilter, router])

  useEffect(() => { load() }, [load])

  const handleRun = async () => {
    if (!confirm(`${monthKey} 노무비 집계를 실행하시겠습니까?`)) return
    setRunning(true)
    setMsg('')
    try {
      const res = await fetch('/api/admin/labor-cost-summaries/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthKey }),
      })
      const data = await res.json()
      if (res.ok) {
        setMsg(`집계 완료 — ${data.data?.count ?? 0}건`)
        load()
      } else {
        setMsg(`집계 실패: ${data.error ?? '알 수 없는 오류'}`)
      }
    } finally { setRunning(false) }
  }

  const fmt = (n: number) => n.toLocaleString('ko-KR')
  const fmtWon = (n: number) => fmt(n) + '원'

  return (
    <div style={s.layout}>
      <nav style={s.sidebar}>
        <div style={s.sidebarTitle}>해한 출퇴근</div>
        <div style={s.navSection}>관리</div>
        {NAV_ITEMS.map((item) => (
          <Link key={item.href} href={item.href} style={{ ...s.navItem, ...(item.href === '/admin/labor-cost-summaries' ? s.navActive : {}) }}>
            {item.label}
          </Link>
        ))}
        <button onClick={() => fetch('/api/admin/auth/logout', { method: 'POST' }).then(() => router.push('/admin/login'))} style={s.logoutBtn}>로그아웃</button>
      </nav>

      <main style={s.main}>
        <h1 style={s.pageTitle}>노무비 집계</h1>

        {/* 필터 + 실행 버튼 */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={s.label}>귀속연월</label>
            <input
              type="month"
              value={monthKey}
              onChange={(e) => setMonthKey(e.target.value)}
              style={s.input}
            />
          </div>
          <div>
            <label style={s.label}>현장</label>
            <select
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
              style={{ ...s.input, minWidth: '180px' }}
            >
              <option value="">전체 현장</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>{site.name}</option>
              ))}
            </select>
          </div>
          <button onClick={handleRun} disabled={running} style={{ ...s.btn, background: '#7b1fa2', opacity: running ? 0.6 : 1 }}>
            {running ? '집계 중...' : '집계 실행'}
          </button>
        </div>

        {msg && (
          <div style={{
            ...s.msg,
            background: msg.startsWith('집계 실패') ? '#ffebee' : '#e8f5e9',
            color: msg.startsWith('집계 실패') ? '#c62828' : '#2e7d32',
          }}>
            {msg}
          </div>
        )}

        {/* 요약 카드 */}
        {totals && (
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {[
              { label: '총 근로자수',  value: fmt(totals.workerCount) + '명', color: '#5BA4D9' },
              { label: '총 공수',     value: fmt(totals.mandays) + '일',      color: '#388e3c' },
              { label: '총 노임',     value: fmtWon(totals.totalWage),        color: '#e65100' },
              { label: '총 원천세',   value: fmtWon(totals.withholdingTax),   color: '#b71c1c' },
            ].map((c) => (
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
                    {[
                      '현장명', '조직구분', '협력사명',
                      '인원수', '공수',
                      '총노임', '과세금액', '원천세',
                      '국민연금', '건보', '고용보험', '퇴직공제(일)',
                    ].map((h) => <th key={h} style={s.th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={12} style={{ textAlign: 'center', padding: '24px', color: '#999' }}>
                        데이터 없음 — 집계 실행을 먼저 하세요
                      </td>
                    </tr>
                  ) : items.map((row) => (
                    <tr key={row.id} style={s.tr}>
                      <td style={s.td}>
                        {row.siteName}
                        <br />
                        <span style={{ fontSize: '11px', color: '#999' }}>{row.siteId}</span>
                      </td>
                      <td style={s.td}>
                        <span style={{ fontSize: '12px', color: '#A0AEC0' }}>
                          {ORG_TYPE_LABEL[row.orgType] ?? row.orgType}
                        </span>
                      </td>
                      <td style={s.td}>{row.companyName}</td>
                      <td style={{ ...s.td, textAlign: 'center' as const }}>{fmt(row.workerCount)}</td>
                      <td style={{ ...s.td, textAlign: 'center' as const }}>{fmt(row.mandays)}</td>
                      <td style={{ ...s.td, textAlign: 'right' as const }}>{fmt(row.totalWage)}</td>
                      <td style={{ ...s.td, textAlign: 'right' as const }}>{fmt(row.taxableAmount)}</td>
                      <td style={{ ...s.td, textAlign: 'right' as const, color: '#b71c1c' }}>
                        {fmt(row.withholdingTax)}
                      </td>
                      <td style={{ ...s.td, textAlign: 'center' as const }}>
                        <span style={{ fontSize: '12px', color: row.npTargetCount > 0 ? '#1565c0' : '#9e9e9e' }}>
                          {fmt(row.npTargetCount)}명
                        </span>
                      </td>
                      <td style={{ ...s.td, textAlign: 'center' as const }}>
                        <span style={{ fontSize: '12px', color: row.hiTargetCount > 0 ? '#1565c0' : '#9e9e9e' }}>
                          {fmt(row.hiTargetCount)}명
                        </span>
                      </td>
                      <td style={{ ...s.td, textAlign: 'center' as const }}>
                        <span style={{ fontSize: '12px', color: row.eiTargetCount > 0 ? '#1565c0' : '#9e9e9e' }}>
                          {fmt(row.eiTargetCount)}명
                        </span>
                      </td>
                      <td style={{ ...s.td, textAlign: 'center' as const }}>
                        {fmt(row.retirementMutualDays)}일
                      </td>
                    </tr>
                  ))}
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
  layout:       { display: 'flex', minHeight: '100vh', background: '#1B2838' },
  sidebar:      { width: '220px', background: '#141E2A', padding: '24px 0', flexShrink: 0, display: 'flex', flexDirection: 'column' },
  sidebarTitle: { color: 'white', fontSize: '16px', fontWeight: 700, padding: '0 20px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)' },
  navSection:   { color: 'rgba(255,255,255,0.4)', fontSize: '11px', padding: '16px 20px 8px', textTransform: 'uppercase' as const, letterSpacing: '1px' },
  navItem:      { display: 'block', color: 'rgba(255,255,255,0.8)', padding: '10px 20px', fontSize: '13px', textDecoration: 'none' },
  navActive:    { background: 'rgba(255,255,255,0.1)', color: 'white', fontWeight: 700 },
  logoutBtn:    { margin: '24px 20px 0', padding: '10px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '13px' },
  main:         { flex: 1, padding: '32px', overflow: 'auto' },
  pageTitle:    { fontSize: '24px', fontWeight: 700, margin: '0 0 24px' },
  label:        { display: 'block', fontSize: '12px', color: '#A0AEC0', marginBottom: '4px', fontWeight: 600 },
  input:        { padding: '8px 10px', border: '1px solid rgba(91,164,217,0.2)', borderRadius: '6px', fontSize: '14px', background: '#243144' },
  btn:          { padding: '8px 16px', background: '#F47920', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 },
  msg:          { padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' },
  summaryCard:  { background: '#243144', borderRadius: '10px', padding: '16px 20px', minWidth: '140px', boxShadow: '0 2px 8px rgba(0,0,0,0.35)' },
  tableCard:    { background: '#243144', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.35)', overflow: 'hidden' },
  table:        { width: '100%', borderCollapse: 'collapse' as const },
  th:           { padding: '12px 16px', textAlign: 'left' as const, fontSize: '12px', fontWeight: 600, color: '#A0AEC0', borderBottom: '1px solid rgba(91,164,217,0.2)', whiteSpace: 'nowrap' as const },
  td:           { padding: '12px 16px', fontSize: '13px', color: '#CBD5E0', borderBottom: '1px solid rgba(91,164,217,0.1)', verticalAlign: 'top' as const },
  tr:           { cursor: 'default' },
}
