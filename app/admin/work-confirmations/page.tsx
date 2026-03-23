'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface WorkConfirmation {
  id: string
  workDate: string
  confirmationStatus: string
  confirmedWorkType: string | null
  confirmedWorkUnits: number
  confirmedBaseAmount: number
  confirmedAllowanceAmount: number
  confirmedTotalAmount: number
  incomeTypeSnapshot: string | null
  employmentTypeSnapshot: string | null
  notes: string | null
  worker: { id: string; name: string; jobTitle: string; employmentType: string; incomeType: string }
  site: { id: string; name: string }
  attendanceDay: { firstCheckInAt: string | null; lastCheckOutAt: string | null; presenceStatus: string } | null
}

interface Summary { total: number; draft: number; confirmed: number; excluded: number; totalAmount: number }

const STATUS_LABEL: Record<string, string> = { DRAFT: '미확정', CONFIRMED: '확정', EXCLUDED: '제외' }
const STATUS_COLOR: Record<string, string> = { DRAFT: '#e65100', CONFIRMED: '#2e7d32', EXCLUDED: '#888' }
const WORK_TYPE_LABEL: Record<string, string> = {
  FULL_DAY: '1공수', HALF_DAY: '0.5공수', OVERTIME: '연장', NIGHT: '야간', HOLIDAY: '휴일', INVALID: '무효',
}
const INCOME_LABEL: Record<string, string> = { SALARY: '상용급여', DAILY_WAGE: '일용', BUSINESS_INCOME: '3.3%' }

function getMonthKey() {
  const now = new Date(Date.now() + 9 * 3600000)
  return now.toISOString().slice(0, 7)
}

