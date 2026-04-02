'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import WorkerTopBar from '@/components/worker/WorkerTopBar'
import WorkerBottomNav from '@/components/worker/WorkerBottomNav'

// ─── 타입 ────────────────────────────────────────────────

interface CalendarDay {
  date: string
  siteName: string
  checkInAt: string | null
  checkOutAt: string | null
  status: string
  hasReport: boolean
  reportStatus: string | null
  manDays: number | null
}

interface CalendarSummary {
  totalDays: number
  workedDays: number
  totalManDays: number
  reportedDays: number
}

interface PayslipDay {
  workDate: string
  siteName: string
  workType: string | null
  workMinutes: number
  baseAmount: number
  allowanceAmount: number
  totalAmount: number
  status: string
}

interface PayslipSummary {
  totalDays: number
  confirmedDays: number
  totalUnits: number
  totalAmount: number
}

// ─── 유틸 ────────────────────────────────────────────────

function getMonthKey() {
  return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 7)
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const fmt = (n: number) => n.toLocaleString('ko-KR')
const fmtWon = (n: number) => n > 0 ? fmt(n) + '원' : '-'

const WORK_TYPE_LABEL: Record<string, string> = { FULL_DAY: '1.0', HALF_DAY: '0.5', INVALID: '-' }
const WORK_TYPE_COLOR: Record<string, string> = { FULL_DAY: '#1565c0', HALF_DAY: '#e65100', INVALID: '#9e9e9e' }

function fmtTime(iso: string | null): string {
  if (!iso) return '--:--'
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul' })
}

function fmtMinutes(m: number): string {
  if (!m) return '-'
  const h = Math.floor(m / 60)
  const min = m % 60
  return h > 0 ? (min > 0 ? `${h}시간 ${min}분` : `${h}시간`) : `${min}분`
}

// ─── 캘린더 그리드 생성 ──────────────────────────────────

function buildCalendarGrid(monthKey: string): (number | null)[][] {
  const [y, m] = monthKey.split('-').map(Number)
  const firstDay = new Date(y, m - 1, 1).getDay()
  const lastDate = new Date(y, m, 0).getDate()

  const grid: (number | null)[][] = []
  let week: (number | null)[] = new Array(firstDay).fill(null)

  for (let d = 1; d <= lastDate; d++) {
    week.push(d)
    if (week.length === 7) {
      grid.push(week)
      week = []
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null)
    grid.push(week)
  }
  return grid
}

// ─── 메인 ────────────────────────────────────────────────

type ViewTab = 'calendar' | 'list'

