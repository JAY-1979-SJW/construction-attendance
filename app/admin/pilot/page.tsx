'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface PilotMetrics {
  totalWorkers: number
  approvedDevices: number
  pendingDevices: number
  working: number
  completed: number
  adjusted: number
  moveCount: number
  needsReview: number
  suspectedMissing: number
  manualCorrections: number
}

interface PilotSummary {
  generatedAt: string
  targetDate: string
  metrics: PilotMetrics
}

const METRIC_CONFIG: Array<{
  key: keyof PilotMetrics
  label: string
  sub: string
  color: string
  alert?: (v: number) => boolean
}> = [
  { key: 'totalWorkers',      label: '총 대상자',            sub: '등록 근로자',          color: '#37474f' },
  { key: 'approvedDevices',   label: '승인 완료 기기',        sub: '활성 기기',             color: '#5BA4D9' },
  { key: 'pendingDevices',    label: '승인 대기',             sub: '기기 요청 PENDING',     color: '#7b1fa2', alert: (v) => v > 0 },
  { key: 'working',           label: 'WORKING',              sub: '출근 후 미퇴근',         color: '#2e7d32' },
  { key: 'completed',         label: 'COMPLETED',            sub: '정상 퇴근 완료',         color: '#4A93C8' },
  { key: 'adjusted',          label: 'ADJUSTED',             sub: '수동 보정 완료',         color: '#455a64' },
  { key: 'moveCount',         label: '이동 건수',             sub: '오늘 현장 이동',         color: '#00695c' },
  { key: 'needsReview',       label: 'needsReview',          sub: 'MISSING_CHECKOUT 누적', color: '#e65100', alert: (v) => v > 0 },
  { key: 'suspectedMissing',  label: '퇴근 누락 의심',        sub: '4h+ WORKING',          color: '#b71c1c', alert: (v) => v > 0 },
  { key: 'manualCorrections', label: '수동 보정 건수',        sub: '오늘 ADJUSTED',         color: '#5d4037' },
]

export default function PilotMonitorPage() {
  const router = useRouter()
  const [data, setData] = useState<PilotSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/admin/pilot/summary')
      .then((r) => r.json())
      .then((res) => {
        if (!res.success) { router.push('/admin/login'); return }
        setData(res.data)
        setLastRefresh(new Date())
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [router])

  useEffect(() => {
    load()
    const timer = setInterval(load, 60_000) // 1분마다 자동 갱신
    return () => clearInterval(timer)
  }, [load])

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  return (
    <div className="p-8">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold m-0 mb-1">파일럿 운영 모니터링</h1>
            <p className="text-[13px] text-muted-brand m-0">
              {data?.targetDate} &nbsp;|&nbsp; 마지막 갱신: {lastRefresh ? formatTime(lastRefresh.toISOString()) : '-'}
              &nbsp;
              <span className="bg-[rgba(244,121,32,0.12)] text-accent rounded px-[6px] py-[2px] text-[11px]">1분 자동 갱신</span>
            </p>
          </div>
          <button onClick={load} disabled={loading} className="px-5 py-[10px] bg-brand-accent text-white border-none rounded-lg cursor-pointer text-[14px] font-semibold">
            {loading ? '갱신 중...' : '지금 갱신'}
          </button>
        </div>

        {loading && !data ? (
          <div className="flex justify-center py-[60px]">로딩 중...</div>
        ) : (
          <>
            <div className="grid gap-4 mb-6 [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]">
              {METRIC_CONFIG.map(({ key, label, sub, color, alert }) => {
                const value = data?.metrics[key] ?? 0
                const isAlert = alert?.(value)
                return (
                  <div
                    key={key}
                    className="bg-card rounded-[12px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)] relative"
                    style={{
                      borderTop: `4px solid ${isAlert ? '#d32f2f' : color}`,
                      background: isAlert ? '#fff8f8' : undefined,
                    }}
                  >
                    <div className="text-[36px] font-bold mb-1" style={{ color: isAlert ? '#d32f2f' : color }}>
                      {value}
                    </div>
                    <div className="text-[14px] font-semibold mb-[2px]">{label}</div>
                    <div className="text-[12px] text-[#aaa]">{sub}</div>
                    {isAlert && <div className="absolute top-3 right-3 bg-[#d32f2f] text-white text-[10px] px-[6px] py-[2px] rounded font-semibold">확인 필요</div>}
                  </div>
                )
              })}
            </div>

            {/* 운영 기준 안내 */}
            <div className="bg-card rounded-[12px] px-6 py-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
              <div className="text-[14px] font-bold mb-3 text-[#444]">운영 기준</div>
              <ul className="m-0 pl-5 text-[13px] text-muted-brand leading-[2]">
                <li>승인 대기 30분 이상 방치 금지 — <strong>pendingDevices &gt; 0</strong> 즉시 처리</li>
                <li>퇴근 전 WORKING 잔존 확인 — <strong>working</strong> = 0 이어야 당일 종료 가능</li>
                <li>needsReview = MISSING_CHECKOUT 누적 — 익일 오전 전까지 검토 완료</li>
                <li>퇴근 누락 의심(suspectedMissing) = 4시간 이상 WORKING 상태 유지 근로자</li>
              </ul>
            </div>
          </>
        )}
    </div>
  )
}
