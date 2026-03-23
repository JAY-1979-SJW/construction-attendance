'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface InsuranceItem {
  id: string
  monthKey: string
  totalWorkDays: number
  totalConfirmedAmount: number
  nationalPensionEligible: boolean
  nationalPensionReason: string | null
  healthInsuranceEligible: boolean
  healthInsuranceReason: string | null
  employmentInsuranceEligible: boolean
  employmentInsuranceReason: string | null
  industrialAccidentEligible: boolean
  industrialAccidentReason: string | null
  worker: { id: string; name: string; employmentType: string; incomeType: string }
}

function getMonthKey() {
  const now = new Date(Date.now() + 9 * 3600000)
  return now.toISOString().slice(0, 7)
}

const EMP_LABEL: Record<string, string> = { REGULAR: '상용', DAILY_CONSTRUCTION: '건설일용', BUSINESS_33: '3.3%사업', OTHER: '기타' }

export default function InsuranceEligibilityPage() {
  const router = useRouter()
  const [monthKey, setMonthKey] = useState(getMonthKey())
  const [filter, setFilter]     = useState('all')
  const [items, setItems]       = useState<InsuranceItem[]>([])
  const [loading, setLoading]   = useState(false)
  const [running, setRunning]   = useState(false)
  const [msg, setMsg]           = useState('')

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/admin/insurance-eligibility?monthKey=${monthKey}&filter=${filter}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) { router.push('/admin/login'); return }
        setItems(d.data.items)
        setLoading(false)
      })
  }, [monthKey, filter, router])

  useEffect(() => { load() }, [load])

  const handleRun = async () => {
    if (!confirm(`${monthKey} 보험판정을 실행하시겠습니까?\n(근무확정이 완료된 상태여야 합니다)`)) return
    setRunning(true)
    const r = await fetch('/api/admin/insurance-eligibility/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monthKey }),
    }).then((r) => r.json())
    setRunning(false)
    setMsg(r.success ? `판정 완료 — 신규 ${r.data.created}건, 갱신 ${r.data.updated}건` : '실패')
    load()
  }

  const fmt = (n: number) => n.toLocaleString('ko-KR') + '원'
  const check = (v: boolean) => v ? <span style={{ color: '#2e7d32', fontWeight: 700 }}>✅ 적용</span>
                                  : <span style={{ color: '#A0AEC0' }}>✗ 제외</span>

  return (
    <div style={s.layout}>
      <nav style={s.sidebar}>
        <div style={s.sidebarTitle}>해한 출퇴근</div>
        <div style={s.navSection}>관리</div>
        {NAV_ITEMS.map((item) => (
          <Link key={item.href} href={item.href} style={{ ...s.navItem, ...(item.href === '/admin/insurance-eligibility' ? s.navActive : {}) }}>
            {item.label}
          </Link>
        ))}
        <button onClick={() => fetch('/api/admin/auth/logout', { method: 'POST' }).then(() => router.push('/admin/login'))} style={s.logoutBtn}>로그아웃</button>
      </nav>

      <main style={s.main}>
        <h1 style={s.pageTitle}>4대보험 적용 판정</h1>
        <p style={{ fontSize: '13px', color: '#A0AEC0', margin: '-12px 0 20px' }}>
          국민연금 월 8일 이상/220만원 이상 · 건강보험 1개월 미만 일용 제외 · 고용보험 근로내용확인신고 대상
        </p>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="month" value={monthKey} onChange={(e) => setMonthKey(e.target.value)} style={s.input} />
          <select value={filter} onChange={(e) => setFilter(e.target.value)} style={s.input}>
            <option value="all">전체</option>
            <option value="eligible">국민연금 적용</option>
            <option value="ineligible">국민연금 제외</option>
          </select>
          <button onClick={handleRun} disabled={running} style={{ ...s.btn, background: '#7b1fa2' }}>
            {running ? '판정 중...' : '보험판정 실행'}
          </button>
        </div>

        {msg && <div style={s.msg}>{msg}</div>}

        <div style={s.tableCard}>
          {loading ? <div style={{ padding: '32px', textAlign: 'center', color: '#999' }}>로딩 중...</div> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    {['근로자', '고용형태', '근무일수', '확정금액', '국민연금', '건강보험', '고용보험', '산재보험'].map((h) => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: '#999' }}>데이터 없음 — 보험판정 실행을 먼저 하세요</td></tr>
                  ) : items.map((item) => (
                    <tr key={item.id} style={s.tr}>
                      <td style={s.td}>{item.worker.name}</td>
                      <td style={s.td}>{EMP_LABEL[item.worker.employmentType] ?? item.worker.employmentType}</td>
                      <td style={{ ...s.td, textAlign: 'center' as const }}>{item.totalWorkDays}일</td>
                      <td style={{ ...s.td, textAlign: 'right' as const }}>{fmt(item.totalConfirmedAmount)}</td>
                      <td style={s.td}>
                        {check(item.nationalPensionEligible)}
                        <div style={{ fontSize: '11px', color: '#A0AEC0', marginTop: '2px' }}>{item.nationalPensionReason ?? ''}</div>
                      </td>
                      <td style={s.td}>
                        {check(item.healthInsuranceEligible)}
                        <div style={{ fontSize: '11px', color: '#A0AEC0', marginTop: '2px' }}>{item.healthInsuranceReason ?? ''}</div>
                      </td>
                      <td style={s.td}>
                        {check(item.employmentInsuranceEligible)}
                        <div style={{ fontSize: '11px', color: '#A0AEC0', marginTop: '2px' }}>{item.employmentInsuranceReason ?? ''}</div>
                      </td>
                      <td style={s.td}>
                        {check(item.industrialAccidentEligible)}
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
  { href: '/admin',                      label: '대시보드' },
  { href: '/admin/workers',              label: '근로자 관리' },
  { href: '/admin/companies',           label: '회사 관리' },
  { href: '/admin/sites',                label: '현장 관리' },
  { href: '/admin/attendance',           label: '출퇴근 조회' },
  { href: '/admin/presence-checks',      label: '체류확인 현황' },
  { href: '/admin/presence-report',      label: '체류확인 리포트' },
  { href: '/admin/work-confirmations',   label: '근무확정' },
  { href: '/admin/contracts',            label: '인력/계약 관리' },
  { href: '/admin/insurance-eligibility', label: '보험판정' },
  { href: '/admin/wage-calculations',    label: '세금/노임 계산' },
  { href: '/admin/filing-exports',       label: '신고자료 내보내기' },
  { href: '/admin/exceptions',           label: '예외 승인' },
  { href: '/admin/device-requests',      label: '기기 변경' },
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
  pageTitle:    { fontSize: '24px', fontWeight: 700, margin: '0 0 8px' },
  input:        { padding: '8px 10px', border: '1px solid rgba(91,164,217,0.2)', borderRadius: '6px', fontSize: '14px', background: 'white' },
  btn:          { padding: '8px 16px', background: '#F47920', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 },
  msg:          { padding: '12px 16px', background: 'rgba(91,164,217,0.1)', borderRadius: '8px', marginBottom: '16px', fontSize: '14px', color: '#4A93C8' },
  tableCard:    { background: '#243144', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.35)', overflow: 'hidden' },
  table:        { width: '100%', borderCollapse: 'collapse' as const },
  th:           { padding: '12px 16px', textAlign: 'left' as const, fontSize: '12px', fontWeight: 600, color: '#A0AEC0', borderBottom: '1px solid rgba(91,164,217,0.2)', whiteSpace: 'nowrap' as const },
  td:           { padding: '12px 16px', fontSize: '13px', color: '#CBD5E0', borderBottom: '1px solid rgba(91,164,217,0.1)', verticalAlign: 'top' as const },
  tr:           { cursor: 'default' },
}
