'use client'

import { useState, useEffect, useCallback } from 'react'

interface Site {
  id: string
  name: string
}

interface AttendanceRecord {
  id: string
  workerName: string
  siteName: string
  checkInAt: string | null
  checkOutAt: string | null
  status: string
  workedMinutesRaw: number | null
  workedMinutesAuto: number | null
  workedMinutesOverride: number | null
  workedMinutesRawFinal: number | null
  manualAdjustedYn: boolean
  manualAdjustedReason: string | null
  attendanceDayId: string | null
}

const STATUS_MAP: Record<string, { label: string; bg: string; color: string }> = {
  WORKING:          { label: 'ê·¼ë¬´ì¤?,  bg: '#d1fae5', color: '#065f46' },
  COMPLETED:        { label: '?„ë£Œ',    bg: '#dbeafe', color: '#1e40af' },
  MISSING_CHECKOUT: { label: 'ë¯¸í‡´ê·?,  bg: '#fee2e2', color: '#991b1b' },
  EXCEPTION:        { label: '?ˆì™¸',    bg: '#ffedd5', color: '#9a3412' },
  ADJUSTED:         { label: 'ë³´ì •',    bg: '#ede9fe', color: '#5b21b6' },
}

const EDITABLE_STATUSES = new Set(['COMPLETED', 'MISSING_CHECKOUT', 'EXCEPTION'])

function todayStr() {
  const d = new Date()
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

function fmtTime(iso: string | null) {
  if (!iso) return '??
  const kst = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(11, 16)
}

function calcManDay(mins: number | null | undefined): string {
  if (mins == null) return '??
  if (mins >= 480) return '1.0ê³µìˆ˜'
  if (mins >= 240) return '0.5ê³µìˆ˜'
  if (mins > 0) return `${mins}ë¶?
  return '0ë¶?
}

export default function OpsAttendancePage() {
  const [sites, setSites] = useState<Site[]>([])
  const [siteId, setSiteId] = useState('')
  const [date, setDate] = useState(todayStr())
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [isReadOnly, setIsReadOnly] = useState(false)

  // ?¸ì§‘ ?íƒœ
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editMinutes, setEditMinutes] = useState('')
  const [editReason, setEditReason] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/admin/sites?pageSize=200')
      .then(r => r.json())
      .then(d => setSites(d.items ?? d.data?.items ?? []))
    // ?½ê¸° ?„ìš© ?¬ë? ?•ì¸ (EXTERNAL_SITE_ADMIN)
    fetch('/api/admin/auth/me')
      .then(r => r.json())
      .then(d => { if (d.data?.role === 'EXTERNAL_SITE_ADMIN') setIsReadOnly(true) })
      .catch(() => {})
  }, [])

  const load = useCallback(() => {
    if (!siteId) return
    setLoading(true)
    const params = new URLSearchParams({ date, siteId, pageSize: '200' })
    fetch(`/api/admin/attendance?${params}`)
      .then(r => r.json())
      .then(d => setRecords(d.items ?? d.data?.items ?? []))
      .finally(() => setLoading(false))
  }, [siteId, date])

  useEffect(() => { if (siteId) load() }, [siteId, date, load])

  const openEdit = (r: AttendanceRecord) => {
    setEditingId(r.id)
    setEditMinutes(String(r.workedMinutesRawFinal ?? r.workedMinutesRaw ?? ''))
    setEditReason('')
    setEditError('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditMinutes('')
    setEditReason('')
    setEditError('')
  }

  const saveEdit = async (id: string) => {
    const mins = parseInt(editMinutes, 10)
    if (isNaN(mins) || mins < 0 || mins > 1440) {
      setEditError('0~1440 ?¬ì´???«ìë¥??…ë ¥?˜ì„¸??')
      return
    }
    if (editReason.trim().length < 2) {
      setEditError('?˜ì • ?¬ìœ ë¥?2???´ìƒ ?…ë ¥?˜ì„¸??')
      return
    }
    setEditSaving(true)
    setEditError('')
    try {
      const res = await fetch(`/api/admin/attendance/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workedMinutesOverride: mins, manualAdjustedReason: editReason.trim() }),
      })
      const d = await res.json()
      if (res.ok && d.success !== false) {
        setMsg({ type: 'success', text: '?˜ì •?˜ì—ˆ?µë‹ˆ??' })
        cancelEdit()
        load()
      } else {
        setEditError(d.message ?? '?€???¤íŒ¨')
      }
    } catch {
      setEditError('?¤íŠ¸?Œí¬ ?¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.')
    } finally {
      setEditSaving(false)
    }
  }

  return (
    <div className="p-8">
      <h1 className="text-[22px] font-bold text-[#111827] mb-5">ì¶œí‡´ê·??„í™©</h1>

      <div className="flex gap-2 items-center mb-5 flex-wrap">
        <select
          className="px-3 py-2 border border-[rgba(91,164,217,0.3)] rounded-md text-[13px] min-w-[160px]"
          value={siteId}
          onChange={e => setSiteId(e.target.value)}
        >
          <option value="">?„ì¥ ? íƒ</option>
          {sites.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="px-3 py-2 border border-[rgba(91,164,217,0.3)] rounded-md text-[13px]"
        />
        <button
          onClick={load}
          className="px-4 py-2 bg-[#F97316] text-white border-none rounded-md cursor-pointer text-[13px]"
        >
          ì¡°íšŒ
        </button>
        {isReadOnly && (
          <span className="px-[10px] py-[5px] bg-[rgba(251,191,36,0.15)] border border-[rgba(251,191,36,0.4)] rounded text-[12px] text-[#92400e]">
            ?½ê¸° ?„ìš© ëª¨ë“œ
          </span>
        )}
      </div>

      {msg && (
        <div
          className="px-[14px] py-[10px] rounded-md mb-3 text-[13px]"
          style={{
            background: msg.type === 'success' ? '#d1fae5' : '#fee2e2',
            color: msg.type === 'success' ? '#065f46' : '#991b1b',
          }}
        >
          {msg.text}
        </div>
      )}

      {!siteId ? (
        <div className="text-center py-[60px] bg-white rounded-lg border border-[#e5e7eb] text-[#6b7280] text-[14px]">
          ?„ì¥??? íƒ?˜ë©´ ì¶œí‡´ê·??„í™©???•ì¸?????ˆìŠµ?ˆë‹¤.
        </div>
      ) : loading ? (
        <p className="text-[#6b7280]">ë¡œë”© ì¤?..</p>
      ) : records.length === 0 ? (
        <div className="text-center py-[60px] bg-white rounded-lg border border-[#e5e7eb] text-[#6b7280] text-[14px]">
          ?´ë‹¹ ? ì§œ??ì¶œí‡´ê·?ê¸°ë¡???†ìŠµ?ˆë‹¤.
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-[#e5e7eb] overflow-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead className="bg-[#f9fafb]">
              <tr>
                {['ê·¼ë¡œ?ëª…', '?„ì¥', 'ì¶œê·¼', '?´ê·¼', 'ê³µìˆ˜', '?íƒœ', ...(isReadOnly ? [] : [''])].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-left text-[12px] font-semibold text-[#6b7280] border-b border-[#e5e7eb] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map(r => {
                const st = STATUS_MAP[r.status] ?? { label: r.status, bg: '#f3f4f6', color: '#6b7280' }
                const isEditing = editingId === r.id
                const canEdit = !isReadOnly && !!r.attendanceDayId && EDITABLE_STATUSES.has(r.status)
                const displayMinutes = r.workedMinutesRawFinal ?? r.workedMinutesRaw

                return (
                  <>
                    <tr key={r.id} className="border-b border-[#f3f4f6] hover:bg-[rgba(91,164,217,0.04)]">
                      <td className="px-4 py-[13px] font-semibold text-[#1f2937]">{r.workerName}</td>
                      <td className="px-4 py-[13px] text-[#374151]">{r.siteName || '??}</td>
                      <td className="px-4 py-[13px] text-[#374151] whitespace-nowrap">{fmtTime(r.checkInAt)}</td>
                      <td className="px-4 py-[13px] text-[#374151] whitespace-nowrap">{fmtTime(r.checkOutAt)}</td>
                      <td className="px-4 py-[13px] text-[#374151] whitespace-nowrap">
                        <span>{calcManDay(displayMinutes)}</span>
                        {r.manualAdjustedYn && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-[#fef3c7] text-[#92400e]">?˜ë™</span>
                        )}
                      </td>
                      <td className="px-4 py-[13px]">
                        <span
                          className="text-[11px] px-2 py-[3px] rounded font-medium"
                          style={{ background: st.bg, color: st.color }}
                        >
                          {st.label}
                        </span>
                      </td>
                      {!isReadOnly && (
                        <td className="px-4 py-[13px]">
                          {canEdit && !isEditing && (
                            <button
                              onClick={() => openEdit(r)}
                              className="px-3 py-[5px] bg-[#F97316] text-white border-none rounded-[5px] cursor-pointer text-[12px]"
                            >
                              ?˜ì •
                            </button>
                          )}
                          {isEditing && (
                            <button
                              onClick={cancelEdit}
                              className="px-3 py-[5px] bg-[#6b7280] text-white border-none rounded-[5px] cursor-pointer text-[12px]"
                            >
                              ì·¨ì†Œ
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                    {isEditing && (
                      <tr key={`${r.id}-edit`} className="bg-[#fffde7]">
                        <td colSpan={7} className="px-4 py-3">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="text-[13px] text-[#6b7280]">
                              ?ë™ ê³„ì‚°: <strong>{calcManDay(r.workedMinutesAuto ?? r.workedMinutesRaw)}</strong>
                            </span>
                            <label className="text-[12px] font-semibold text-[#374151]">ë¶?(0~1440)</label>
                            <input
                              type="number"
                              min={0}
                              max={1440}
                              value={editMinutes}
                              onChange={e => setEditMinutes(e.target.value)}
                              className="px-2.5 py-1.5 border border-[#d1d5db] rounded-md text-[13px] w-[90px] outline-none"
                              placeholder="?? 480"
                            />
                            <label className="text-[12px] font-semibold text-[#374151]">?˜ì • ?¬ìœ </label>
                            <input
                              type="text"
                              value={editReason}
                              onChange={e => setEditReason(e.target.value)}
                              className="px-2.5 py-1.5 border border-[#d1d5db] rounded-md text-[13px] outline-none w-[200px]"
                              placeholder="?¬ìœ  ?…ë ¥ (2???´ìƒ)"
                              maxLength={200}
                            />
                            <button
                              onClick={() => saveEdit(r.id)}
                              disabled={editSaving}
                              className="px-3.5 py-1.5 text-[13px] font-semibold bg-[#059669] text-white border-none rounded-md cursor-pointer disabled:opacity-50"
                            >
                              {editSaving ? '?€??ì¤?..' : '?€??}
                            </button>
                          </div>
                          {editError && (
                            <p className="mt-2 mb-0 text-[12px] text-[#dc2626]">{editError}</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
