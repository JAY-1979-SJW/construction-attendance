'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

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

function calcManDay(minutes: number | null): { label: string; value: string; color: string } {
  if (minutes == null) return { label: '집계 전', value: '-', color: '#999' }
  const effective = minutes > 240 ? minutes - 60 : minutes
  if (effective >= 480) return { label: '1.0 공수', value: '1.0', color: '#4A93C8' }
  if (effective >= 240) return { label: '0.5 공수', value: '0.5', color: '#e65100' }
  return { label: '0 공수', value: '0', color: '#b71c1c' }
}

const STATUS_LABEL: Record<string, string> = {
  WORKING: '근무중',
  COMPLETED: '완료',
  MISSING_CHECKOUT: '미퇴근',
  EXCEPTION: '예외',
  ADJUSTED: '보정',
}
const STATUS_BADGE: Record<string, string> = {
  WORKING:          'bg-[#ECFDF5] text-[#16A34A] border border-[#A7F3D0]',
  COMPLETED:        'bg-[#F3F4F6] text-[#6B7280] border border-[#D1D5DB]',
  MISSING_CHECKOUT: 'bg-[#FEE2E2] text-[#B91C1C] border border-[#F87171]',
  EXCEPTION:        'bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]',
  ADJUSTED:         'bg-[#F3E8FF] text-[#7C3AED] border border-[#DDD6FE]',
}
// 모달에서는 기존 컬러 유지
const STATUS_COLOR: Record<string, string> = {
  WORKING: '#16A34A', COMPLETED: '#6B7280', MISSING_CHECKOUT: '#B91C1C',
  EXCEPTION: '#D97706', ADJUSTED: '#7C3AED',
}
const STATUS_BG: Record<string, string> = {
  WORKING: '#ECFDF5', COMPLETED: '#F3F4F6', MISSING_CHECKOUT: '#FEE2E2',
  EXCEPTION: '#FFFBEB', ADJUSTED: '#F3E8FF',
}

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
    if (correctCheckIn) body.checkInAt = new Date(`${detail.workDate}T${correctCheckIn}:00+09:00`).toISOString()
    if (workedMinutesInput !== '') body.workedMinutesOverride = parseInt(workedMinutesInput)
    if (manualReason) body.manualAdjustedReason = manualReason
    if (correctNote) body.adminNote = correctNote
    if (correctCheckOut || correctCheckIn) body.status = 'ADJUSTED'
    const res = await fetch(`/api/admin/attendance/${detail.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (data.success) {
      closeDetail()
      load()
    }
    setCorrectSaving(false)
  }

  const handleExport = () => {
    const params = new URLSearchParams({ dateFrom, dateTo })
    if (statusFilter) params.set('status', statusFilter)
    window.location.href = `/api/export/attendance?${params}`
  }

  const formatTime = (iso: string | null) =>
    iso ? new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-'

  const formatDateTime = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'

  // shared input style for filter inputs
  const filterInputCls = "px-3 py-2 border border-[rgba(91,164,217,0.3)] rounded-md text-sm bg-[#243144] text-white"

  return (
    <div className="p-8">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h1 className="text-[22px] font-bold m-0">출근현황</h1>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => { setStatusFilter('MISSING_CHECKOUT'); load() }}
              className="px-4 py-2 text-[13px] font-semibold text-white bg-[#B91C1C] hover:bg-[#991B1B] border-none rounded-md cursor-pointer transition-colors">
              미퇴근 우선
            </button>
            <button onClick={handleExport} className="px-4 py-2 text-[13px] font-semibold text-white bg-[#2e7d32] hover:bg-[#1b5e20] border-none rounded-md cursor-pointer transition-colors">
              엑셀 다운로드
            </button>
          </div>
        </div>

        {/* 필터 — 날짜 + 상태 pills */}
        <div className="flex gap-3 items-end mb-3 flex-wrap">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-brand">시작일</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={filterInputCls} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-brand">종료일</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={filterInputCls} />
          </div>
          <button onClick={load} className="px-5 py-2 bg-accent text-white border-none rounded-md cursor-pointer text-sm">조회</button>
        </div>

        {/* 상태 필터 pills */}
        <div className="flex gap-2 mb-4 flex-wrap items-center">
          {[
            { value: '',                  label: '전체' },
            { value: 'MISSING_CHECKOUT',  label: '미퇴근' },
            { value: 'EXCEPTION',         label: '예외' },
            { value: 'WORKING',           label: '근무중' },
            { value: 'COMPLETED',         label: '완료' },
            { value: 'ADJUSTED',          label: '보정' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-3 py-1.5 rounded-md text-[12px] font-semibold border cursor-pointer transition-colors ${
                statusFilter === opt.value
                  ? 'bg-[#F97316] border-[#F97316] text-white'
                  : 'bg-transparent border-[rgba(91,164,217,0.3)] text-[#9CA3AF] hover:border-[rgba(91,164,217,0.55)] hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
          <span className="ml-2 text-[12px] text-muted-brand">총 {total}건</span>
        </div>

        {loading ? <p>로딩 중...</p> : (
          <div className="bg-card rounded-[10px] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.35)] overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[rgba(91,164,217,0.07)]">
                  {['날짜', '이름', '회사', '직종', '현장', '출근', '퇴근', '출근거리', '퇴근거리', '공수', '상태', '자동처리', '예외사유', '처리'].map((h) => (
                    <th key={h} className="text-left px-3 py-[10px] text-[11px] font-bold text-[#94A3B8] border-b border-[rgba(91,164,217,0.25)] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={13} className="text-center py-6 text-[#999]">데이터가 없습니다.</td></tr>
                ) : items.map((item) => (
                  <tr
                    key={item.id}
                    className="cursor-pointer hover:bg-[rgba(91,164,217,0.05)] transition-colors"
                    style={{ background: item.status === 'MISSING_CHECKOUT' ? '#fff5f5' : item.status === 'EXCEPTION' ? '#fffbf0' : 'white' }}
                    onClick={() => openDetail(item.id)}
                  >
                    <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.08)] whitespace-nowrap">{item.workDate}</td>
                    <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.08)] whitespace-nowrap">{item.workerName}</td>
                    <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.08)] whitespace-nowrap">{item.company}</td>
                    <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.08)] whitespace-nowrap">{item.jobTitle}</td>
                    <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.08)] whitespace-nowrap">{item.siteName}</td>
                    <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.08)] whitespace-nowrap">{formatTime(item.checkInAt)}</td>
                    <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.08)] whitespace-nowrap">{formatTime(item.checkOutAt)}</td>
                    <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.08)] whitespace-nowrap text-right">
                      {item.checkInDistance != null
                        ? <span className="text-xs font-semibold" style={{ color: item.checkInDistance > 200 ? '#e65100' : '#2e7d32' }}>{item.checkInDistance}m</span>
                        : <span className="text-[11px] text-[#ccc]">-</span>}
                    </td>
                    <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.08)] whitespace-nowrap text-right">
                      {item.checkOutDistance != null
                        ? <span className="text-xs font-semibold" style={{ color: item.checkOutDistance > 200 ? '#e65100' : '#555' }}>{item.checkOutDistance}m</span>
                        : <span className="text-[11px] text-[#ccc]">-</span>}
                    </td>
                    <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.08)] whitespace-nowrap text-right">
                      {(() => {
                        const md = calcManDay(item.workedMinutesRaw ?? null)
                        return item.workedMinutesRaw != null
                          ? <span className="text-xs font-semibold" style={{ color: md.color }}>{md.value}</span>
                          : <span className="text-[11px] text-[#ccc]">-</span>
                      })()}
                    </td>
                    <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.08)] whitespace-nowrap">
                      <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[item.status] ?? 'bg-[#F3F4F6] text-[#6B7280] border border-[#D1D5DB]'}`}>
                        {STATUS_LABEL[item.status] ?? item.status}
                      </span>
                    </td>
                    <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.08)] whitespace-nowrap">
                      {item.isAutoCheckout && (
                        <span className="text-[11px] bg-[#ffebee] text-[#b71c1c] px-[6px] py-[2px] rounded">AUTO</span>
                      )}
                    </td>
                    <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.08)] whitespace-nowrap">
                      {item.exceptionReason
                        ? <span className="text-[11px] bg-[#fff3e0] text-[#e65100] px-2 py-[2px] rounded-[10px] font-semibold whitespace-nowrap">{item.exceptionReason}</span>
                        : null}
                    </td>
                    <td className="px-3 py-[10px] border-b border-[rgba(91,164,217,0.08)] whitespace-nowrap">
                      {(item.status === 'MISSING_CHECKOUT' || item.status === 'EXCEPTION') && (
                        <button
                          onClick={(e) => { e.stopPropagation(); openDetail(item.id) }}
                          className="px-3 py-1 text-[11px] font-semibold text-white bg-[#B91C1C] hover:bg-[#991B1B] border-none rounded-[5px] cursor-pointer transition-colors"
                        >
                          처리
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {/* 상세 모달 */}
      {(detail || detailLoading) && (
        <div
          className="fixed inset-0 bg-black/40 z-[1000] flex items-center justify-center"
          onClick={closeDetail}
        >
          <div
            className="bg-card rounded-2xl p-8 w-[540px] max-w-[95vw] max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {detailLoading ? (
              <p className="text-center py-10 text-muted-brand">로딩 중...</p>
            ) : detail && (
              <>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="text-[18px] font-bold">{detail.workerName} 상세</div>
                    <div className="text-[13px] text-muted-brand mt-[2px]">{detail.workDate} · {detail.company} · {detail.jobTitle}</div>
                  </div>
                  <button onClick={closeDetail} className="bg-none border-none text-[20px] cursor-pointer text-[#718096] px-1">✕</button>
                </div>

                {/* 상태 배지 */}
                <div className="mb-5 flex gap-2 items-center">
                  <span style={{
                    color: STATUS_COLOR[detail.status],
                    background: STATUS_BG[detail.status],
                    fontWeight: 700,
                    fontSize: '13px',
                    padding: '4px 12px',
                    borderRadius: '12px',
                  }}>
                    {STATUS_LABEL[detail.status] ?? detail.status}
                  </span>
                  {detail.isAutoCheckout && (
                    <span className="text-[11px] bg-[#ffebee] text-[#b71c1c] px-2 py-[3px] rounded font-semibold">
                      AUTO 자동처리
                    </span>
                  )}
                </div>

                {/* 현장 정보 */}
                <div className="bg-brand rounded-[10px] p-4 mb-3">
                  <div className="text-[11px] text-[#718096] font-semibold uppercase tracking-[0.5px] mb-[10px]">현장 이력</div>
                  <div className="flex gap-3 items-center mb-[6px]">
                    <span className="text-xs text-muted-brand w-[70px] shrink-0">출근 현장</span>
                    <span className="text-[13px] text-[#CBD5E0] font-medium">{detail.checkInSite.name}</span>
                  </div>
                  {detail.moveEvents.map((mv, i) => (
                    <div key={mv.id} className="flex gap-3 items-center mb-[6px]">
                      <span className="text-xs text-muted-brand w-[70px] shrink-0">이동 {i + 1}</span>
                      <span className="text-[13px] text-[#CBD5E0] font-medium">→ {mv.siteName} ({formatDateTime(mv.occurredAt)})</span>
                    </div>
                  ))}
                  <div className="flex gap-3 items-center mb-[6px]">
                    <span className="text-xs text-muted-brand w-[70px] shrink-0">퇴근 현장</span>
                    <span className="text-[13px] text-[#CBD5E0] font-medium">{detail.checkOutSite?.name ?? detail.checkInSite.name}</span>
                  </div>
                </div>

                {/* 시간 정보 */}
                <div className="bg-brand rounded-[10px] p-4 mb-3">
                  <div className="text-[11px] text-[#718096] font-semibold uppercase tracking-[0.5px] mb-[10px]">출퇴근 시각</div>
                  <div className="flex gap-3 items-center mb-[6px]">
                    <span className="text-xs text-muted-brand w-[70px] shrink-0">출근</span>
                    <span className="text-[13px] text-[#CBD5E0] font-medium">{formatDateTime(detail.checkInAt)} {detail.checkInDistance != null ? `(${detail.checkInDistance}m)` : ''}</span>
                  </div>
                  <div className="flex gap-3 items-center mb-[6px]">
                    <span className="text-xs text-muted-brand w-[70px] shrink-0">퇴근</span>
                    <span className="text-[13px] text-[#CBD5E0] font-medium">
                      {detail.checkOutAt ? `${formatDateTime(detail.checkOutAt)} ${detail.checkOutDistance != null ? `(${detail.checkOutDistance}m)` : ''}` : '미기록'}
                    </span>
                  </div>
                </div>

                {/* 공수 */}
                <div className="bg-brand rounded-[10px] p-4 mb-3">
                  <div className="text-[11px] text-[#718096] font-semibold uppercase tracking-[0.5px] mb-[10px]">공수</div>
                  <div className="flex gap-3 items-center mb-[6px]">
                    <span className="text-xs text-muted-brand w-[70px] shrink-0">실근로(분)</span>
                    <span className="text-[13px] text-[#CBD5E0] font-medium">{detail.workedMinutesRaw != null ? `${detail.workedMinutesRaw}분` : '집계 전'}</span>
                  </div>
                  <div className="flex gap-3 items-center mb-[6px]">
                    <span className="text-xs text-muted-brand w-[70px] shrink-0">공수 판정</span>
                    <span className="text-[13px] font-bold" style={{ color: calcManDay(detail.workedMinutesRaw).color }}>
                      {calcManDay(detail.workedMinutesRaw).label}
                    </span>
                  </div>
                  {detail.manualAdjustedYn && (
                    <div className="flex gap-3 items-center mb-[6px]">
                      <span className="text-xs text-muted-brand w-[70px] shrink-0">수동 조정</span>
                      <span className="text-xs text-[#6a1b9a] font-semibold">
                        수동 보정됨 {detail.manualAdjustedReason ? `· ${detail.manualAdjustedReason}` : ''}
                      </span>
                    </div>
                  )}
                </div>

                {/* 관리자 메모 */}
                {detail.adminNote && (
                  <div className="rounded-[10px] p-4 mb-3 bg-[#fff8f8]">
                    <div className="text-[11px] text-[#718096] font-semibold uppercase tracking-[0.5px] mb-[10px]">처리 메모</div>
                    <div className="text-[13px] text-muted-brand leading-relaxed">{detail.adminNote}</div>
                  </div>
                )}

                {/* 수동 보정 버튼 */}
                {!correcting && (
                  <button
                    onClick={() => setCorrecting(true)}
                    className="w-full py-[14px] bg-[#6a1b9a] text-white border-none rounded-[10px] cursor-pointer text-sm font-semibold mb-2"
                  >
                    {detail.status === 'MISSING_CHECKOUT' ? '✏️ 수동 보정 (퇴근 시각 입력)' : '✏️ 출퇴근 시각 / 공수 수정'}
                  </button>
                )}

                {correcting && (
                  <div className="rounded-[10px] p-4 mb-3 bg-[#f3e5f5]">
                    <div className="text-[11px] text-[#718096] font-semibold uppercase tracking-[0.5px] mb-[10px]">수동 보정</div>
                    <div className="flex gap-3 items-center mb-[6px]">
                      <span className="text-xs text-muted-brand w-[70px] shrink-0">출근 시각</span>
                      <input type="time" value={correctCheckIn} onChange={(e) => setCorrectCheckIn(e.target.value)}
                        className="px-3 py-2 border border-[rgba(91,164,217,0.3)] rounded-md text-sm w-[140px]" placeholder="변경 시 입력" />
                      <span className="text-[11px] text-[#999]">현재: {formatTime(detail.checkInAt)}</span>
                    </div>
                    <div className="flex gap-3 items-center mb-[6px]">
                      <span className="text-xs text-muted-brand w-[70px] shrink-0">퇴근 시각</span>
                      <input type="time" value={correctCheckOut} onChange={(e) => setCorrectCheckOut(e.target.value)}
                        className="px-3 py-2 border border-[rgba(91,164,217,0.3)] rounded-md text-sm w-[140px]" placeholder="변경 시 입력" />
                      <span className="text-[11px] text-[#999]">현재: {formatTime(detail.checkOutAt)}</span>
                    </div>
                    <div className="flex gap-3 items-center mb-[6px]">
                      <span className="text-xs text-muted-brand w-[70px] shrink-0">공수(분)</span>
                      <input type="number" min="0" max="1440" value={workedMinutesInput}
                        onChange={(e) => setWorkedMinutesInput(e.target.value)}
                        className="px-3 py-2 border border-[rgba(91,164,217,0.3)] rounded-md text-sm w-[100px]" placeholder="분 단위" />
                      <span className="text-[11px] text-[#999]">
                        {workedMinutesInput ? `→ ${calcManDay(parseInt(workedMinutesInput)).label}` : '비워두면 자동 계산'}
                      </span>
                    </div>
                    <div className="flex gap-3 items-center mb-2 mt-2">
                      <span className="text-xs text-muted-brand w-[70px] shrink-0">사유</span>
                      <input type="text" placeholder="수정 사유 (선택)" value={manualReason}
                        onChange={(e) => setManualReason(e.target.value)}
                        className="px-3 py-2 border border-[rgba(91,164,217,0.3)] rounded-md text-sm flex-1" />
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={saveCorrection}
                        disabled={(!correctCheckOut && !correctCheckIn && workedMinutesInput === '') || correctSaving}
                        className="px-5 py-2 bg-accent text-white border-none rounded-md cursor-pointer text-sm disabled:opacity-50"
                        style={{ opacity: (!correctCheckOut && !correctCheckIn && workedMinutesInput === '') || correctSaving ? 0.5 : 1 }}
                      >
                        {correctSaving ? '저장 중...' : '보정 저장'}
                      </button>
                      <button onClick={() => setCorrecting(false)} className="px-5 py-2 bg-[#2e7d32] text-white border-none rounded-md cursor-pointer text-sm">취소</button>
                    </div>
                    <div className="text-[11px] text-muted-brand mt-2">
                      * 보정 이력은 감사 로그에 기록됩니다. 상태: ADJUSTED
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

