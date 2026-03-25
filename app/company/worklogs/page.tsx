'use client'

import { useState, useEffect, useCallback } from 'react'

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
  SUNNY: 'ë§‘ìŒ', CLOUDY: '?ë¦¼', RAINY: 'ë¹?, SNOWY: '??, WINDY: 'ë°”ëŒ', FOGGY: '?ˆê°œ',
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
        else setMsg(d.message ?? 'ë¶ˆëŸ¬?¤ê¸° ?¤íŒ¨')
      })
      .finally(() => setLoading(false))
  }, [siteId, fromDate, toDate])

  useEffect(() => { if (siteId) load() }, [siteId, load])

  return (
    <div className="p-8 font-sans">
      <h1 className="text-[22px] font-bold text-[#111827] mb-5">?‘ì—…?¼ë³´</h1>

      <div className="flex gap-2 items-center mb-5 flex-wrap">
        <select
          className="px-3 py-2 border border-[rgba(91,164,217,0.3)] rounded-md text-[13px] min-w-[160px]"
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
        >
          <option value="">?„ì¥ ? íƒ</option>
          {sites.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <input type="date" className="px-[10px] py-2 border border-[rgba(91,164,217,0.3)] rounded-md text-[13px]" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        <span className="text-[#9ca3af] text-[13px]">~</span>
        <input type="date" className="px-[10px] py-2 border border-[rgba(91,164,217,0.3)] rounded-md text-[13px]" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        <button onClick={load} className="px-4 py-2 bg-[#F97316] text-white border-none rounded-md cursor-pointer text-[13px]">ì¡°íšŒ</button>
      </div>

      {!siteId && (
        <div className="text-center text-[#9ca3af] py-12 bg-card border border-[#e5e7eb] rounded-lg text-[14px]">?„ì¥??? íƒ?˜ë©´ ?‘ì—…?¼ë³´ë¥??•ì¸?????ˆìŠµ?ˆë‹¤.</div>
      )}

      {msg && <div className="px-[14px] py-[10px] bg-[#fee2e2] text-[#991b1b] rounded-md text-[13px] mb-3">{msg}</div>}

      {loading ? (
        <p className="text-[#9ca3af] text-center py-10">ë¶ˆëŸ¬?¤ëŠ” ì¤?..</p>
      ) : siteId && logs.length === 0 ? (
        <div className="text-center text-[#9ca3af] py-12 bg-card border border-[#e5e7eb] rounded-lg text-[14px]">?´ë‹¹ ê¸°ê°„???‘ì—…?¼ë³´ê°€ ?†ìŠµ?ˆë‹¤.</div>
      ) : logs.length > 0 ? (
        <div className="bg-card border border-[#e5e7eb] rounded-lg overflow-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead className="bg-[#f9fafb]">
              <tr>
                {['? ì§œ', '?„ì²´ ?¸ì›', '?•ìƒ ì¶œê·¼', 'ê²°ê·¼', '? ì”¨', '?ˆì „ ?¬ê³ ', '?íƒœ', '?”ì•½'].map(h => (
                  <th key={h} className="px-[14px] py-[10px] text-left text-[12px] text-[#6b7280] font-semibold border-b border-[#e5e7eb]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id} className="border-b border-[#f3f4f6]">
                  <td className="px-[14px] py-[10px] text-[#374151] align-middle">{fmtDate(log.workDate)}</td>
                  <td className="px-[14px] py-[10px] text-[#374151] align-middle text-center">{log.totalWorkers}</td>
                  <td className="px-[14px] py-[10px] text-[#374151] align-middle text-center">{log.normalWorkers}</td>
                  <td className="px-[14px] py-[10px] text-[#374151] align-middle text-center">{log.absentWorkers}</td>
                  <td className="px-[14px] py-[10px] text-[#374151] align-middle">{log.weatherCondition ? (WEATHER_LABELS[log.weatherCondition] ?? log.weatherCondition) : '??}</td>
                  <td className="px-[14px] py-[10px] text-[#374151] align-middle">
                    {log.safetyIncident ? (
                      <span className="text-[#dc2626] text-[12px] font-semibold">ë°œìƒ</span>
                    ) : (
                      <span className="text-[#9ca3af] text-[12px]">?†ìŒ</span>
                    )}
                  </td>
                  <td className="px-[14px] py-[10px] text-[#374151] align-middle">
                    <span
                      className="text-[11px] px-2 py-[2px] rounded"
                      style={{
                        background: log.isFinalized ? '#d1fae5' : '#fef3c7',
                        color: log.isFinalized ? '#065f46' : '#92400e',
                      }}
                    >
                      {log.isFinalized ? 'ë§ˆê°' : '?‘ì„±ì¤?}
                    </span>
                  </td>
                  <td className="px-[14px] py-[10px] text-[#374151] align-middle max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap">
                    {log.workSummary ?? '??}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
