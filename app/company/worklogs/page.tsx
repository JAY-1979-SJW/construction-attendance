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
    <div style={styles.page}>
      <h1 style={styles.title}>작업일보</h1>

      <div style={styles.filterRow}>
        <select
          style={styles.select}
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
        >
          <option value="">현장 선택</option>
          {sites.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <input type="date" style={styles.dateInput} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        <span style={{ color: '#9ca3af', fontSize: '13px' }}>~</span>
        <input type="date" style={styles.dateInput} value={toDate} onChange={(e) => setToDate(e.target.value)} />
        <button onClick={load} style={styles.searchBtn}>조회</button>
      </div>

      {!siteId && (
        <div style={styles.empty}>현장을 선택하면 작업일보를 확인할 수 있습니다.</div>
      )}

      {msg && <div style={styles.errorMsg}>{msg}</div>}

      {loading ? (
        <p style={{ color: '#9ca3af', textAlign: 'center', padding: '40px 0' }}>불러오는 중...</p>
      ) : siteId && logs.length === 0 ? (
        <div style={styles.empty}>해당 기간에 작업일보가 없습니다.</div>
      ) : logs.length > 0 ? (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.thead}>
                <th style={styles.th}>날짜</th>
                <th style={styles.th}>전체 인원</th>
                <th style={styles.th}>정상 출근</th>
                <th style={styles.th}>결근</th>
                <th style={styles.th}>날씨</th>
                <th style={styles.th}>안전 사고</th>
                <th style={styles.th}>상태</th>
                <th style={styles.th}>요약</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id} style={styles.tr}>
                  <td style={styles.td}>{fmtDate(log.workDate)}</td>
                  <td style={{ ...styles.td, textAlign: 'center' }}>{log.totalWorkers}</td>
                  <td style={{ ...styles.td, textAlign: 'center' }}>{log.normalWorkers}</td>
                  <td style={{ ...styles.td, textAlign: 'center' }}>{log.absentWorkers}</td>
                  <td style={styles.td}>{log.weatherCondition ? (WEATHER_LABELS[log.weatherCondition] ?? log.weatherCondition) : '—'}</td>
                  <td style={styles.td}>
                    {log.safetyIncident ? (
                      <span style={{ color: '#dc2626', fontSize: '12px', fontWeight: 600 }}>발생</span>
                    ) : (
                      <span style={{ color: '#9ca3af', fontSize: '12px' }}>없음</span>
                    )}
                  </td>
                  <td style={styles.td}>
                    <span style={{
                      fontSize: '11px', padding: '2px 8px', borderRadius: '4px',
                      background: log.isFinalized ? '#d1fae5' : '#fef3c7',
                      color: log.isFinalized ? '#065f46' : '#92400e',
                    }}>
                      {log.isFinalized ? '마감' : '작성중'}
                    </span>
                  </td>
                  <td style={{ ...styles.td, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {log.workSummary ?? '—'}
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

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '32px', fontFamily: 'sans-serif' },
  title: { fontSize: '22px', fontWeight: 700, color: '#111827', marginBottom: '20px' },
  filterRow: { display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' },
  select: { padding: '8px 12px', border: '1px solid rgba(91,164,217,0.3)', borderRadius: '6px', fontSize: '13px', minWidth: '160px' },
  dateInput: { padding: '8px 10px', border: '1px solid rgba(91,164,217,0.3)', borderRadius: '6px', fontSize: '13px' },
  searchBtn: {
    padding: '8px 16px', background: '#0f4c75', color: 'white',
    border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
  },
  empty: {
    textAlign: 'center', color: '#9ca3af', padding: '48px 0',
    background: '#243144', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px',
  },
  errorMsg: { padding: '10px 14px', background: '#fee2e2', color: '#991b1b', borderRadius: '6px', fontSize: '13px', marginBottom: '12px' },
  tableWrap: { background: '#243144', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  thead: { background: '#f9fafb' },
  th: { padding: '10px 14px', textAlign: 'left', fontSize: '12px', color: '#6b7280', fontWeight: 600, borderBottom: '1px solid #e5e7eb' },
  tr: { borderBottom: '1px solid #f3f4f6' },
  td: { padding: '10px 14px', color: '#374151', verticalAlign: 'middle' },
}