export default function WageMyPayslipPage() {
  const router = useRouter()
  const [monthKey, setMonthKey] = useState(getMonthKey())
  const [tab, setTab] = useState<ViewTab>('calendar')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  // 캘린더 데이터
  const [calDays, setCalDays] = useState<CalendarDay[]>([])
  const [calSummary, setCalSummary] = useState<CalendarSummary | null>(null)

  // 리스트 데이터
  const [days, setDays] = useState<PayslipDay[]>([])
  const [summary, setSummary] = useState<PayslipSummary | null>(null)
  const [workerName, setWorkerName] = useState('')
  const [jobTitle, setJobTitle] = useState('')

  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [calRes, payRes] = await Promise.all([
        fetch(`/api/attendance/monthly?month=${monthKey}`).then(r => r.json()),
        fetch(`/api/wage/my-payslip?monthKey=${monthKey}`).then(r => r.json()),
      ])
      if (calRes.success) {
        setCalDays(calRes.data.days ?? [])
        setCalSummary(calRes.data.summary ?? null)
      }
      if (payRes.success) {
        setDays(payRes.data.days ?? [])
        setSummary(payRes.data.summary ?? null)
        setWorkerName(payRes.data.workerName ?? '')
        setJobTitle(payRes.data.jobTitle ?? '')
      }
      if (!calRes.success && !payRes.success && (calRes.status === 401 || payRes.status === 401)) {
        router.push('/login')
      }
    } finally { setLoading(false) }
  }, [monthKey, router])

  useEffect(() => { load() }, [load])
  useEffect(() => { setSelectedDate(null) }, [monthKey])

  const prevMonth = () => {
    const [y, m] = monthKey.split('-').map(Number)
    setMonthKey(new Date(y, m - 2, 1).toISOString().slice(0, 7))
  }
  const nextMonth = () => {
    const [y, m] = monthKey.split('-').map(Number)
    setMonthKey(new Date(y, m, 1).toISOString().slice(0, 7))
  }

  // 캘린더용 날짜 맵
  const calMap = new Map(calDays.map(d => [d.date, d]))
  const grid = buildCalendarGrid(monthKey)
  const [yearNum, monNum] = monthKey.split('-').map(Number)

  const selectedDayData = selectedDate ? calMap.get(selectedDate) : null

  return (
    <div className="min-h-screen bg-brand pt-[60px] pb-24 px-4">
      <WorkerTopBar />
      <div className="max-w-[600px] mx-auto">

        {/* 헤더 */}
        <div className="mb-4 pt-2">
          <h1 className="text-xl font-bold text-fore-brand m-0">근무 캘린더</h1>
          <p className="text-[12px] text-muted-brand mt-0.5 m-0">
            {workerName && <span className="font-semibold text-accent">{workerName}</span>}
            {jobTitle && <span className="text-muted-brand"> · {jobTitle}</span>}
          </p>
        </div>

        {/* 월 선택 */}
        <div className="bg-card rounded-2xl px-4 py-3 mb-4 border border-brand flex items-center gap-3 justify-between">
          <button onClick={prevMonth} className="w-9 h-9 flex items-center justify-center rounded-full bg-accent-light text-accent border-none cursor-pointer text-lg">‹</button>
          <input type="month" value={monthKey} onChange={e => setMonthKey(e.target.value)} className="text-center text-fore-brand font-bold text-base bg-transparent border-none outline-none" />
          <button onClick={nextMonth} className="w-9 h-9 flex items-center justify-center rounded-full bg-accent-light text-accent border-none cursor-pointer text-lg">›</button>
        </div>

        {/* 탭 */}
        <div className="flex bg-card rounded-xl border border-brand mb-4 overflow-hidden">
          {[
            { key: 'calendar' as ViewTab, label: '캘린더' },
            { key: 'list' as ViewTab, label: '급여 명세' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2.5 text-[13px] font-semibold border-none cursor-pointer transition-colors ${
                tab === t.key ? 'bg-brand-accent text-white' : 'bg-card text-muted-brand hover:bg-surface'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading && <div className="py-8 text-center text-muted-brand">로딩 중...</div>}

        {/* ── 캘린더 탭 ──────────────────────────────── */}
        {!loading && tab === 'calendar' && (
          <>
            {/* 월 요약 카드 */}
            {calSummary && (
              <div className="grid grid-cols-4 gap-2 mb-4">
                {[
                  { label: '출근', value: `${calSummary.workedDays}일`, color: '#2563EB' },
                  { label: '공수', value: `${calSummary.totalManDays.toFixed(1)}`, color: '#e65100' },
                  { label: '일보', value: `${calSummary.reportedDays}건`, color: '#16a34a' },
                  { label: '총일수', value: `${calSummary.totalDays}일`, color: '#6B7280' },
                ].map(c => (
                  <div key={c.label} className="bg-card rounded-lg px-2 py-3 border border-brand text-center" style={{ borderTop: `2px solid ${c.color}` }}>
                    <div className="text-[15px] font-bold text-fore-brand">{c.value}</div>
                    <div className="text-[10px] text-muted-brand">{c.label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* 캘린더 그리드 */}
            <div className="bg-card rounded-2xl border border-brand overflow-hidden mb-4">
              {/* 요일 헤더 */}
              <div className="grid grid-cols-7 border-b border-brand">
                {WEEKDAYS.map((w, i) => (
                  <div key={w} className={`text-center py-2 text-[11px] font-bold ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-muted-brand'}`}>
                    {w}
                  </div>
                ))}
              </div>

              {/* 날짜 그리드 */}
              {grid.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 border-b border-brand last:border-b-0">
                  {week.map((day, di) => {
                    if (!day) return <div key={di} className="py-2" />
                    const dateStr = `${yearNum}-${String(monNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                    const data = calMap.get(dateStr)
                    const isSelected = selectedDate === dateStr
                    const isSun = di === 0
                    const isSat = di === 6

                    return (
                      <button
                        key={di}
                        onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                        className={`py-1.5 flex flex-col items-center gap-0.5 border-none cursor-pointer transition-colors ${
                          isSelected ? 'bg-accent-light' : 'bg-transparent hover:bg-surface'
                        }`}
                      >
                        <span className={`text-[13px] font-medium ${
                          isSelected ? 'text-accent font-bold' : isSun ? 'text-red-400' : isSat ? 'text-blue-400' : 'text-fore-brand'
                        }`}>
                          {day}
                        </span>
                        {/* 출퇴근 상태 표시 */}
                        {data ? (
                          <div className="flex gap-0.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              data.status === 'COMPLETED' ? 'bg-[#16a34a]' :
                              data.status === 'WORKING' ? 'bg-[#2563EB]' :
                              data.status === 'EXCEPTION' ? 'bg-[#e65100]' : 'bg-[#9CA3AF]'
                            }`} />
                            {data.hasReport && <span className="w-1.5 h-1.5 rounded-full bg-[#7c3aed]" />}
                          </div>
                        ) : (
                          <div className="h-1.5" />
                        )}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>

            {/* 범례 */}
            <div className="flex items-center gap-4 justify-center mb-4 text-[10px] text-muted-brand">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#16a34a]" />완료</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#2563EB]" />근무중</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#e65100]" />예외</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#7c3aed]" />일보</span>
            </div>

            {/* 선택된 날짜 상세 */}
            {selectedDayData && (
              <div className="bg-card rounded-2xl border border-brand p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[15px] font-bold text-fore-brand">{selectedDate?.slice(5)} ({WEEKDAYS[new Date(selectedDate!).getDay()]})</span>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    selectedDayData.status === 'COMPLETED' ? 'bg-green-light text-[#16a34a]' :
                    selectedDayData.status === 'WORKING' ? 'bg-blue-50 text-[#2563EB]' : 'bg-[#fff3e0] text-[#e65100]'
                  }`}>
                    {selectedDayData.status === 'COMPLETED' ? '퇴근완료' : selectedDayData.status === 'WORKING' ? '근무중' : '예외'}
                  </span>
                </div>
                <div className="space-y-2 text-[13px]">
                  <div className="flex justify-between">
                    <span className="text-muted-brand">현장</span>
                    <span className="text-fore-brand font-medium">{selectedDayData.siteName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-brand">출근</span>
                    <span className="text-fore-brand">{fmtTime(selectedDayData.checkInAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-brand">퇴근</span>
                    <span className="text-fore-brand">{fmtTime(selectedDayData.checkOutAt)}</span>
                  </div>
                  {selectedDayData.manDays !== null && (
                    <div className="flex justify-between">
                      <span className="text-muted-brand">공수</span>
                      <span className="text-fore-brand font-bold">{selectedDayData.manDays.toFixed(1)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-brand">작업일보</span>
                    <span className={selectedDayData.hasReport ? 'text-[#16a34a] font-medium' : 'text-muted2-brand'}>
                      {selectedDayData.hasReport ? (selectedDayData.reportStatus === 'CONFIRMED' ? '확정' : '작성') : '미작성'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {!selectedDayData && calDays.length === 0 && !loading && (
              <div className="text-center text-muted-brand text-sm py-6">이 달에 출퇴근 기록이 없습니다.</div>
            )}
          </>
        )}

        {/* ── 급여 명세 탭 ───────────────────────────── */}
        {!loading && tab === 'list' && (
          <>
            {summary && (
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: '근무일수', value: `${summary.totalDays}일`, color: '#2563EB' },
                  { label: '확정일수', value: `${summary.confirmedDays}일`, color: '#16a34a' },
                  { label: '총 공수', value: `${fmt(summary.totalUnits)}공수`, color: '#e65100' },
                  { label: '예상 노임', value: fmtWon(summary.totalAmount), color: '#F97316' },
                ].map(c => (
                  <div key={c.label} className="bg-card rounded-xl px-4 py-4 border border-brand" style={{ borderTop: `3px solid ${c.color}` }}>
                    <div className="text-[18px] font-bold text-fore-brand">{c.value}</div>
                    <div className="text-[11px] text-muted-brand mt-0.5">{c.label}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-card rounded-2xl border border-brand overflow-hidden">
              <div className="px-4 py-3 border-b border-brand">
                <span className="text-[13px] font-bold text-fore-brand">일자별 명세</span>
              </div>
              {days.length === 0 ? (
                <div className="py-8 text-center text-muted-brand text-sm">이 월에 근무 기록이 없습니다.</div>
              ) : (
                <div className="divide-y divide-brand">
                  {days.map(d => (
                    <div key={`${d.workDate}-${d.siteName}`} className="px-4 py-3 flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[13px] font-semibold text-fore-brand">{d.workDate.slice(5)}</span>
                          <span className="text-[11px] text-muted-brand truncate">{d.siteName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {d.workType && (
                            <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded" style={{ color: WORK_TYPE_COLOR[d.workType] ?? '#9e9e9e', background: 'rgba(0,0,0,0.04)' }}>
                              {WORK_TYPE_LABEL[d.workType] ?? d.workType}
                            </span>
                          )}
                          <span className="text-[11px] text-muted2-brand">{fmtMinutes(d.workMinutes)}</span>
                          {d.status === 'DRAFT' && <span className="text-[10px] text-accent-hover bg-[#fff3e0] px-1.5 py-0.5 rounded">집계중</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[13px] font-bold text-fore-brand">{fmtWon(d.totalAmount)}</div>
                        {d.allowanceAmount > 0 && <div className="text-[11px] text-muted-brand">수당 {fmtWon(d.allowanceAmount)}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {summary && summary.totalAmount > 0 && (
                <div className="px-4 py-3 border-t border-brand bg-surface flex justify-between items-center">
                  <span className="text-[13px] font-bold text-muted-brand">월 합계</span>
                  <span className="text-[16px] font-bold text-accent">{fmtWon(summary.totalAmount)}</span>
                </div>
              )}
            </div>

            <p className="text-[11px] text-muted2-brand text-center mt-4 leading-relaxed">
              * 집계중 항목은 관리자 확정 전 예상 금액입니다.
            </p>
          </>
        )}

      </div>
      <WorkerBottomNav />
    </div>
  )
}
