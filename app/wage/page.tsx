'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import WorkerTopBar from '@/components/worker/WorkerTopBar'
import WorkerBottomNav from '@/components/worker/WorkerBottomNav'

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

function getMonthKey() {
  return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 7)
}

const WORK_TYPE_LABEL: Record<string, string> = {
  FULL_DAY: '1.0 공수',
  HALF_DAY: '0.5 공수',
  INVALID:  '무효',
}
const WORK_TYPE_COLOR: Record<string, string> = {
  FULL_DAY: '#1565c0',
  HALF_DAY: '#e65100',
  INVALID:  '#9e9e9e',
}

const fmt = (n: number) => n.toLocaleString('ko-KR')
const fmtWon = (n: number) => n > 0 ? fmt(n) + '원' : '-'

function fmtMinutes(m: number): string {
  if (!m) return '-'
  const h = Math.floor(m / 60)
  const min = m % 60
  return h > 0 ? (min > 0 ? `${h}시간 ${min}분` : `${h}시간`) : `${min}분`
}

export default function WageMyPayslipPage() {
  const router = useRouter()
  const [monthKey, setMonthKey] = useState(getMonthKey())
  const [days, setDays]         = useState<PayslipDay[]>([])
  const [summary, setSummary]   = useState<PayslipSummary | null>(null)
  const [workerName, setWorkerName] = useState('')
  const [jobTitle, setJobTitle]     = useState('')
  const [loading, setLoading]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/wage/my-payslip?monthKey=${monthKey}`)
      const data = await res.json()
      if (!data.success) {
        if (res.status === 401) { router.push('/login'); return }
        return
      }
      setDays(data.data.days ?? [])
      setSummary(data.data.summary ?? null)
      setWorkerName(data.data.workerName ?? '')
      setJobTitle(data.data.jobTitle ?? '')
    } finally { setLoading(false) }
  }, [monthKey, router])

  useEffect(() => { load() }, [load])

  const prevMonth = () => {
    const [y, m] = monthKey.split('-').map(Number)
    const d = new Date(y, m - 2, 1)
    setMonthKey(d.toISOString().slice(0, 7))
  }
  const nextMonth = () => {
    const [y, m] = monthKey.split('-').map(Number)
    const d = new Date(y, m, 1)
    setMonthKey(d.toISOString().slice(0, 7))
  }

  return (
    <div className="min-h-screen bg-brand pt-[60px] pb-24 px-4">
      <WorkerTopBar />
      <div className="max-w-[600px] mx-auto">

        {/* 헤더 */}
        <div className="mb-5 pt-2">
          <h1 className="text-xl font-bold text-fore-brand m-0">공수 / 급여</h1>
          <p className="text-[12px] text-muted-brand mt-0.5 m-0">
            {workerName && <span className="font-semibold text-accent">{workerName}</span>}
            {jobTitle && <span className="text-muted-brand"> · {jobTitle}</span>}
          </p>
        </div>

        {/* 월 선택 */}
        <div className="bg-card rounded-2xl px-4 py-4 mb-4 border border-brand flex items-center gap-3 justify-between">
          <button
            onClick={prevMonth}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-accent-light text-accent border-none cursor-pointer text-lg"
          >
            ‹
          </button>
          <input
            type="month"
            value={monthKey}
            onChange={(e) => setMonthKey(e.target.value)}
            className="text-center text-fore-brand font-bold text-base bg-transparent border-none outline-none"
          />
          <button
            onClick={nextMonth}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-accent-light text-accent border-none cursor-pointer text-lg"
          >
            ›
          </button>
        </div>

        {/* 월 요약 */}
        {summary && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { label: '근무일수',    value: `${summary.totalDays}일`, color: '#2563EB' },
              { label: '확정일수',    value: `${summary.confirmedDays}일`, color: '#16a34a' },
              { label: '총 공수',     value: `${fmt(summary.totalUnits)}공수`, color: '#e65100' },
              { label: '예상 노임',   value: fmtWon(summary.totalAmount), color: '#F97316' },
            ].map((c) => (
              <div
                key={c.label}
                className="bg-card rounded-xl px-4 py-4 border border-brand"
                style={{ borderTop: `3px solid ${c.color}` }}
              >
                <div className="text-[18px] font-bold text-fore-brand">{c.value}</div>
                <div className="text-[11px] text-muted-brand mt-0.5">{c.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* 일자별 명세 */}
        <div className="bg-card rounded-2xl border border-brand overflow-hidden">
          <div className="px-4 py-3 border-b border-brand">
            <span className="text-[13px] font-bold text-fore-brand">일자별 명세</span>
          </div>

          {loading ? (
            <div className="py-8 text-center text-muted-brand">로딩 중...</div>
          ) : days.length === 0 ? (
            <div className="py-8 text-center text-muted-brand text-sm">
              이 월에 근무 기록이 없습니다.
            </div>
          ) : (
            <div className="divide-y divide-brand">
              {days.map((d) => (
                <div key={`${d.workDate}-${d.siteName}`} className="px-4 py-3 flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[13px] font-semibold text-fore-brand">
                        {d.workDate.slice(5)}
                      </span>
                      <span className="text-[11px] text-muted-brand truncate">{d.siteName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {d.workType && (
                        <span
                          className="text-[11px] font-semibold px-1.5 py-0.5 rounded"
                          style={{
                            color: WORK_TYPE_COLOR[d.workType] ?? '#9e9e9e',
                            background: 'rgba(0,0,0,0.04)',
                          }}
                        >
                          {WORK_TYPE_LABEL[d.workType] ?? d.workType}
                        </span>
                      )}
                      <span className="text-[11px] text-muted2-brand">
                        {fmtMinutes(d.workMinutes)}
                      </span>
                      {d.status === 'DRAFT' && (
                        <span className="text-[10px] text-accent-hover bg-[#fff3e0] px-1.5 py-0.5 rounded">집계중</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[13px] font-bold text-fore-brand">
                      {fmtWon(d.totalAmount)}
                    </div>
                    {d.allowanceAmount > 0 && (
                      <div className="text-[11px] text-muted-brand">수당 {fmtWon(d.allowanceAmount)}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 합계 */}
          {summary && summary.totalAmount > 0 && (
            <div className="px-4 py-3 border-t border-brand bg-surface flex justify-between items-center">
              <span className="text-[13px] font-bold text-muted-brand">월 합계</span>
              <span className="text-[16px] font-bold text-accent">{fmtWon(summary.totalAmount)}</span>
            </div>
          )}
        </div>

        {/* 안내 */}
        <p className="text-[11px] text-muted2-brand text-center mt-4 leading-relaxed">
          * 집계중(주황색) 항목은 관리자 확정 전 예상 금액입니다.
          <br />
          최종 노임은 관리자 검토 후 확정됩니다.
        </p>
      </div>
      <WorkerBottomNav />
    </div>
  )
}
