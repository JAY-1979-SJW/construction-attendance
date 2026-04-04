'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Modal, MobileCardList, MobileCard, MobileCardField, MobileCardFields, MobileCardActions } from '@/components/admin/ui'

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
  attendanceDay: { firstCheckInAt: string | null; lastCheckOutAt: string | null; presenceStatus: string; manualAdjustedYn: boolean } | null
  updatedAt: string
}

interface Summary { total: number; draft: number; confirmed: number; excluded: number; totalAmount: number }

const STATUS_LABEL: Record<string, string> = { DRAFT: '미확정', CONFIRMED: '확정', EXCLUDED: '제외' }
const STATUS_COLOR: Record<string, string> = { DRAFT: '#e65100', CONFIRMED: '#2e7d32', EXCLUDED: '#888' }
const WORK_TYPE_LABEL: Record<string, string> = {
  FULL_DAY: '1공수', HALF_DAY: '0.5공수', OVERTIME: '연장', NIGHT: '야간', HOLIDAY: '휴일', INVALID: '무효',
}
const INCOME_LABEL: Record<string, string> = { SALARY: '상용급여', DAILY_WAGE: '일용', BUSINESS_INCOME: '3.3%' }

// DRAFT 우선순위 배지: 왜 상단에 노출되는지 표시
function getDraftPriorityBadge(item: WorkConfirmation): { label: string; color: string } | null {
  if (item.confirmationStatus !== 'DRAFT') return null
  if (item.attendanceDay?.manualAdjustedYn) return { label: '수동조정', color: '#78909c' }
  const ps = item.attendanceDay?.presenceStatus
  if (ps === 'REVIEW_REQUIRED')  return { label: '요주의', color: '#c62828' }
  if (ps === 'OUT_OF_GEOFENCE')  return { label: '지오펜스이탈', color: '#e65100' }
  if (ps === 'NO_RESPONSE')      return { label: '미응답', color: '#f57c00' }
  const wt = item.confirmedWorkType
  if (wt === 'INVALID')          return { label: '무효처리', color: '#b71c1c' }
  if (wt === 'HALF_DAY')         return { label: '반일', color: '#6d4c41' }
  return null
}

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
  const [generating, setGenerating]       = useState(false)
  const [autoConfirming, setAutoConfirming] = useState(false)
  const [finalizing, setFinalizing]       = useState(false)
  const [editTarget, setEditTarget] = useState<WorkConfirmation | null>(null)
  const [editForm, setEditForm]   = useState({ workType: '', workUnits: '', baseAmount: '', allowanceAmount: '', notes: '' })
  const [saving, setSaving]       = useState(false)
  const [msg, setMsg]             = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkProcessing, setBulkProcessing] = useState(false)

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

  useEffect(() => { load(); setSelectedIds(new Set()) }, [load])

  const draftItems = items.filter((i) => i.confirmationStatus === 'DRAFT')
  const allDraftSelected = draftItems.length > 0 && draftItems.every((i) => selectedIds.has(i.id))

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  const toggleSelectAll = () => {
    if (allDraftSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(draftItems.map((i) => i.id)))
    }
  }

  const handleBulk = async (action: 'confirm' | 'exclude') => {
    const ids = Array.from(selectedIds)
    if (!ids.length) return
    const label = action === 'confirm' ? '승인' : '반려(제외)'
    if (!confirm(`선택한 ${ids.length}건을 대량 ${label} 처리하시겠습니까?`)) return
    setBulkProcessing(true)
    setMsg('')
    const r = await fetch('/api/admin/work-confirmations/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, action }),
    }).then((res) => res.json())
    setBulkProcessing(false)
    if (r.success) {
      const { succeeded, failed } = r.data
      setMsg(`대량 ${label} 완료 — 성공 ${succeeded}건${failed > 0 ? ` | 실패 ${failed}건` : ''}`)
    } else {
      setMsg(`대량 ${label} 실패: ${r.message ?? '알 수 없는 오류'}`)
    }
    setSelectedIds(new Set())
    load()
  }

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

  const handleAutoConfirm = async () => {
    if (!confirm(`${monthKey} 기준으로 자동 확정을 실행하시겠습니까?\n\n대상: 정상 출퇴근(NORMAL) + 1공수(FULL_DAY) 건만 자동 확정\n나머지: DRAFT 유지 → 수동 검토 대기`)) return
    setAutoConfirming(true)
    setMsg('')
    const r = await fetch('/api/admin/work-confirmations/auto-confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monthKey }),
    }).then((r) => r.json())
    setAutoConfirming(false)
    if (r.success) {
      const { autoConfirmed, pendingReview, errors } = r.data
      setMsg(
        `자동 확정 완료 — 확정 ${autoConfirmed}건 | 검토 대기 ${pendingReview}건${errors ? ` | 오류 ${errors}건` : ''}`
      )
    } else {
      setMsg(`자동 확정 실패: ${r.message ?? '알 수 없는 오류'}`)
    }
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
    <>
    <div className="p-8 overflow-auto">
        <h1 className="text-2xl font-bold mb-6">근무확정</h1>

        {/* 컨트롤 */}
        <div className="flex gap-3 mb-5 flex-wrap items-center">
          <input type="month" value={monthKey} onChange={(e) => setMonthKey(e.target.value)} className="px-[10px] py-2 border border-[rgba(91,164,217,0.2)] rounded-md text-[14px] bg-card" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-[10px] py-2 border border-[rgba(91,164,217,0.2)] rounded-md text-[14px] bg-card">
            <option value="">전체 상태</option>
            <option value="DRAFT">미확정</option>
            <option value="CONFIRMED">확정</option>
            <option value="EXCLUDED">제외</option>
          </select>
          <button onClick={handleGenerate} disabled={generating} className="px-4 py-2 bg-accent text-white border-0 rounded-md cursor-pointer text-[14px] font-semibold">
            {generating ? '생성 중...' : '① 초안 생성'}
          </button>
          <button onClick={handleAutoConfirm} disabled={autoConfirming} className="px-4 py-2 bg-[#1565c0] text-white border-0 rounded-md cursor-pointer text-[14px] font-semibold">
            {autoConfirming ? '자동 확정 중...' : '② 자동 확정'}
          </button>
          <button onClick={handleFinalize} disabled={finalizing} className="px-4 py-2 bg-[#2e7d32] text-white border-0 rounded-md cursor-pointer text-[14px] font-semibold">
            {finalizing ? '확정 중...' : '③ 전체 확정 + 보험/세금 계산'}
          </button>
        </div>

        {msg && <div className="px-4 py-3 bg-[rgba(91,164,217,0.1)] rounded-lg mb-4 text-[14px] text-secondary-brand">{msg}</div>}

        {/* 대량 처리 툴바 — 선택 건 있을 때만 표시 */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 mb-4 px-4 py-3 rounded-lg bg-[rgba(21,101,192,0.07)] border border-[rgba(21,101,192,0.25)] flex-wrap">
            <span className="text-[13px] font-bold text-[#1565c0]">{selectedIds.size}건 선택됨</span>
            <button
              onClick={() => handleBulk('confirm')}
              disabled={bulkProcessing}
              className="px-3 py-1 text-[12px] bg-[#2e7d32] text-white rounded cursor-pointer border-0 font-semibold disabled:opacity-50"
            >
              {bulkProcessing ? '처리 중...' : '대량 승인'}
            </button>
            <button
              onClick={() => handleBulk('exclude')}
              disabled={bulkProcessing}
              className="px-3 py-1 text-[12px] bg-[#b71c1c] text-white rounded cursor-pointer border-0 font-semibold disabled:opacity-50"
            >
              {bulkProcessing ? '처리 중...' : '대량 반려'}
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              disabled={bulkProcessing}
              className="ml-auto px-3 py-1 text-[12px] bg-[rgba(91,164,217,0.1)] text-muted-brand border border-[rgba(91,164,217,0.2)] rounded cursor-pointer"
            >
              선택 해제
            </button>
          </div>
        )}

        {/* pendingReview 배너 */}
        {summary && (
          <div className={`flex items-center gap-3 mb-4 px-4 py-3 rounded-lg flex-wrap ${
            summary.draft > 0
              ? 'bg-[rgba(230,81,0,0.07)] border border-[rgba(230,81,0,0.22)]'
              : 'bg-[rgba(46,125,50,0.05)] border border-[rgba(46,125,50,0.18)]'
          }`}>
            {summary.draft > 0 ? (
              <>
                <span className="text-[13px] font-bold text-[#e65100]">🔍 검토 대기 {summary.draft}건</span>
                <span className="text-[12px] text-muted-brand">·</span>
                <span className="text-[12px] text-muted-brand">확정 {summary.confirmed}건 완료</span>
                <button
                  onClick={() => setStatusFilter('DRAFT')}
                  className="ml-auto px-3 py-1 text-[12px] bg-[#e65100] text-white rounded cursor-pointer border-0 font-semibold whitespace-nowrap"
                >
                  미확정 목록 보기 →
                </button>
              </>
            ) : (
              <span className="text-[13px] font-semibold text-[#2e7d32]">
                ✅ 검토 대기 없음 — 확정 {summary.confirmed}건 / 제외 {summary.excluded}건
              </span>
            )}
          </div>
        )}

        {/* 요약 */}
        {summary && (
          <div className="flex gap-3 mb-5 flex-wrap">
            {[
              { label: '전체', value: summary.total,     color: '#37474f' },
              { label: '미확정', value: summary.draft,   color: '#e65100' },
              { label: '확정',  value: summary.confirmed, color: '#2e7d32' },
              { label: '제외',  value: summary.excluded,  color: '#A0AEC0' },
              { label: '확정 노임 합계', value: fmt(summary.totalAmount), color: '#4A93C8' },
            ].map((c) => (
              <div key={c.label} className="bg-card rounded-[12px] px-5 py-4 min-w-[120px] shadow-[0_1px_3px_rgba(0,0,0,0.08)]" style={{ borderTop: `4px solid ${c.color}` }}>
                <div className="text-[20px] font-bold" style={{ color: c.color }}>{c.value}</div>
                <div className="text-[12px] text-muted-brand">{c.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* 테이블 */}
        <div className="bg-card rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] overflow-hidden">
          {loading ? <div className="py-8 text-center text-[#999]">로딩 중...</div> : (
            <MobileCardList
              items={items}
              emptyMessage="데이터 없음 — 초안 생성을 먼저 실행하세요"
              keyExtractor={(item) => item.id}
              renderCard={(item) => {
                const priorityBadge = getDraftPriorityBadge(item)
                return (
                <MobileCard
                  title={item.worker.name}
                  subtitle={`${item.workDate} · ${item.site.name}`}
                  badge={
                    <span className="flex items-center gap-1">
                      {priorityBadge && (
                        <span style={{ color: priorityBadge.color, fontWeight: 700, fontSize: '11px', background: `${priorityBadge.color}18`, padding: '1px 5px', borderRadius: '4px', border: `1px solid ${priorityBadge.color}44` }}>
                          {priorityBadge.label}
                        </span>
                      )}
                      <span style={{ color: STATUS_COLOR[item.confirmationStatus], fontWeight: 600, fontSize: '12px' }}>
                        {STATUS_LABEL[item.confirmationStatus] ?? item.confirmationStatus}
                      </span>
                    </span>
                  }
                >
                  <MobileCardFields>
                    <MobileCardField label="소득유형" value={INCOME_LABEL[item.incomeTypeSnapshot ?? ''] ?? item.incomeTypeSnapshot ?? '-'} />
                    <MobileCardField label="공수" value={`${WORK_TYPE_LABEL[item.confirmedWorkType ?? ''] ?? '-'} (${item.confirmedWorkUnits}공수)`} />
                    <MobileCardField label="출근" value={fmtTime(item.attendanceDay?.firstCheckInAt ?? null)} />
                    <MobileCardField label="퇴근" value={fmtTime(item.attendanceDay?.lastCheckOutAt ?? null)} />
                    <MobileCardField label="확정보수" value={fmt(item.confirmedTotalAmount)} />
                  </MobileCardFields>
                  {item.confirmationStatus === 'DRAFT' && (
                    <MobileCardActions>
                      <label className="flex items-center gap-1 cursor-pointer text-[12px] text-muted-brand select-none">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(item.id)}
                          onChange={() => toggleSelect(item.id)}
                          className="cursor-pointer"
                        />
                        선택
                      </label>
                      <button onClick={() => openEdit(item)} className="px-[10px] py-1 text-[12px] bg-accent text-white border-0 rounded cursor-pointer">수정/확정</button>
                    </MobileCardActions>
                  )}
                  {item.confirmationStatus !== 'DRAFT' && item.confirmationStatus !== 'CONFIRMED' && (
                    <MobileCardActions>
                      <button onClick={() => openEdit(item)} className="px-[10px] py-1 text-[12px] bg-accent text-white border-0 rounded cursor-pointer">수정/확정</button>
                    </MobileCardActions>
                  )}
                </MobileCard>
              )}}
              renderTable={() => (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="px-3 py-3 text-left border-b border-[rgba(91,164,217,0.2)]">
                          {draftItems.length > 0 && (
                            <input
                              type="checkbox"
                              checked={allDraftSelected}
                              onChange={toggleSelectAll}
                              title="DRAFT 전체 선택"
                              className="cursor-pointer"
                            />
                          )}
                        </th>
                        {['날짜', '근로자', '현장', '출근', '퇴근', '소득유형', '공수', '확정보수', '상태', ''].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-[12px] font-semibold text-muted-brand border-b border-[rgba(91,164,217,0.2)] whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.id} className={`cursor-default ${selectedIds.has(item.id) ? 'bg-[rgba(21,101,192,0.05)]' : ''}`}>
                          <td className="px-3 py-3 border-b border-[rgba(91,164,217,0.1)] align-top">
                            {item.confirmationStatus === 'DRAFT' && (
                              <input
                                type="checkbox"
                                checked={selectedIds.has(item.id)}
                                onChange={() => toggleSelect(item.id)}
                                className="cursor-pointer"
                              />
                            )}
                          </td>
                          <td className="px-4 py-3 text-[13px] text-dim-brand border-b border-[rgba(91,164,217,0.1)] align-top">{item.workDate}</td>
                          <td className="px-4 py-3 text-[13px] text-dim-brand border-b border-[rgba(91,164,217,0.1)] align-top">{item.worker.name}</td>
                          <td className="px-4 py-3 text-[13px] text-dim-brand border-b border-[rgba(91,164,217,0.1)] align-top">{item.site.name}</td>
                          <td className="px-4 py-3 text-[13px] text-dim-brand border-b border-[rgba(91,164,217,0.1)] align-top">{fmtTime(item.attendanceDay?.firstCheckInAt ?? null)}</td>
                          <td className="px-4 py-3 text-[13px] text-dim-brand border-b border-[rgba(91,164,217,0.1)] align-top">{fmtTime(item.attendanceDay?.lastCheckOutAt ?? null)}</td>
                          <td className="px-4 py-3 text-[13px] text-dim-brand border-b border-[rgba(91,164,217,0.1)] align-top">{INCOME_LABEL[item.incomeTypeSnapshot ?? ''] ?? item.incomeTypeSnapshot}</td>
                          <td className="px-4 py-3 text-[13px] text-dim-brand border-b border-[rgba(91,164,217,0.1)] align-top">
                            {WORK_TYPE_LABEL[item.confirmedWorkType ?? ''] ?? '-'}
                            <br /><span className="text-[11px] text-muted-brand">{item.confirmedWorkUnits}공수</span>
                          </td>
                          <td className="px-4 py-3 text-[13px] text-dim-brand border-b border-[rgba(91,164,217,0.1)] align-top text-right">{fmt(item.confirmedTotalAmount)}</td>
                          <td className="px-4 py-3 text-[13px] text-dim-brand border-b border-[rgba(91,164,217,0.1)] align-top">
                            <span style={{ color: STATUS_COLOR[item.confirmationStatus], fontWeight: 600, fontSize: '13px' }}>
                              {STATUS_LABEL[item.confirmationStatus] ?? item.confirmationStatus}
                            </span>
                            {(() => { const b = getDraftPriorityBadge(item); return b ? (
                              <span style={{ display: 'block', marginTop: '2px', color: b.color, fontWeight: 700, fontSize: '11px', background: `${b.color}18`, padding: '1px 5px', borderRadius: '4px', border: `1px solid ${b.color}44` }}>
                                {b.label}
                              </span>
                            ) : null })()}
                          </td>
                          <td className="px-4 py-3 text-[13px] text-dim-brand border-b border-[rgba(91,164,217,0.1)] align-top">
                            {item.confirmationStatus !== 'CONFIRMED' && (
                              <button onClick={() => openEdit(item)} className="px-[10px] py-1 text-[12px] bg-accent text-white border-0 rounded cursor-pointer">수정/확정</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            />
          )}
        </div>
    </div>

      {/* 확정 모달 */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title={editTarget ? `${editTarget.workDate} — ${editTarget.worker.name}` : ''}>
        {editTarget && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-[12px] text-muted-brand mb-1 font-semibold">근무 유형</label>
                <select value={editForm.workType} onChange={(e) => setEditForm({ ...editForm, workType: e.target.value })} className="px-[10px] py-2 border border-[rgba(91,164,217,0.2)] rounded-md text-[14px] bg-card w-full">
                  {Object.entries(WORK_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[12px] text-muted-brand mb-1 font-semibold">공수</label>
                <input type="number" step="0.5" value={editForm.workUnits} onChange={(e) => setEditForm({ ...editForm, workUnits: e.target.value })} className="px-[10px] py-2 border border-[rgba(91,164,217,0.2)] rounded-md text-[14px] bg-card w-full" />
              </div>
              <div>
                <label className="block text-[12px] text-muted-brand mb-1 font-semibold">기본 보수</label>
                <input type="number" value={editForm.baseAmount} onChange={(e) => setEditForm({ ...editForm, baseAmount: e.target.value })} className="px-[10px] py-2 border border-[rgba(91,164,217,0.2)] rounded-md text-[14px] bg-card w-full" />
              </div>
              <div>
                <label className="block text-[12px] text-muted-brand mb-1 font-semibold">수당</label>
                <input type="number" value={editForm.allowanceAmount} onChange={(e) => setEditForm({ ...editForm, allowanceAmount: e.target.value })} className="px-[10px] py-2 border border-[rgba(91,164,217,0.2)] rounded-md text-[14px] bg-card w-full" />
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-[12px] text-muted-brand mb-1 font-semibold">메모</label>
              <input value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} className="px-[10px] py-2 border border-[rgba(91,164,217,0.2)] rounded-md text-[14px] bg-card w-full" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => handleSave('exclude')} disabled={saving} className="px-4 py-2 bg-[#b71c1c] text-white border-0 rounded-md cursor-pointer text-[14px] font-semibold">무효 처리</button>
              <button onClick={() => handleSave('confirm')} disabled={saving} className="px-4 py-2 bg-[#2e7d32] text-white border-0 rounded-md cursor-pointer text-[14px] font-semibold">{saving ? '저장 중...' : '확정'}</button>
              <button onClick={() => setEditTarget(null)} className="px-4 py-2 bg-[rgba(91,164,217,0.1)] text-muted-brand border border-[rgba(91,164,217,0.2)] rounded-md cursor-pointer text-[14px]">취소</button>
            </div>
          </>
        )}
      </Modal>
    </>
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
