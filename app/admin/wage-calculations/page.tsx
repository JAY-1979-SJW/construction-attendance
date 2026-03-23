'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface WageItem {
  id: string
  monthKey: string
  incomeType: string
  regularDays: number
  halfDays: number
  grossAmount: number
  nonTaxableAmount: number
  taxableAmount: number
  worker: { id: string; name: string; employmentType: string; incomeType: string }
  withholding: {
    incomeTaxAmount: number
    localIncomeTaxAmount: number
    formulaCode: string
  } | null
}

interface Totals { gross: number; nonTaxable: number; taxable: number; incomeTax: number; localTax: number }

function getMonthKey() {
  const now = new Date(Date.now() + 9 * 3600000)
  return now.toISOString().slice(0, 7)
}

const INCOME_LABEL: Record<string, string> = { SALARY: '상용급여', DAILY_WAGE: '일용', BUSINESS_INCOME: '3.3%사업소득' }
const INCOME_COLOR: Record<string, string> = { SALARY: '#1565c0', DAILY_WAGE: '#2e7d32', BUSINESS_INCOME: '#e65100' }
const FORMULA_LABEL: Record<string, string> = {
  DAILY_WAGE_2024: '일용 원천징수(일 15만공제 + 6% × 45%)',
  BUSINESS_33: '3.3% (소득세3% + 지방세0.3%)',
  SALARY_TABLE: '간이세액표(상용)',
}

