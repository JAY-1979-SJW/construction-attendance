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

const emptyForm = {
  totalWorkers: 0,
  normalWorkers: 0,
  absentWorkers: 0,
  weatherCondition: 'SUNNY',
  workSummary: '',
  safetyIncident: false,
  isFinalized: false,
}

export default function OpsWorklogsPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [siteId, setSiteId] = useState('')
  const [fromDate, setFromDate] = useState(monthStart())
  const [toDate, setToDate] = useState(today())
  const [logs, setLogs] = useState<WorkLog[]>([])
  const [loading, setLoading] = useState(false)
  const [isReadOnly, setIsReadOnly] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // 작성 폼
  const [showForm, setShowForm] = useState(false)
  const [formDate, setFormDate] = useState(today())
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/admin/sites?pageSize=200')
      .then(r => r.json())
      .then(d => setSites(d.items ?? d.data?.items ?? []))
    fetch('/api/admin/auth/me')
      .then(r => r.json())
      .then(d => { if (d.data?.role === 'EXTERNAL_SITE_ADMIN') setIsReadOnly(true) })
      .catch(() => {})
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
        else setMsg({ type: 'error', text: d.message ?? '불러오기 실패' })
      })
      .finally(() => setLoading(false))
  }, [siteId, fromDate, toDate])

  useEffect(() => { if (siteId) load() }, [siteId, load])

  const handleSubmit = async () => {
    if (!siteId) { setMsg({ type: 'error', text: '현장을 선택하세요.' }); return }
    if (!formDate) { setMsg({ type: 'error', text: '날짜를 선택하세요.' }); return }
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch(`/api/admin/sites/${siteId}/worklogs/${formDate}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const d = await res.json()
      if (res.ok && d.success !== false) {
        setMsg({ type: 'success', text: '작업일보가 등록되었습니다.' })
        setShowForm(false)
        setForm(emptyForm)
        load()
      } else {
        setMsg({ type: 'error', text: d.message ?? '등록 실패' })
      }
    } finally { setSaving(false) }
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-5">
        <h1 className="text-[22px] font-bold text-[#111827] m-0">작업일보</h1>
        {siteId && !isReadOnly && (
          <button
            onClick={() => setShowForm(v => !v)}
            className="px-4 py-2 bg-[#0f4c75] text-white border-none rounded-md cursor-pointer text-[13px]"
          >
            {showForm ? '취소' : '+ 일보 작성'}
          </button>
        )}
      </div>

      <div className="flex gap-2 items-center mb-5 flex-wrap">
        <select
          className="px-3 py-2 border border-[rgba(91,164,217,0.3)] rounded-md text-[13px] min-w-[160px]"
          value={siteId}
          onChange={e => { setSiteId(e.target.value); setShowForm(false) }}
        >
          <option value="">현장 선택</option>
          {sites.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <input
          type="date"
          className="px-[10px] py-2 border border-[rgba(91,164,217,0.3)] rounded-md text-[13px]"
          value={fromDate}
          onChange={e => setFromDate(e.target.value)}
        />
        <span className="text-[#9ca3af] text-[13px]">~</span>
        <input
          type="date"
          className="px-[10px] py-2 border border-[rgba(91,164,217,0.3)] rounded-md text-[13px]"
          value={toDate}
          onChange={e => setToDate(e.target.value)}
        />
        <button
          onClick={load}
          className="px-4 py-2 bg-[#0f4c75] text-white border-none rounded-md cursor-pointer text-[13px]"
        >
          조회
        </button>
        {isReadOnly && (
          <span className="px-[10px] py-[5px] bg-[rgba(251,191,36,0.15)] border border-[rgba(251,191,36,0.4)] rounded text-[12px] text-[#92400e]">
            읽기 전용
          </span>
        )}
      </div>

      {msg && (
        <div
          className="px-[14px] py-[10px] rounded-md mb-4 text-[13px]"
          style={{
            background: msg.type === 'success' ? '#d1fae5' : '#fee2e2',
            color: msg.type === 'success' ? '#065f46' : '#991b1b',
          }}
        >
          {msg.text}
        </div>
      )}

      {/* 작성 폼 */}
      {showForm && !isReadOnly && (
        <div className="bg-[#eff6ff] border border-[#bfdbfe] rounded-[10px] p-5 mb-5">
          <h3 className="m-0 mb-4 text-[14px] font-semibold text-[#1e40af]">작업일보 작성</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] text-[#6b7280] mb-1">날짜 *</label>
              <input
                type="date"
                className="w-full border border-[rgba(91,164,217,0.3)] rounded-md px-[10px] py-2 text-[13px] box-border"
                value={formDate}
                onChange={e => setFormDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[12px] text-[#6b7280] mb-1">날씨</label>
              <select
                className="w-full border border-[rgba(91,164,217,0.3)] rounded-md px-[10px] py-2 text-[13px] box-border"
                value={form.weatherCondition ?? ''}
                onChange={e => setForm(f => ({ ...f, weatherCondition: e.target.value }))}
              >
                {Object.entries(WEATHER_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12px] text-[#6b7280] mb-1">전체 인원</label>
              <input
                type="number"
                min={0}
                className="w-full border border-[rgba(91,164,217,0.3)] rounded-md px-[10px] py-2 text-[13px] box-border"
                value={form.totalWorkers}
                onChange={e => setForm(f => ({ ...f, totalWorkers: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <label className="block text-[12px] text-[#6b7280] mb-1">정상 출근</label>
              <input
                type="number"
                min={0}
                className="w-full border border-[rgba(91,164,217,0.3)] rounded-md px-[10px] py-2 text-[13px] box-border"
                value={form.normalWorkers}
                onChange={e => setForm(f => ({ ...f, normalWorkers: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <label className="block text-[12px] text-[#6b7280] mb-1">결근</label>
              <input
                type="number"
                min={0}
                className="w-full border border-[rgba(91,164,217,0.3)] rounded-md px-[10px] py-2 text-[13px] box-border"
                value={form.absentWorkers}
                onChange={e => setForm(f => ({ ...f, absentWorkers: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                id="safetyIncident"
                checked={form.safetyIncident}
                onChange={e => setForm(f => ({ ...f, safetyIncident: e.target.checked }))}
              />
              <label htmlFor="safetyIncident" className="text-[13px] text-[#374151]">안전 사고 발생</label>
            </div>
            <div className="col-span-2">
              <label className="block text-[12px] text-[#6b7280] mb-1">작업 요약</label>
              <textarea
                rows={3}
                className="w-full border border-[rgba(91,164,217,0.3)] rounded-md px-[10px] py-2 text-[13px] box-border resize-y"
                value={form.workSummary}
                onChange={e => setForm(f => ({ ...f, workSummary: e.target.value }))}
                placeholder="오늘 작업 내용 요약"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isFinalized"
                checked={form.isFinalized}
                onChange={e => setForm(f => ({ ...f, isFinalized: e.target.checked }))}
              />
              <label htmlFor="isFinalized" className="text-[13px] text-[#374151]">마감 처리</label>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="px-5 py-2 bg-[#0f4c75] text-white border-none rounded-md cursor-pointer text-[13px] disabled:opacity-50"
            >
              {saving ? '저장 중...' : '등록'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-white text-[#374151] border border-[rgba(91,164,217,0.3)] rounded-md cursor-pointer text-[13px]"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {!siteId ? (
        <div className="text-center text-[#9ca3af] py-12 bg-white border border-[#e5e7eb] rounded-lg text-[14px]">
          현장을 선택하면 작업일보를 확인할 수 있습니다.
        </div>
      ) : loading ? (
        <p className="text-[#6b7280] text-center py-10">불러오는 중...</p>
      ) : logs.length === 0 ? (
        <div className="text-center text-[#9ca3af] py-12 bg-white border border-[#e5e7eb] rounded-lg text-[14px]">
          해당 기간에 작업일보가 없습니다.
        </div>
      ) : (
        <div className="bg-white border border-[#e5e7eb] rounded-lg overflow-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead className="bg-[#f9fafb]">
              <tr>
                {['날짜', '전체', '정상', '결근', '날씨', '안전사고', '상태', '요약'].map(h => (
                  <th key={h} className="px-[14px] py-[10px] text-left text-[12px] text-[#6b7280] font-semibold border-b border-[#e5e7eb]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id} className="border-b border-[#f3f4f6] hover:bg-[rgba(91,164,217,0.04)]">
                  <td className="px-[14px] py-[10px] text-[#374151] whitespace-nowrap">{fmtDate(log.workDate)}</td>
                  <td className="px-[14px] py-[10px] text-[#374151] text-center">{log.totalWorkers}</td>
                  <td className="px-[14px] py-[10px] text-[#374151] text-center">{log.normalWorkers}</td>
                  <td className="px-[14px] py-[10px] text-[#374151] text-center">{log.absentWorkers}</td>
                  <td className="px-[14px] py-[10px] text-[#374151]">
                    {log.weatherCondition ? (WEATHER_LABELS[log.weatherCondition] ?? log.weatherCondition) : '—'}
                  </td>
                  <td className="px-[14px] py-[10px]">
                    {log.safetyIncident ? (
                      <span className="text-[#dc2626] text-[12px] font-semibold">발생</span>
                    ) : (
                      <span className="text-[#9ca3af] text-[12px]">없음</span>
                    )}
                  </td>
                  <td className="px-[14px] py-[10px]">
                    <span
                      className="text-[11px] px-2 py-[2px] rounded"
                      style={{
                        background: log.isFinalized ? '#d1fae5' : '#fef3c7',
                        color: log.isFinalized ? '#065f46' : '#92400e',
                      }}
                    >
                      {log.isFinalized ? '마감' : '작성중'}
                    </span>
                  </td>
                  <td className="px-[14px] py-[10px] text-[#374151] max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap">
                    {log.workSummary ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
