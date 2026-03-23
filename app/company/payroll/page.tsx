'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface PayrollRow {
  workerId: string
  workerName: string
  employmentType: string
  incomeType: string
  workDays: number
  workUnits: number
  grossAmount: number
  incomeTax: number
  localTax: number
  netAmount: number
  confirmedCount: number
  hasWageCalc: boolean
}

interface Totals {
  workerCount: number
  workUnits: number
  grossAmount: number
  taxAmount: number
  netAmount: number
}

const EMP_LABEL: Record<string, string> = {
  DAILY_CONSTRUCTION: '일용직',
  REGULAR:            '상용직',
  BUSINESS_33:        '사업소득',
  OTHER:              '기타',
}

const INCOME_LABEL: Record<string, string> = {
  DAILY_WAGE:       '일당',
  SALARY:           '월급',
  BUSINESS_INCOME:  '사업소득',
}

function fmt(n: number) {
  return n.toLocaleString('ko-KR') + '원'
}

function currentMonthKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function CompanyPayrollPage() {
  const router = useRouter()
  const [monthKey, setMonthKey] = useState(currentMonthKey())
  const [items, setItems] = useState<PayrollRow[]>([])
  const [totals, setTotals] = useState<Totals | null>(null)
  const [totalWorkers, setTotalWorkers] = useState(0)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [blocked, setBlocked] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setMsg('')
    try {
      const res = await fetch(`/api/company/payroll?monthKey=${monthKey}`)
      if (res.status === 401) { router.push('/company/login'); return }
      if (res.status === 403) {
        setBlocked(true)
        const d = await res.json()
        setMsg(d.message ?? '이 기능을 사용할 권한이 없습니다. 플랜 업그레이드가 필요합니다.')
        return
      }
      const data = await res.json()
      if (!data.success) { setMsg(data.message ?? '조회 실패'); return }
      setItems(data.data.items ?? [])
      setTotals(data.data.totals ?? null)
      setTotalWorkers(data.data.totalWorkers ?? 0)
      setBlocked(false)
    } catch {
      setMsg('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [monthKey, router])

  useEffect(() => { load() }, [load])

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}>공수 · 급여 현황</h1>
          <p style={s.sub}>월별 근로자별 공수 확정 및 임금 집계를 조회합니다.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select value={monthKey} onChange={e => setMonthKey(e.target.value)} style={s.select}>
            {months.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <button onClick={load} disabled={loading} style={s.btn}>
            {loading ? '조회중...' : '조회'}
          </button>
        </div>
      </div>

      {msg && (
        <div style={{ background: blocked ? '#fff3e0' : '#ffebee', color: blocked ? '#e65100' : '#c62828', padding: '14px 18px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>
          {msg}
          {blocked && <div style={{ marginTop: '6px', fontSize: '13px' }}>관리자(슈퍼관리자)에게 기능 활성화를 요청하세요.</div>}
        </div>
      )}

      {!blocked && totals && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {[
            { label: '대상 근로자', value: `${totalWorkers}명` },
            { label: '공수 집계 근로자', value: `${totals.workerCount}명` },
            { label: '총 공수', value: `${totals.workUnits.toFixed(2)}일` },
            { label: '총 지급액', value: fmt(totals.grossAmount) },
            { label: '총 세금', value: fmt(totals.taxAmount) },
            { label: '총 실지급', value: fmt(totals.netAmount) },
          ].map(({ label, value }) => (
            <div key={label} style={s.statCard}>
              <div style={s.statValue}>{value}</div>
              <div style={s.statLabel}>{label}</div>
            </div>
          ))}
        </div>
      )}

      <div style={s.tableCard}>
        {loading ? (
          <div style={s.empty}>조회 중...</div>
        ) : blocked ? (
          <div style={s.empty}>
            <div style={{ fontSize: '32px', marginBottom: '10px' }}>🔒</div>
            <div style={{ fontWeight: 600 }}>급여 조회 기능이 비활성화되어 있습니다.</div>
          </div>
        ) : items.length === 0 ? (
          <div style={s.empty}>
            <div style={{ fontWeight: 600 }}>{monthKey} 공수 데이터가 없습니다.</div>
            <div style={{ fontSize: '13px', color: '#aaa', marginTop: '4px' }}>근무 확정 후 조회 가능합니다.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={s.table}>
              <thead>
                <tr>
                  {['근로자명', '고용형태', '소득유형', '근무일수', '공수(일)', '지급총액', '소득세', '지방세', '실지급액', '임금계산'].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((row, i) => (
                  <tr key={row.workerId} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td style={{ ...s.td, fontWeight: 600 }}>{row.workerName}</td>
                    <td style={s.td}>{EMP_LABEL[row.employmentType] ?? row.employmentType}</td>
                    <td style={s.td}>{INCOME_LABEL[row.incomeType] ?? row.incomeType}</td>
                    <td style={{ ...s.td, textAlign: 'right' }}>{row.workDays}일</td>
                    <td style={{ ...s.td, textAlign: 'right' }}>{row.workUnits.toFixed(2)}</td>
                    <td style={{ ...s.td, textAlign: 'right' }}>{fmt(row.grossAmount)}</td>
                    <td style={{ ...s.td, textAlign: 'right', color: '#c62828' }}>{fmt(row.incomeTax)}</td>
                    <td style={{ ...s.td, textAlign: 'right', color: '#c62828' }}>{fmt(row.localTax)}</td>
                    <td style={{ ...s.td, textAlign: 'right', fontWeight: 600 }}>{fmt(row.netAmount)}</td>
                    <td style={s.td}>
                      <span style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '8px',
                        background: row.hasWageCalc ? '#e8f5e9' : '#f5f5f5',
                        color: row.hasWageCalc ? '#2e7d32' : '#999',
                      }}>
                        {row.hasWageCalc ? '계산 완료' : '미계산'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              {totals && (
                <tfoot>
                  <tr style={{ background: '#f0f4ff', fontWeight: 700 }}>
                    <td style={s.td} colSpan={3}>합계</td>
                    <td style={{ ...s.td, textAlign: 'right' }}></td>
                    <td style={{ ...s.td, textAlign: 'right' }}>{totals.workUnits.toFixed(2)}</td>
                    <td style={{ ...s.td, textAlign: 'right' }}>{fmt(totals.grossAmount)}</td>
                    <td style={{ ...s.td, textAlign: 'right', color: '#c62828' }}>{fmt(totals.taxAmount)}</td>
                    <td style={{ ...s.td, textAlign: 'right', color: '#c62828' }}></td>
                    <td style={{ ...s.td, textAlign: 'right' }}>{fmt(totals.netAmount)}</td>
                    <td style={s.td}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page:       { padding: '32px', maxWidth: '1200px' },
  header:     { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' },
  title:      { fontSize: '22px', fontWeight: 700, margin: 0 },
  sub:        { fontSize: '13px', color: '#A0AEC0', margin: '4px 0 0' },
  select:     { padding: '8px 12px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', cursor: 'pointer' },
  btn:        { padding: '8px 20px', background: '#0f4c75', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 },
  statCard:   { background: '#243144', borderRadius: '10px', padding: '14px 20px', minWidth: '130px', boxShadow: '0 2px 8px rgba(0,0,0,0.35)', textAlign: 'center' },
  statValue:  { fontSize: '18px', fontWeight: 700, color: '#1a237e', marginBottom: '4px' },
  statLabel:  { fontSize: '12px', color: '#A0AEC0' },
  tableCard:  { background: '#243144', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.35)', overflow: 'hidden' },
  table:      { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th:         { background: '#f8f9fa', padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#555', borderBottom: '1px solid #e0e0e0', whiteSpace: 'nowrap' },
  td:         { padding: '10px 12px', borderBottom: '1px solid rgba(91,164,217,0.1)', verticalAlign: 'middle' },
  empty:      { padding: '48px', textAlign: 'center', color: '#999' },
}