export default function WorkConfirmationsPage() {
  const router = useRouter()
  const [monthKey, setMonthKey] = useState(getMonthKey())
  const [items, setItems]       = useState<WorkConfirmation[]>([])
  const [summary, setSummary]   = useState<Summary | null>(null)
  const [loading, setLoading]   = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [generating, setGenerating] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [editTarget, setEditTarget] = useState<WorkConfirmation | null>(null)
  const [editForm, setEditForm]   = useState({ workType: '', workUnits: '', baseAmount: '', allowanceAmount: '', notes: '' })
  const [saving, setSaving]       = useState(false)
  const [msg, setMsg]             = useState('')

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/admin/work-confirmations?monthKey=${monthKey}&status=${statusFilter}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) { router.push('/admin/login'); return }
        setItems(d.data.items)
        setSummary(d.data.summary)
        setLoading(false)
      })
  }, [monthKey, statusFilter, router])

  useEffect(() => { load() }, [load])

  const handleGenerate = async () => {
    if (!confirm(`${monthKey} 근무확정 초안을 생성하시겠습니까?`)) return
    setGenerating(true)
    const r = await fetch('/api/admin/work-confirmations/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monthKey }),
    }).then((r) => r.json())
    setGenerating(false)
    setMsg(r.success ? `생성 완료 — 신규 ${r.data.created}건, 갱신 ${r.data.skipped}건` : '생성 실패')
    load()
  }

  const handleFinalize = async () => {
    if (!confirm(`${monthKey} 전체 미확정 건을 일괄 확정하시겠습니까?\n(보험판정·세금계산도 자동 실행됩니다)`)) return
    setFinalizing(true)
    const r = await fetch('/api/admin/work-confirmations/finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monthKey }),
    }).then((r) => r.json())
    setFinalizing(false)
    setMsg(r.success ? `일괄 확정 완료 — ${r.data.confirmed}건 확정` : '실패')
    load()
  }

  const openEdit = (item: WorkConfirmation) => {
    setEditTarget(item)
    setEditForm({
      workType:       item.confirmedWorkType ?? 'FULL_DAY',
      workUnits:      String(item.confirmedWorkUnits),
      baseAmount:     String(item.confirmedBaseAmount),
      allowanceAmount: String(item.confirmedAllowanceAmount),
      notes:          item.notes ?? '',
    })
  }

  const handleSave = async (action: 'confirm' | 'exclude' | 'reset') => {
    if (!editTarget) return
    setSaving(true)
    const r = await fetch(`/api/admin/work-confirmations/${editTarget.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        workType:       editForm.workType,
        workUnits:      parseFloat(editForm.workUnits) || 1,
        baseAmount:     parseInt(editForm.baseAmount) || 0,
        allowanceAmount: parseInt(editForm.allowanceAmount) || 0,
        notes:          editForm.notes,
      }),
    }).then((r) => r.json())
    setSaving(false)
    if (r.success) { setEditTarget(null); load() }
    else setMsg('저장 실패: ' + r.message)
  }

  const fmt = (n: number) => n.toLocaleString('ko-KR') + '원'
  const fmtTime = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-'

  return (
    <div style={s.layout}>
      <nav style={s.sidebar}>
        <div style={s.sidebarTitle}>해한 출퇴근</div>
        <div style={s.navSection}>관리</div>
        {NAV_ITEMS.map((item) => (
          <Link key={item.href} href={item.href} style={{ ...s.navItem, ...(item.href === '/admin/work-confirmations' ? s.navActive : {}) }}>
            {item.label}
          </Link>
        ))}
        <button onClick={() => fetch('/api/admin/auth/logout', { method: 'POST' }).then(() => router.push('/admin/login'))} style={s.logoutBtn}>로그아웃</button>
      </nav>

      <main style={s.main}>
        <h1 style={s.pageTitle}>근무확정</h1>

        {/* 컨트롤 */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="month" value={monthKey} onChange={(e) => setMonthKey(e.target.value)} style={s.input} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={s.input}>
            <option value="">전체 상태</option>
            <option value="DRAFT">미확정</option>
            <option value="CONFIRMED">확정</option>
            <option value="EXCLUDED">제외</option>
          </select>
          <button onClick={handleGenerate} disabled={generating} style={s.btn}>
            {generating ? '생성 중...' : '초안 생성'}
          </button>
          <button onClick={handleFinalize} disabled={finalizing} style={{ ...s.btn, background: '#2e7d32' }}>
            {finalizing ? '확정 중...' : '전체 확정 + 보험/세금 계산'}
          </button>
        </div>

        {msg && <div style={s.msg}>{msg}</div>}

        {/* 요약 */}
        {summary && (
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {[
              { label: '전체', value: summary.total,     color: '#37474f' },
              { label: '미확정', value: summary.draft,   color: '#e65100' },
              { label: '확정',  value: summary.confirmed, color: '#2e7d32' },
              { label: '제외',  value: summary.excluded,  color: '#A0AEC0' },
              { label: '확정 노임 합계', value: fmt(summary.totalAmount), color: '#4A93C8' },
            ].map((c) => (
              <div key={c.label} style={{ ...s.summaryCard, borderTop: `4px solid ${c.color}` }}>
                <div style={{ fontSize: '20px', fontWeight: 700, color: c.color }}>{c.value}</div>
                <div style={{ fontSize: '12px', color: '#A0AEC0' }}>{c.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* 테이블 */}
        <div style={s.tableCard}>
          {loading ? <div style={{ padding: '32px', textAlign: 'center', color: '#999' }}>로딩 중...</div> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    {['날짜', '근로자', '현장', '출근', '퇴근', '소득유형', '공수', '확정보수', '상태', ''].map((h) => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={10} style={{ textAlign: 'center', padding: '24px', color: '#999' }}>데이터 없음 — 초안 생성을 먼저 실행하세요</td></tr>
                  ) : items.map((item) => (
                    <tr key={item.id} style={s.tr}>
                      <td style={s.td}>{item.workDate}</td>
                      <td style={s.td}>{item.worker.name}</td>
                      <td style={s.td}>{item.site.name}</td>
                      <td style={s.td}>{fmtTime(item.attendanceDay?.firstCheckInAt ?? null)}</td>
                      <td style={s.td}>{fmtTime(item.attendanceDay?.lastCheckOutAt ?? null)}</td>
                      <td style={s.td}>{INCOME_LABEL[item.incomeTypeSnapshot ?? ''] ?? item.incomeTypeSnapshot}</td>
                      <td style={s.td}>
                        {WORK_TYPE_LABEL[item.confirmedWorkType ?? ''] ?? '-'}
                        <br /><span style={{ fontSize: '11px', color: '#A0AEC0' }}>{item.confirmedWorkUnits}공수</span>
                      </td>
                      <td style={{ ...s.td, textAlign: 'right' as const }}>{fmt(item.confirmedTotalAmount)}</td>
                      <td style={s.td}>
                        <span style={{ color: STATUS_COLOR[item.confirmationStatus], fontWeight: 600, fontSize: '13px' }}>
                          {STATUS_LABEL[item.confirmationStatus] ?? item.confirmationStatus}
                        </span>
                      </td>
                      <td style={s.td}>
                        {item.confirmationStatus !== 'CONFIRMED' && (
                          <button onClick={() => openEdit(item)} style={s.editBtn}>수정/확정</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* 확정 모달 */}
      {editTarget && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <h3 style={{ margin: '0 0 16px' }}>{editTarget.workDate} — {editTarget.worker.name}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={s.label}>근무 유형</label>
                <select value={editForm.workType} onChange={(e) => setEditForm({ ...editForm, workType: e.target.value })} style={s.input}>
                  {Object.entries(WORK_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label style={s.label}>공수</label>
                <input type="number" step="0.5" value={editForm.workUnits} onChange={(e) => setEditForm({ ...editForm, workUnits: e.target.value })} style={s.input} />
              </div>
              <div>
                <label style={s.label}>기본 보수</label>
                <input type="number" value={editForm.baseAmount} onChange={(e) => setEditForm({ ...editForm, baseAmount: e.target.value })} style={s.input} />
              </div>
              <div>
                <label style={s.label}>수당</label>
                <input type="number" value={editForm.allowanceAmount} onChange={(e) => setEditForm({ ...editForm, allowanceAmount: e.target.value })} style={s.input} />
              </div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={s.label}>메모</label>
              <input value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} style={{ ...s.input, width: '100%' }} />
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => handleSave('exclude')} disabled={saving} style={{ ...s.btn, background: '#b71c1c' }}>무효 처리</button>
              <button onClick={() => handleSave('confirm')} disabled={saving} style={{ ...s.btn, background: '#2e7d32' }}>{saving ? '저장 중...' : '확정'}</button>
              <button onClick={() => setEditTarget(null)} style={s.btnCancel}>취소</button>
            </div>
          </div>
        </div>
      )}
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
  pageTitle:    { fontSize: '24px', fontWeight: 700, margin: '0 0 24px' },
  input:        { padding: '8px 10px', border: '1px solid rgba(91,164,217,0.2)', borderRadius: '6px', fontSize: '14px', background: '#243144' },
  btn:          { padding: '8px 16px', background: '#F47920', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 },
  btnCancel:    { padding: '8px 16px', background: 'rgba(91,164,217,0.1)', color: '#A0AEC0', border: '1px solid rgba(91,164,217,0.2)', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' },
  msg:          { padding: '12px 16px', background: 'rgba(91,164,217,0.1)', borderRadius: '8px', marginBottom: '16px', fontSize: '14px', color: '#4A93C8' },
  summaryCard:  { background: '#243144', borderRadius: '10px', padding: '16px 20px', minWidth: '120px', boxShadow: '0 2px 8px rgba(0,0,0,0.35)' },
  tableCard:    { background: '#243144', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.35)', overflow: 'hidden' },
  table:        { width: '100%', borderCollapse: 'collapse' as const },
  th:           { padding: '12px 16px', textAlign: 'left' as const, fontSize: '12px', fontWeight: 600, color: '#A0AEC0', borderBottom: '1px solid rgba(91,164,217,0.2)', whiteSpace: 'nowrap' as const },
  td:           { padding: '12px 16px', fontSize: '13px', color: '#CBD5E0', borderBottom: '1px solid rgba(91,164,217,0.1)', verticalAlign: 'top' as const },
  tr:           { cursor: 'default' },
  editBtn:      { padding: '4px 10px', fontSize: '12px', background: '#F47920', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' },
  overlay:      { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:        { background: '#243144', borderRadius: '16px', padding: '32px', width: '480px', maxWidth: '90vw', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' },
  label:        { display: 'block', fontSize: '12px', color: '#A0AEC0', marginBottom: '4px', fontWeight: 600 },
}