export default function WageCalculationsPage() {
  const router = useRouter()
  const [monthKey, setMonthKey]       = useState(getMonthKey())
  const [incomeFilter, setIncomeFilter] = useState('')
  const [items, setItems]             = useState<WageItem[]>([])
  const [totals, setTotals]           = useState<Totals | null>(null)
  const [loading, setLoading]         = useState(false)
  const [running, setRunning]         = useState(false)
  const [msg, setMsg]                 = useState('')

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/admin/wage-calculations?monthKey=${monthKey}&incomeType=${incomeFilter}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) { router.push('/admin/login'); return }
        setItems(d.data.items)
        setTotals(d.data.totals)
        setLoading(false)
      })
  }, [monthKey, incomeFilter, router])

  useEffect(() => { load() }, [load])

  const handleRun = async () => {
    if (!confirm(`${monthKey} 세금 계산을 실행하시겠습니까?`)) return
    setRunning(true)
    const r = await fetch('/api/admin/wage-calculations/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monthKey }),
    }).then((r) => r.json())
    setRunning(false)
    setMsg(r.success ? `계산 완료 — 신규 ${r.data.created}건` : '실패')
    load()
  }

  const fmt = (n: number) => n.toLocaleString('ko-KR')

  return (
    <div style={s.layout}>
      <nav style={s.sidebar}>
        <div style={s.sidebarTitle}>해한 출퇴근</div>
        <div style={s.navSection}>관리</div>
        {NAV_ITEMS.map((item) => (
          <Link key={item.href} href={item.href} style={{ ...s.navItem, ...(item.href === '/admin/wage-calculations' ? s.navActive : {}) }}>
            {item.label}
          </Link>
        ))}
        <button onClick={() => fetch('/api/admin/auth/logout', { method: 'POST' }).then(() => router.push('/admin/login'))} style={s.logoutBtn}>로그아웃</button>
      </nav>

      <main style={s.main}>
        <h1 style={s.pageTitle}>세금/노임 계산</h1>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="month" value={monthKey} onChange={(e) => setMonthKey(e.target.value)} style={s.input} />
          <select value={incomeFilter} onChange={(e) => setIncomeFilter(e.target.value)} style={s.input}>
            <option value="">전체 소득유형</option>
            <option value="DAILY_WAGE">일용근로소득</option>
            <option value="SALARY">상용급여</option>
            <option value="BUSINESS_INCOME">3.3%사업소득</option>
          </select>
          <button onClick={handleRun} disabled={running} style={{ ...s.btn, background: '#7b1fa2' }}>
            {running ? '계산 중...' : '세금계산 실행'}
          </button>
        </div>

        {msg && <div style={s.msg}>{msg}</div>}

        {/* 합계 */}
        {totals && (
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {[
              { label: '총 지급액', value: fmt(totals.gross) + '원',     color: '#5BA4D9' },
              { label: '비과세',    value: fmt(totals.nonTaxable) + '원', color: '#388e3c' },
              { label: '과세표준',  value: fmt(totals.taxable) + '원',    color: '#e65100' },
              { label: '소득세',    value: fmt(totals.incomeTax) + '원',  color: '#b71c1c' },
              { label: '지방소득세', value: fmt(totals.localTax) + '원',  color: '#7b1fa2' },
            ].map((c) => (
              <div key={c.label} style={{ ...s.summaryCard, borderTop: `4px solid ${c.color}` }}>
                <div style={{ fontSize: '18px', fontWeight: 700, color: c.color }}>{c.value}</div>
                <div style={{ fontSize: '12px', color: '#A0AEC0' }}>{c.label}</div>
              </div>
            ))}
          </div>
        )}

        <div style={s.tableCard}>
          {loading ? <div style={{ padding: '32px', textAlign: 'center', color: '#999' }}>로딩 중...</div> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    {['근로자', '소득유형', '근무일수', '총지급액', '비과세', '과세표준', '소득세', '지방소득세', '공식'].map((h) => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={9} style={{ textAlign: 'center', padding: '24px', color: '#999' }}>데이터 없음 — 세금계산 실행을 먼저 하세요</td></tr>
                  ) : items.map((item) => (
                    <tr key={item.id} style={s.tr}>
                      <td style={s.td}>{item.worker.name}</td>
                      <td style={s.td}>
                        <span style={{ color: INCOME_COLOR[item.incomeType], fontWeight: 600, fontSize: '12px' }}>
                          {INCOME_LABEL[item.incomeType] ?? item.incomeType}
                        </span>
                      </td>
                      <td style={{ ...s.td, textAlign: 'center' as const }}>
                        {Number(item.regularDays) + Number(item.halfDays)}일
                      </td>
                      <td style={{ ...s.td, textAlign: 'right' as const }}>{fmt(item.grossAmount)}</td>
                      <td style={{ ...s.td, textAlign: 'right' as const }}>{fmt(item.nonTaxableAmount)}</td>
                      <td style={{ ...s.td, textAlign: 'right' as const }}>{fmt(item.taxableAmount)}</td>
                      <td style={{ ...s.td, textAlign: 'right' as const, color: '#b71c1c' }}>
                        {fmt(item.withholding?.incomeTaxAmount ?? 0)}
                      </td>
                      <td style={{ ...s.td, textAlign: 'right' as const, color: '#7b1fa2' }}>
                        {fmt(item.withholding?.localIncomeTaxAmount ?? 0)}
                      </td>
                      <td style={{ ...s.td, fontSize: '11px', color: '#A0AEC0', maxWidth: '200px' }}>
                        {FORMULA_LABEL[item.withholding?.formulaCode ?? ''] ?? item.withholding?.formulaCode ?? '-'}
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
  input:        { padding: '8px 10px', border: '1px solid rgba(91,164,217,0.2)', borderRadius: '6px', fontSize: '14px', background: '#243144' },
  btn:          { padding: '8px 16px', background: '#F47920', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 },
  msg:          { padding: '12px 16px', background: 'rgba(91,164,217,0.1)', borderRadius: '8px', marginBottom: '16px', fontSize: '14px', color: '#4A93C8' },
  summaryCard:  { background: '#243144', borderRadius: '10px', padding: '16px 20px', minWidth: '140px', boxShadow: '0 2px 8px rgba(0,0,0,0.35)' },
  tableCard:    { background: '#243144', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.35)', overflow: 'hidden' },
  table:        { width: '100%', borderCollapse: 'collapse' as const },
  th:           { padding: '12px 16px', textAlign: 'left' as const, fontSize: '12px', fontWeight: 600, color: '#A0AEC0', borderBottom: '1px solid rgba(91,164,217,0.2)', whiteSpace: 'nowrap' as const },
  td:           { padding: '12px 16px', fontSize: '13px', color: '#CBD5E0', borderBottom: '1px solid rgba(91,164,217,0.1)', verticalAlign: 'top' as const },
  tr:           { cursor: 'default' },
}
