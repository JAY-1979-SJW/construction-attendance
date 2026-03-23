'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface InsuranceRow {
  workerId: string
  workerName: string
  employmentType: string
  fourInsurancesEligibleYn: boolean
  retirementMutualTargetYn: boolean
  totalWorkDays: number | null
  totalConfirmedAmount: number | null
  nationalPension:     { eligible: boolean | null; reason: string }
  healthInsurance:     { eligible: boolean | null; reason: string }
  employmentInsurance: { eligible: boolean | null; reason: string }
  industrialAccident:  { eligible: boolean | null; reason: string }
  hasSnapshot: boolean
}

interface Summary {
  total: number
  npEligible: number
  hiEligible: number
  eiEligible: number
  iaEligible: number
  noSnapshot: number
}

const EMP_LABEL: Record<string, string> = {
  DAILY_CONSTRUCTION: '일용직',
  REGULAR:            '상용직',
  BUSINESS_33:        '사업소득',
  OTHER:              '기타',
}

function EligibleBadge({ eligible, reason }: { eligible: boolean | null; reason: string }) {
  if (eligible === null) return <span style={{ fontSize: '11px', color: '#bbb' }} title={reason}>미판정</span>
  return (
    <span
      title={reason}
      style={{
        fontSize: '11px',
        padding: '2px 8px',
        borderRadius: '8px',
        background: eligible ? '#e8f5e9' : '#ffebee',
        color: eligible ? '#2e7d32' : '#c62828',
        cursor: 'help',
      }}
    >
      {eligible ? '대상' : '제외'}
    </span>
  )
}

function currentMonthKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function CompanyInsurancePage() {
  const router = useRouter()
  const [monthKey, setMonthKey] = useState(currentMonthKey())
  const [items, setItems] = useState<InsuranceRow[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [blocked, setBlocked] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setMsg('')
    try {
      const res = await fetch(`/api/company/insurance?monthKey=${monthKey}`)
      if (res.status === 401) { router.push('/company/login'); return }
      if (res.status === 403) {
        setBlocked(true)
        const d = await res.json()
        setMsg(d.message ?? '이 기능은 유료 플랜에서 사용 가능합니다.')
        return
      }
      const data = await res.json()
      if (!data.success) { setMsg(data.message ?? '조회 실패'); return }
      setItems(data.data.items ?? [])
      setSummary(data.data.summary ?? null)
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
          <h1 style={s.title}>4대보험 판정 현황</h1>
          <p style={s.sub}>국민연금 · 건강보험 · 고용보험 · 산재보험 대상 여부를 월별로 확인합니다.</p>
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

      {!blocked && summary && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {[
            { label: '전체 근로자', value: `${summary.total}명` },
            { label: '국민연금 대상', value: `${summary.npEligible}명`, color: '#4A93C8' },
            { label: '건강보험 대상', value: `${summary.hiEligible}명`, color: '#2e7d32' },
            { label: '고용보험 대상', value: `${summary.eiEligible}명`, color: '#6a1b9a' },
            { label: '산재보험 대상', value: `${summary.iaEligible}명`, color: '#e65100' },
            { label: '판정 미실행', value: `${summary.noSnapshot}명`, color: '#A0AEC0' },
          ].map(({ label, value, color }) => (
            <div key={label} style={s.statCard}>
              <div style={{ ...s.statValue, color: color ?? '#1a237e' }}>{value}</div>
              <div style={s.statLabel}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {!blocked && summary && summary.noSnapshot > 0 && (
        <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: '8px', padding: '10px 16px', marginBottom: '16px', fontSize: '13px', color: '#f57f17' }}>
          ※ 판정 미실행 근로자 {summary.noSnapshot}명 — 슈퍼관리자 메뉴에서 &apos;보험판정 실행&apos; 후 조회 가능합니다.
        </div>
      )}

      <div style={s.tableCard}>
        {loading ? (
          <div style={s.empty}>조회 중...</div>
        ) : blocked ? (
          <div style={s.empty}>
            <div style={{ fontSize: '32px', marginBottom: '10px' }}>🔒</div>
            <div style={{ fontWeight: 600 }}>4대보험 서류 기능이 비활성화되어 있습니다.</div>
          </div>
        ) : items.length === 0 ? (
          <div style={s.empty}>
            <div style={{ fontWeight: 600 }}>{monthKey} 소속 근로자가 없습니다.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={s.table}>
              <thead>
                <tr>
                  {['근로자명', '고용형태', '4보험대상', '퇴직공제', '근무일수', '확정금액', '국민연금', '건강보험', '고용보험', '산재보험'].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((row, i) => (
                  <tr key={row.workerId} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td style={{ ...s.td, fontWeight: 600 }}>{row.workerName}</td>
                    <td style={s.td}>{EMP_LABEL[row.employmentType] ?? row.employmentType}</td>
                    <td style={s.td}>
                      <EligibleBadge eligible={row.fourInsurancesEligibleYn} reason="근로자 기본 설정" />
                    </td>
                    <td style={s.td}>
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '8px',
                        background: row.retirementMutualTargetYn ? '#e3f2fd' : '#f5f5f5',
                        color: row.retirementMutualTargetYn ? '#1565c0' : '#999' }}>
                        {row.retirementMutualTargetYn ? '대상' : '제외'}
                      </span>
                    </td>
                    <td style={{ ...s.td, textAlign: 'right' }}>
                      {row.totalWorkDays != null ? `${row.totalWorkDays}일` : '-'}
                    </td>
                    <td style={{ ...s.td, textAlign: 'right' }}>
                      {row.totalConfirmedAmount != null ? row.totalConfirmedAmount.toLocaleString('ko-KR') + '원' : '-'}
                    </td>
                    <td style={s.td}><EligibleBadge eligible={row.nationalPension.eligible} reason={row.nationalPension.reason} /></td>
                    <td style={s.td}><EligibleBadge eligible={row.healthInsurance.eligible} reason={row.healthInsurance.reason} /></td>
                    <td style={s.td}><EligibleBadge eligible={row.employmentInsurance.eligible} reason={row.employmentInsurance.reason} /></td>
                    <td style={s.td}><EligibleBadge eligible={row.industrialAccident.eligible} reason={row.industrialAccident.reason} /></td>
                  </tr>
                ))}
              </tbody>
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
  statCard:   { background: '#243144', borderRadius: '10px', padding: '14px 20px', minWidth: '120px', boxShadow: '0 2px 8px rgba(0,0,0,0.35)', textAlign: 'center' },
  statValue:  { fontSize: '18px', fontWeight: 700, marginBottom: '4px' },
  statLabel:  { fontSize: '12px', color: '#A0AEC0' },
  tableCard:  { background: '#243144', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.35)', overflow: 'hidden' },
  table:      { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th:         { background: '#f8f9fa', padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#555', borderBottom: '1px solid #e0e0e0', whiteSpace: 'nowrap' },
  td:         { padding: '10px 12px', borderBottom: '1px solid rgba(91,164,217,0.1)', verticalAlign: 'middle' },
  empty:      { padding: '48px', textAlign: 'center', color: '#999' },
}
