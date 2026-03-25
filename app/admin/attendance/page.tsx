'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PageShell, PageHeader, AdminTable, AdminTr, AdminTd, EmptyRow, FilterBar, FilterInput, FilterPill, StatusBadge, Btn } from '@/components/admin/ui'

// ── 타입 ──────────────────────────────────────────────────────────────────────
interface AttendanceRecord {
  id: string
  workerName: string
  workerPhone: string
  company: string
  jobTitle: string
  siteName: string
  workDate: string
  checkInAt: string | null
  checkOutAt: string | null
  status: string
  checkInDistance: number | null
  checkOutDistance: number | null
  exceptionReason: string | null
  adminNote: string | null
  isAutoCheckout: boolean
  workedMinutesRaw: number | null
  checkOutSiteName: string | null
}

interface DetailRecord {
  id: string
  workerName: string
  workerPhone: string
  company: string
  jobTitle: string
  workDate: string
  status: string
  checkInAt: string | null
  checkOutAt: string | null
  checkInDistance: number | null
  checkOutDistance: number | null
  checkInSite: { id: string; name: string; address: string }
  checkOutSite: { id: string; name: string } | null
  adminNote: string | null
  isAutoCheckout: boolean
  exceptionReason: string | null
  moveEvents: { id: string; siteName: string; occurredAt: string; distanceFromSite: number | null }[]
  workedMinutesRaw: number | null
  manualAdjustedYn: boolean
  manualAdjustedReason: string | null
  attendanceDayId: string | null
}

// ── 공수 계산 ─────────────────────────────────────────────────────────────────
function calcManDay(minutes: number | null): { label: string; value: string; color: string } {
  if (minutes == null) return { label: '집계 전', value: '-', color: '#9CA3AF' }
  const effective = minutes > 240 ? minutes - 60 : minutes
  if (effective >= 480) return { label: '1.0 공수', value: '1.0', color: '#2563EB' }
  if (effective >= 240) return { label: '0.5 공수', value: '0.5', color: '#D97706' }
  return { label: '0 공수', value: '0', color: '#B91C1C' }
}

// ── 상태 매핑 ─────────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  WORKING: '근무중', COMPLETED: '완료', MISSING_CHECKOUT: '미퇴근',
  EXCEPTION: '예외', ADJUSTED: '보정',
}

// 모달 상태 표시 (라이트 배경)
const STATUS_COLOR: Record<string, string> = {
  WORKING: '#16A34A', COMPLETED: '#6B7280', MISSING_CHECKOUT: '#B91C1C',
  EXCEPTION: '#D97706', ADJUSTED: '#7C3AED',
}
const STATUS_BG: Record<string, string> = {
  WORKING: '#ECFDF5', COMPLETED: '#F3F4F6', MISSING_CHECKOUT: '#FEE2E2',
  EXCEPTION: '#FFFBEB', ADJUSTED: '#F3E8FF',
}

