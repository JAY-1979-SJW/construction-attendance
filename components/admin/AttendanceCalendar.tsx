'use client'

import { useState, useEffect, useCallback } from 'react'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

interface CalendarDay {
  date: string
  totalWorkers: number
  completed: number
  working: number
  exception: number
  reportWritten: number
  reportConfirmed: number
  confirmedUnits: number
  confirmedCount: number
}

interface CalendarSummary {
  totalAttendance: number
  totalCompleted: number
  totalReports: number
  totalConfirmedUnits: number
  workingDays: number
}

function buildGrid(monthKey: string): (number | null)[][] {
  const [y, m] = monthKey.split('-').map(Number)
  const firstDay = new Date(y, m - 1, 1).getDay()
  const lastDate = new Date(y, m, 0).getDate()
  const grid: (number | null)[][] = []
  let week: (number | null)[] = new Array(firstDay).fill(null)
  for (let d = 1; d <= lastDate; d++) {
    week.push(d)
    if (week.length === 7) { grid.push(week); week = [] }
  }
  if (week.length > 0) { while (week.length < 7) week.push(null); grid.push(week) }
  return grid
}

function getMonthKey() {
  return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 7)
}

interface Props {
  siteId?: string
}

export default function AttendanceCalendar({ siteId }: Props) {
  const [monthKey, setMonthKey] = useState(getMonthKey())
  const [days, setDays] = useState<CalendarDay[]>([])
  const [summary, setSummary] = useState<CalendarSummary | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ month: monthKey })
      if (siteId) params.set('siteId', siteId)
      const res = await fetch(`/api/admin/attendance/calendar?${params}`)
      const json = await res.json()
      if (json.success) {
        setDays(json.data.days ?? [])
        setSummary(json.data.summary ?? null)
      }
    } finally { setLoading(false) }
  }, [monthKey, siteId])

  useEffect(() => { load() }, [load])
  useEffect(() => { setSelected(null) }, [monthKey])

  const prevMonth = () => {
    const [y, m] = monthKey.split('-').map(Number)
    setMonthKey(new Date(y, m - 2, 1).toISOString().slice(0, 7))
  }
  const nextMonth = () => {
    const [y, m] = monthKey.split('-').map(Number)
    setMonthKey(new Date(y, m, 1).toISOString().slice(0, 7))
  }

  const dayMap = new Map(days.map(d => [d.date, d]))
  const grid = buildGrid(monthKey)
  const [yearNum, monNum] = monthKey.split('-').map(Number)
  const selectedData = selected ? dayMap.get(selected) : null

  return (
    <div className="space-y-4">
      {/* 월 선택 */}
      <div className="flex items-center gap-3 justify-between">
        <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-full bg-accent-light text-accent border-none cursor-pointer text-lg">‹</button>
        <input type="month" value={monthKey} onChange={e => setMonthKey(e.target.value)} className="text-center text-fore-brand font-bold text-base bg-transparent border-none outline-none" />
        <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-full bg-accent-light text-accent border-none cursor-pointer text-lg">›</button>
      </div>

      {/* 월 요약 */}
      {summary && (
        <div className="grid grid-cols-5 gap-2">
          {[
            { label: '운영일', value: `${summary.workingDays}일`, color: '#6B7280' },
            { label: '총 출근', value: `${summary.totalAttendance}명`, color: '#2563EB' },
            { label: '퇴근완료', value: `${summary.totalCompleted}명`, color: '#16a34a' },
            { label: '일보', value: `${summary.totalReports}건`, color: '#7c3aed' },
            { label: '확정공수', value: `${summary.totalConfirmedUnits}`, color: '#e65100' },
          ].map(c => (
            <div key={c.label} className="bg-card rounded-lg px-2 py-3 border border-brand text-center" style={{ borderTop: `2px solid ${c.color}` }}>
              <div className="text-[14px] font-bold text-fore-brand">{c.value}</div>
              <div className="text-[11px] text-muted-brand">{c.label}</div>
            </div>
          ))}
        </div>
      )}

      {loading && <div className="text-center py-6 text-muted-brand text-sm">로딩 중...</div>}

      {/* 캘린더 그리드 */}
      {!loading && (
        <div className="bg-card rounded-xl border border-brand overflow-hidden">
          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 border-b border-brand bg-surface">
            {WEEKDAYS.map((w, i) => (
              <div key={w} className={`text-center py-2 text-[11px] font-bold ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-muted-brand'}`}>
                {w}
              </div>
            ))}
          </div>

          {/* 날짜 */}
          {grid.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 border-b border-brand last:border-b-0">
              {week.map((day, di) => {
                if (!day) return <div key={di} className="min-h-[72px]" />
                const dateStr = `${yearNum}-${String(monNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const data = dayMap.get(dateStr)
                const isSelected = selected === dateStr
                const isSun = di === 0
                const isSat = di === 6
                const hasData = data && data.totalWorkers > 0

                return (
                  <button
                    key={di}
                    onClick={() => setSelected(isSelected ? null : dateStr)}
                    className={`min-h-[72px] p-1 flex flex-col items-center gap-1 border-none cursor-pointer transition-colors text-left ${
                      isSelected ? 'bg-accent-light' : hasData ? 'bg-card hover:bg-surface' : 'bg-card'
                    }`}
                  >
                    <span className={`text-[12px] font-medium ${
                      isSelected ? 'text-accent font-bold' : isSun ? 'text-red-400' : isSat ? 'text-blue-400' : 'text-fore-brand'
                    }`}>
                      {day}
                    </span>
                    {hasData && (
                      <div className="flex flex-col items-center gap-0.5 w-full">
                        <span className="text-[11px] font-bold text-[#2563EB]">{data.totalWorkers}명</span>
                        {data.confirmedUnits > 0 && (
                          <span className="text-[9px] text-[#e65100]">{data.confirmedUnits.toFixed(1)}공수</span>
                        )}
                        <div className="flex gap-0.5 mt-0.5">
                          {data.completed > 0 && <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a]" />}
                          {data.working > 0 && <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" />}
                          {data.exception > 0 && <span className="w-1.5 h-1.5 rounded-full bg-[#e65100]" />}
                          {(data.reportWritten + data.reportConfirmed) > 0 && <span className="w-1.5 h-1.5 rounded-full bg-[#7c3aed]" />}
                        </div>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {/* 범례 */}
      <div className="flex items-center gap-4 justify-center text-[11px] text-muted-brand">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#16a34a]" />퇴근완료</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#2563EB]" />근무중</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#e65100]" />예외</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#7c3aed]" />일보</span>
      </div>

      {/* 선택 날짜 상세 */}
      {selectedData && selectedData.totalWorkers > 0 && (
        <div className="bg-card rounded-xl border border-brand p-4">
          <div className="text-[14px] font-bold text-fore-brand mb-3">
            {selected?.slice(5)} ({WEEKDAYS[new Date(selected!).getDay()]})
          </div>
          <div className="grid grid-cols-2 gap-3 text-[13px]">
            <div className="flex justify-between"><span className="text-muted-brand">총 출근</span><span className="font-bold text-fore-brand">{selectedData.totalWorkers}명</span></div>
            <div className="flex justify-between"><span className="text-muted-brand">퇴근완료</span><span className="font-bold text-[#16a34a]">{selectedData.completed}명</span></div>
            <div className="flex justify-between"><span className="text-muted-brand">근무중</span><span className="font-bold text-[#2563EB]">{selectedData.working}명</span></div>
            <div className="flex justify-between"><span className="text-muted-brand">예외</span><span className="font-bold text-[#e65100]">{selectedData.exception}명</span></div>
            <div className="flex justify-between"><span className="text-muted-brand">일보 작성</span><span className="font-bold text-[#7c3aed]">{selectedData.reportWritten + selectedData.reportConfirmed}건</span></div>
            <div className="flex justify-between"><span className="text-muted-brand">확정 공수</span><span className="font-bold text-[#e65100]">{selectedData.confirmedUnits.toFixed(1)}</span></div>
          </div>
        </div>
      )}
    </div>
  )
}
