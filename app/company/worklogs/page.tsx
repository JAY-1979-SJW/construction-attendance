'use client'

import { useState, useEffect, useCallback } from 'react'
import { MobileCardList, MobileCard, MobileCardField, MobileCardFields } from '@/components/admin/ui'

interface Site {
  id: string
  name: string
}

interface WorkLog {
  id: string
  siteId: string
  workDate: string
  totalWorkers: number
  normalWorkers: number
  absentWorkers: number
  weatherCondition: string | null
  workSummary: string | null
  safetyIncident: boolean
  isFinalized: boolean
  createdAt: string
}

const WEATHER_LABELS: Record<string, string> = {
  SUNNY: '맑음', CLOUDY: '흐림', RAINY: '비', SNOWY: '눈', WINDY: '바람', FOGGY: '안개',
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR')
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function monthStart() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export default function CompanyWorklogsPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [siteId, setSiteId] = useState('')
  const [fromDate, setFromDate] = useState(monthStart())
  const [toDate, setToDate] = useState(today())
  const [logs, setLogs] = useState<WorkLog[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/sites?pageSize=200')
      .then(r => r.json())
      .then(d => setSites(d.items ?? d.data?.items ?? []))
  }, [])

  const load = useCallback(() => {
    if (!siteId) return
    setLoading(true)
    setMsg(null)
    const params = new URLSearchParams({ from: fromDate, to: toDate })
    fetch(`/api/admin/sites/${siteId}/worklogs?${params}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setLogs(d.data?.worklogs ?? [])
        else setMsg(d.message ?? '불러오기 실패')
      })
      .finally(() => setLoading(false))
  }, [siteId, fromDate, toDate])

  useEffect(() => { if (siteId) load() }, [siteId, load])

  return (
    <div className="p-8 font-sans">
      <h1 className="text-[22px] font-bold text-fore-brand mb-5">작업일보</h1>

      <div className="flex gap-2 items-center mb-5 flex-wrap">
        <select
          className="px-3 py-2 border border-brand rounded-md text-[13px] min-w-[160px]"
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
        >
          <option value="">현장 선택</option>
          {sites.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <input type="date" className="px-[10px] py-2 border border-brand rounded-md text-[13px]" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        <span className="text-muted2-brand text-[13px]">~</span>
        <input type="date" className="px-[10px] py-2 border border-brand rounded-md text-[13px]" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        <button onClick={load} className="px-4 py-2 bg-brand-accent text-white border-none rounded-md cursor-pointer text-[13px]">조회</button>
      </div>

      {!siteId && (
        <div className="text-center text-muted2-brand py-12 bg-card border border-brand rounded-lg text-[14px]">현장을 선택하면 작업일보를 확인할 수 있습니다.</div>
      )}

      {msg && <div className="px-[14px] py-[10px] bg-red-light text-status-rejected rounded-md text-[13px] mb-3">{msg}</div>}

      {loading ? (
        <p className="text-muted2-brand text-center py-10">불러오는 중...</p>
      ) : siteId && logs.length === 0 ? (
        <div className="text-center text-muted2-brand py-12 bg-card border border-brand rounded-lg text-[14px]">해당 기간에 작업일보가 없습니다.</div>
      ) : logs.length > 0 ? (
        <MobileCardList
          items={logs}
          keyExtractor={(log) => log.id}
          emptyMessage="해당 기간에 작업일보가 없습니다."
          renderCard={(log) => (
            <MobileCard
              title={fmtDate(log.workDate)}
              badge={
                <span className="text-[11px] px-2 py-[2px] rounded" style={{ background: log.isFinalized ? '#d1fae5' : '#fef3c7', color: log.isFinalized ? '#065f46' : '#92400e' }}>
                  {log.isFinalized ? '마감' : '작성중'}
                </span>
              }
            >
              <MobileCardFields>
                <MobileCardField label="전체 인원" value={`${log.totalWorkers}명`} />
                <MobileCardField label="정상 출근" value={`${log.normalWorkers}명`} />
                <MobileCardField label="결근" value={`${log.absentWorkers}명`} />
                <MobileCardField label="날씨" value={log.weatherCondition ? (WEATHER_LABELS[log.weatherCondition] ?? log.weatherCondition) : '—'} />
                <MobileCardField label="안전 사고" value={log.safetyIncident ? <span className="text-status-rejected font-semibold">발생</span> : <span className="text-muted2-brand">없음</span>} />
                {log.workSummary && <MobileCardField label="요약" value={log.workSummary} />}
              </MobileCardFields>
            </MobileCard>
          )}
          renderTable={() => (
            <div className="bg-card border border-brand rounded-lg overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead className="bg-surface">
                  <tr>
                    {['날짜', '전체 인원', '정상 출근', '결근', '날씨', '안전 사고', '상태', '요약'].map(h => (
                      <th key={h} className="px-[14px] py-[10px] text-left text-[12px] text-muted-brand font-semibold border-b border-brand whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id} className="border-b border-brand">
                      <td className="px-[14px] py-[10px] text-body-brand align-middle whitespace-nowrap">{fmtDate(log.workDate)}</td>
                      <td className="px-[14px] py-[10px] text-body-brand align-middle text-center">{log.totalWorkers}</td>
                      <td className="px-[14px] py-[10px] text-body-brand align-middle text-center">{log.normalWorkers}</td>
                      <td className="px-[14px] py-[10px] text-body-brand align-middle text-center">{log.absentWorkers}</td>
                      <td className="px-[14px] py-[10px] text-body-brand align-middle">{log.weatherCondition ? (WEATHER_LABELS[log.weatherCondition] ?? log.weatherCondition) : '—'}</td>
                      <td className="px-[14px] py-[10px] text-body-brand align-middle">
                        {log.safetyIncident ? (
                          <span className="text-status-rejected text-[12px] font-semibold">발생</span>
                        ) : (
                          <span className="text-muted2-brand text-[12px]">없음</span>
                        )}
                      </td>
                      <td className="px-[14px] py-[10px] text-body-brand align-middle">
                        <span className="text-[11px] px-2 py-[2px] rounded" style={{ background: log.isFinalized ? '#d1fae5' : '#fef3c7', color: log.isFinalized ? '#065f46' : '#92400e' }}>
                          {log.isFinalized ? '마감' : '작성중'}
                        </span>
                      </td>
                      <td className="px-[14px] py-[10px] text-body-brand align-middle max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap">
                        {log.workSummary ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        />
      ) : null}
    </div>
  )
}