// ── 페이지 ────────────────────────────────────────────────────────────────────
export default function AdminAttendancePage() {
  const router = useRouter()
  const today = new Date().toISOString().slice(0, 10)
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo, setDateTo] = useState(today)
  const [statusFilter, setStatusFilter] = useState('')
  const [items, setItems] = useState<AttendanceRecord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const [detail, setDetail] = useState<DetailRecord | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [correcting, setCorrecting] = useState(false)
  const [correctCheckOut, setCorrectCheckOut] = useState('')
  const [correctCheckIn, setCorrectCheckIn] = useState('')
  const [correctNote, setCorrectNote] = useState('')
  const [workedMinutesInput, setWorkedMinutesInput] = useState('')
  const [manualReason, setManualReason] = useState('')
  const [correctSaving, setCorrectSaving] = useState(false)

  const load = () => {
    setLoading(true)
    const params = new URLSearchParams({ dateFrom, dateTo, pageSize: '200' })
    if (statusFilter) params.set('status', statusFilter)
    fetch(`/api/admin/attendance?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) { router.push('/admin/login'); return }
        setItems(data.data.items)
        setTotal(data.data.total)
        setLoading(false)
      })
  }

  useEffect(load, [router])

  const openDetail = (id: string) => {
    setDetailLoading(true)
    setDetail(null)
    setCorrecting(false)
    fetch(`/api/admin/attendance/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setDetail(data.data)
        setDetailLoading(false)
      })
  }

  const closeDetail = () => {
    setDetail(null)
    setCorrecting(false)
    setCorrectCheckOut('')
    setCorrectCheckIn('')
    setCorrectNote('')
    setWorkedMinutesInput('')
    setManualReason('')
  }

  const saveCorrection = async () => {
    if (!detail) return
    if (!correctCheckOut && !correctCheckIn && workedMinutesInput === '') return
    setCorrectSaving(true)
    const body: Record<string, unknown> = {}
    if (correctCheckOut) body.checkOutAt = new Date(`${detail.workDate}T${correctCheckOut}:00+09:00`).toISOString()
    if (correctCheckIn)  body.checkInAt  = new Date(`${detail.workDate}T${correctCheckIn}:00+09:00`).toISOString()
    if (workedMinutesInput !== '') body.workedMinutesOverride = parseInt(workedMinutesInput)
    if (manualReason)  body.manualAdjustedReason = manualReason
    if (correctNote)   body.adminNote = correctNote
    if (correctCheckOut || correctCheckIn) body.status = 'ADJUSTED'
    const res = await fetch(`/api/admin/attendance/${detail.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (data.success) { closeDetail(); load() }
    setCorrectSaving(false)
  }

  const handleExport = () => {
    const params = new URLSearchParams({ dateFrom, dateTo })
    if (statusFilter) params.set('status', statusFilter)
    window.location.href = `/api/export/attendance?${params}`
  }

  const fmtTime = (iso: string | null) =>
    iso ? new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-'

  const fmtDateTime = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'

  return (
    <PageShell>

      {/* ── 헤더 ── */}
      <PageHeader
        title="출근현황"
        actions={<>
          <Btn variant="danger" onClick={() => { setStatusFilter('MISSING_CHECKOUT'); load() }}>미퇴근 우선</Btn>
          <Btn variant="success" onClick={handleExport}>엑셀 다운로드</Btn>
        </>}
      />

      {/* ── 날짜 필터 ── */}
      <div className="flex gap-3 items-end mb-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-[#6B7280]">시작일</label>
          <FilterInput type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-[#6B7280]">종료일</label>
          <FilterInput type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <Btn variant="orange" onClick={load}>조회</Btn>
      </div>

      {/* ── 상태 필터 pills ── */}
      <FilterBar>
        {[
          { value: '',                 label: '전체' },
          { value: 'MISSING_CHECKOUT', label: '미퇴근' },
          { value: 'EXCEPTION',        label: '예외' },
          { value: 'WORKING',          label: '근무중' },
          { value: 'COMPLETED',        label: '완료' },
          { value: 'ADJUSTED',         label: '보정' },
        ].map((opt) => (
          <FilterPill key={opt.value} active={statusFilter === opt.value} onClick={() => setStatusFilter(opt.value)}>
            {opt.label}
          </FilterPill>
        ))}
        <span className="ml-2 text-[12px] text-[#6B7280]">총 {total}건</span>
      </FilterBar>

      {/* ── 테이블 ── */}
      {loading ? (
        <p className="text-[#9CA3AF] text-sm py-10 text-center">로딩 중...</p>
      ) : (
        <AdminTable headers={['날짜', '이름', '회사', '직종', '현장', '출근', '퇴근', '출근거리', '퇴근거리', '공수', '상태', '자동', '예외사유', '처리']}>
          {items.length === 0 ? (
            <EmptyRow colSpan={14} />
          ) : items.map((item) => (
            <AdminTr
              key={item.id}
              onClick={() => openDetail(item.id)}
              highlighted={item.status === 'MISSING_CHECKOUT'}
              className={item.status === 'EXCEPTION' ? 'bg-[#FFFBEB] hover:bg-[#FEF3C7]' : ''}
            >
              <AdminTd className="text-[#6B7280]">{item.workDate}</AdminTd>
              <AdminTd className="font-medium text-[#111827]">{item.workerName}</AdminTd>
              <AdminTd className="text-[#6B7280]">{item.company}</AdminTd>
              <AdminTd className="text-[#6B7280]">{item.jobTitle}</AdminTd>
              <AdminTd className="text-[#6B7280]">{item.siteName}</AdminTd>
              <AdminTd className="tabular-nums">{fmtTime(item.checkInAt)}</AdminTd>
              <AdminTd className="tabular-nums">{fmtTime(item.checkOutAt)}</AdminTd>
              <AdminTd className="text-right">
                {item.checkInDistance != null
                  ? <span className="text-xs font-semibold" style={{ color: item.checkInDistance > 200 ? '#DC2626' : '#16A34A' }}>{item.checkInDistance}m</span>
                  : <span className="text-[11px] text-[#D1D5DB]">-</span>}
              </AdminTd>
              <AdminTd className="text-right">
                {item.checkOutDistance != null
                  ? <span className="text-xs font-semibold" style={{ color: item.checkOutDistance > 200 ? '#DC2626' : '#6B7280' }}>{item.checkOutDistance}m</span>
                  : <span className="text-[11px] text-[#D1D5DB]">-</span>}
              </AdminTd>
              <AdminTd className="text-right">
                {(() => {
                  const md = calcManDay(item.workedMinutesRaw ?? null)
                  return item.workedMinutesRaw != null
                    ? <span className="text-xs font-semibold" style={{ color: md.color }}>{md.value}</span>
                    : <span className="text-[11px] text-[#D1D5DB]">-</span>
                })()}
              </AdminTd>
              <AdminTd>
                <StatusBadge status={item.status} label={STATUS_LABEL[item.status]} />
              </AdminTd>
              <AdminTd>
                {item.isAutoCheckout && (
                  <span className="text-[10px] bg-[#FEE2E2] text-[#B91C1C] px-1.5 py-[2px] rounded font-semibold">AUTO</span>
                )}
              </AdminTd>
              <AdminTd>
                {item.exceptionReason && (
                  <span className="text-[11px] bg-[#FFF7ED] text-[#C2410C] px-2 py-[2px] rounded-[8px] font-semibold">{item.exceptionReason}</span>
                )}
              </AdminTd>
              <AdminTd>
                {(item.status === 'MISSING_CHECKOUT' || item.status === 'EXCEPTION') && (
                  <button
                    onClick={(e) => { e.stopPropagation(); openDetail(item.id) }}
                    className="px-3 py-1 text-[11px] font-semibold text-white bg-[#B91C1C] hover:bg-[#991B1B] border-none rounded-[5px] cursor-pointer transition-colors"
                  >
                    처리
                  </button>
                )}
              </AdminTd>
            </AdminTr>
          ))}
        </AdminTable>
      )}

      {/* ── 상세 모달 ── */}
      {(detail || detailLoading) && (
        <div
          className="fixed inset-0 bg-black/40 z-[1000] flex items-center justify-center"
          onClick={closeDetail}
        >
          <div
            className="bg-white rounded-2xl p-8 w-[540px] max-w-[95vw] max-h-[85vh] overflow-y-auto shadow-[0_20px_60px_rgba(0,0,0,0.12)]"
            onClick={(e) => e.stopPropagation()}
          >
            {detailLoading ? (
              <p className="text-center py-10 text-[#9CA3AF]">로딩 중...</p>
            ) : detail && (
              <>
                {/* 모달 헤더 */}
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="text-[18px] font-bold text-[#111827]">{detail.workerName} 상세</div>
                    <div className="text-[13px] text-[#6B7280] mt-[2px]">
                      {detail.workDate} · {detail.company} · {detail.jobTitle}
                    </div>
                  </div>
                  <button onClick={closeDetail} className="bg-transparent border-none text-[20px] cursor-pointer text-[#9CA3AF] hover:text-[#374151] px-1">✕</button>
                </div>

                {/* 상태 */}
                <div className="mb-5 flex gap-2 items-center">
                  <span style={{ color: STATUS_COLOR[detail.status], background: STATUS_BG[detail.status], fontWeight: 700, fontSize: '13px', padding: '4px 12px', borderRadius: '12px' }}>
                    {STATUS_LABEL[detail.status] ?? detail.status}
                  </span>
                  {detail.isAutoCheckout && (
                    <span className="text-[11px] bg-[#FEE2E2] text-[#B91C1C] px-2 py-[3px] rounded font-semibold">AUTO 자동처리</span>
                  )}
                </div>

                {/* 현장 이력 */}
                <div className="admin-modal-section">
                  <div className="admin-modal-section-label">현장 이력</div>
                  <div className="flex gap-3 items-center mb-[6px]">
                    <span className="text-xs text-[#6B7280] w-[70px] shrink-0">출근 현장</span>
                    <span className="text-[13px] text-[#374151] font-medium">{detail.checkInSite.name}</span>
                  </div>
                  {detail.moveEvents.map((mv, i) => (
                    <div key={mv.id} className="flex gap-3 items-center mb-[6px]">
                      <span className="text-xs text-[#6B7280] w-[70px] shrink-0">이동 {i + 1}</span>
                      <span className="text-[13px] text-[#374151] font-medium">→ {mv.siteName} ({fmtDateTime(mv.occurredAt)})</span>
                    </div>
                  ))}
                  <div className="flex gap-3 items-center mb-[6px]">
                    <span className="text-xs text-[#6B7280] w-[70px] shrink-0">퇴근 현장</span>
                    <span className="text-[13px] text-[#374151] font-medium">{detail.checkOutSite?.name ?? detail.checkInSite.name}</span>
                  </div>
                </div>

                {/* 출퇴근 시각 */}
                <div className="admin-modal-section">
                  <div className="admin-modal-section-label">출퇴근 시각</div>
                  <div className="flex gap-3 items-center mb-[6px]">
                    <span className="text-xs text-[#6B7280] w-[70px] shrink-0">출근</span>
                    <span className="text-[13px] text-[#374151] font-medium">
                      {fmtDateTime(detail.checkInAt)} {detail.checkInDistance != null ? `(${detail.checkInDistance}m)` : ''}
                    </span>
                  </div>
                  <div className="flex gap-3 items-center mb-[6px]">
                    <span className="text-xs text-[#6B7280] w-[70px] shrink-0">퇴근</span>
                    <span className="text-[13px] text-[#374151] font-medium">
                      {detail.checkOutAt
                        ? `${fmtDateTime(detail.checkOutAt)} ${detail.checkOutDistance != null ? `(${detail.checkOutDistance}m)` : ''}`
                        : '미기록'}
                    </span>
                  </div>
                </div>

                {/* 공수 */}
                <div className="admin-modal-section">
                  <div className="admin-modal-section-label">공수</div>
                  <div className="flex gap-3 items-center mb-[6px]">
                    <span className="text-xs text-[#6B7280] w-[70px] shrink-0">실근로(분)</span>
                    <span className="text-[13px] text-[#374151] font-medium">
                      {detail.workedMinutesRaw != null ? `${detail.workedMinutesRaw}분` : '집계 전'}
                    </span>
                  </div>
                  <div className="flex gap-3 items-center mb-[6px]">
                    <span className="text-xs text-[#6B7280] w-[70px] shrink-0">공수 판정</span>
                    <span className="text-[13px] font-bold" style={{ color: calcManDay(detail.workedMinutesRaw).color }}>
                      {calcManDay(detail.workedMinutesRaw).label}
                    </span>
                  </div>
                  {detail.manualAdjustedYn && (
                    <div className="flex gap-3 items-center mb-[6px]">
                      <span className="text-xs text-[#6B7280] w-[70px] shrink-0">수동 조정</span>
                      <span className="text-xs text-[#7C3AED] font-semibold">
                        수동 보정됨 {detail.manualAdjustedReason ? `· ${detail.manualAdjustedReason}` : ''}
                      </span>
                    </div>
                  )}
                </div>

                {/* 관리자 메모 */}
                {detail.adminNote && (
                  <div className="rounded-[10px] p-4 mb-3 bg-[#FFF7ED] border border-[#FDE68A]">
                    <div className="admin-modal-section-label">처리 메모</div>
                    <div className="text-[13px] text-[#374151] leading-relaxed">{detail.adminNote}</div>
                  </div>
                )}

                {/* 보정 버튼 */}
                {!correcting && (
                  <button
                    onClick={() => setCorrecting(true)}
                    className="w-full py-[12px] bg-[#7C3AED] hover:bg-[#6D28D9] text-white border-none rounded-[10px] cursor-pointer text-sm font-semibold mb-2 transition-colors"
                  >
                    {detail.status === 'MISSING_CHECKOUT' ? '✏️ 수동 보정 (퇴근 시각 입력)' : '✏️ 출퇴근 시각 / 공수 수정'}
                  </button>
                )}

                {/* 보정 폼 */}
                {correcting && (
                  <div className="rounded-[10px] p-4 mb-3 bg-[#F5F3FF] border border-[#DDD6FE]">
                    <div className="admin-modal-section-label">수동 보정</div>
                    <div className="flex gap-3 items-center mb-[8px]">
                      <span className="text-xs text-[#6B7280] w-[70px] shrink-0">출근 시각</span>
                      <input type="time" value={correctCheckIn} onChange={(e) => setCorrectCheckIn(e.target.value)}
                        className="admin-input w-[140px]" placeholder="변경 시 입력" />
                      <span className="text-[11px] text-[#9CA3AF]">현재: {fmtTime(detail.checkInAt)}</span>
                    </div>
                    <div className="flex gap-3 items-center mb-[8px]">
                      <span className="text-xs text-[#6B7280] w-[70px] shrink-0">퇴근 시각</span>
                      <input type="time" value={correctCheckOut} onChange={(e) => setCorrectCheckOut(e.target.value)}
                        className="admin-input w-[140px]" placeholder="변경 시 입력" />
                      <span className="text-[11px] text-[#9CA3AF]">현재: {fmtTime(detail.checkOutAt)}</span>
                    </div>
                    <div className="flex gap-3 items-center mb-[8px]">
                      <span className="text-xs text-[#6B7280] w-[70px] shrink-0">공수(분)</span>
                      <input type="number" min="0" max="1440" value={workedMinutesInput}
                        onChange={(e) => setWorkedMinutesInput(e.target.value)}
                        className="admin-input w-[100px]" placeholder="분 단위" />
                      <span className="text-[11px] text-[#9CA3AF]">
                        {workedMinutesInput ? `→ ${calcManDay(parseInt(workedMinutesInput)).label}` : '비워두면 자동 계산'}
                      </span>
                    </div>
                    <div className="flex gap-3 items-center mb-[8px]">
                      <span className="text-xs text-[#6B7280] w-[70px] shrink-0">사유</span>
                      <input type="text" placeholder="수정 사유 (선택)" value={manualReason}
                        onChange={(e) => setManualReason(e.target.value)}
                        className="admin-input flex-1" />
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={saveCorrection}
                        disabled={(!correctCheckOut && !correctCheckIn && workedMinutesInput === '') || correctSaving}
                        className="px-5 py-2 bg-[#F97316] hover:bg-[#EA580C] text-white border-none rounded-[8px] cursor-pointer text-sm font-semibold disabled:opacity-50 transition-colors"
                      >
                        {correctSaving ? '저장 중...' : '보정 저장'}
                      </button>
                      <button
                        onClick={() => setCorrecting(false)}
                        className="px-5 py-2 bg-white text-[#6B7280] border border-[#E5E7EB] rounded-[8px] cursor-pointer text-sm hover:bg-[#F9FAFB] transition-colors"
                      >
                        취소
                      </button>
                    </div>
                    <div className="text-[11px] text-[#9CA3AF] mt-2">
                      * 보정 이력은 감사 로그에 기록됩니다. 상태: ADJUSTED
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </PageShell>
  )
}
