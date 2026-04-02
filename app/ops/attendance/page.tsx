'use client'

import { useState, useEffect, useCallback } from 'react'
import { MobileCardList, MobileCard, MobileCardField, MobileCardFields, MobileCardActions } from '@/components/admin/ui'

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
  WORKING:          { label: '근무중',  bg: '#d1fae5', color: '#065f46' },
  COMPLETED:        { label: '완료',    bg: '#dbeafe', color: '#1e40af' },
  MISSING_CHECKOUT: { label: '미퇴근',  bg: '#fee2e2', color: '#991b1b' },
  EXCEPTION:        { label: '예외',    bg: '#ffedd5', color: '#9a3412' },
  ADJUSTED:         { label: '보정',    bg: '#ede9fe', color: '#5b21b6' },
}

const EDITABLE_STATUSES = new Set(['COMPLETED', 'MISSING_CHECKOUT', 'EXCEPTION'])

function todayStr() {
  const d = new Date()
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

function fmtTime(iso: string | null) {
  if (!iso) return '—'
  const kst = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(11, 16)
}

function calcManDay(mins: number | null | undefined): string {
  if (mins == null) return '—'
  if (mins >= 480) return '1.0공수'
  if (mins >= 240) return '0.5공수'
  if (mins > 0) return `${mins}분`
  return '0분'
}

export default function OpsAttendancePage() {
  const [sites, setSites] = useState<Site[]>([])
  const [siteId, setSiteId] = useState('')
  const [date, setDate] = useState(todayStr())
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [isReadOnly, setIsReadOnly] = useState(false)

  // 편집 상태
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
    // 읽기 전용 여부 확인 (EXTERNAL_SITE_ADMIN)
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
      setEditError('0~1440 사이의 숫자를 입력하세요.')
      return
    }
    if (editReason.trim().length < 2) {
      setEditError('수정 사유를 2자 이상 입력하세요.')
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
        setMsg({ type: 'success', text: '수정되었습니다.' })
        cancelEdit()
        load()
      } else {
        setEditError(d.message ?? '저장 실패')
      }
    } catch {
      setEditError('네트워크 오류가 발생했습니다.')
    } finally {
      setEditSaving(false)
    }
  }

  return (
    <div className="p-8">
      <h1 className="text-[22px] font-bold text-fore-brand mb-5">출퇴근 현황</h1>

      <div className="flex gap-2 items-center mb-5 flex-wrap">
        <select
          className="px-3 py-2 border border-[#D1D5DB] rounded-md text-[13px] min-w-[160px]"
          value={siteId}
          onChange={e => setSiteId(e.target.value)}
        >
          <option value="">현장 선택</option>
          {sites.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="px-3 py-2 border border-[#D1D5DB] rounded-md text-[13px]"
        />
        <button
          onClick={load}
          className="px-4 py-2 bg-brand-accent text-white border-none rounded-md cursor-pointer text-[13px]"
        >
          조회
        </button>
        {isReadOnly && (
          <span className="px-[10px] py-[5px] bg-[rgba(251,191,36,0.15)] border border-[rgba(251,191,36,0.4)] rounded text-[12px] text-status-pending">
            읽기 전용 모드
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
        <div className="text-center py-[60px] bg-card rounded-lg border border-brand text-muted-brand text-[14px]">
          현장을 선택하면 출퇴근 현황을 확인할 수 있습니다.
        </div>
      ) : loading ? (
        <p className="text-muted-brand">로딩 중...</p>
      ) : records.length === 0 ? (
        <div className="text-center py-[60px] bg-card rounded-lg border border-brand text-muted-brand text-[14px]">
          해당 날짜의 출퇴근 기록이 없습니다.
        </div>
      ) : (
        <div className="bg-card rounded-lg border border-brand overflow-hidden">
          <MobileCardList
            items={records}
            keyExtractor={(r) => r.id}
            emptyMessage="해당 날짜의 출퇴근 기록이 없습니다."
            renderCard={(r) => {
              const st = STATUS_MAP[r.status] ?? { label: r.status, bg: '#f3f4f6', color: '#6b7280' }
              const isEditing = editingId === r.id
              const canEdit = !isReadOnly && !!r.attendanceDayId && EDITABLE_STATUSES.has(r.status)
              const displayMinutes = r.workedMinutesRawFinal ?? r.workedMinutesRaw
              return (
                <MobileCard
                  title={r.workerName}
                  subtitle={r.siteName || undefined}
                  badge={
                    <span className="text-[11px] px-2 py-[3px] rounded font-medium" style={{ background: st.bg, color: st.color }}>
                      {st.label}
                    </span>
                  }
                >
                  <MobileCardFields>
                    <MobileCardField label="출근" value={fmtTime(r.checkInAt)} />
                    <MobileCardField label="퇴근" value={fmtTime(r.checkOutAt)} />
                    <MobileCardField label="공수" value={
                      <span>
                        {calcManDay(displayMinutes)}
                        {r.manualAdjustedYn && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-yellow-light text-status-pending">수동</span>
                        )}
                      </span>
                    } />
                  </MobileCardFields>
                  {canEdit && (
                    <MobileCardActions>
                      <button
                        onClick={() => isEditing ? cancelEdit() : openEdit(r)}
                        className="px-3 py-1.5 bg-brand-accent text-white border-none rounded-[5px] cursor-pointer text-[12px]"
                      >
                        {isEditing ? '취소' : '수정'}
                      </button>
                    </MobileCardActions>
                  )}
                  {isEditing && (
                    <div className="px-1 pt-3 pb-1 border-t border-[rgba(91,164,217,0.2)]">
                      <div className="flex flex-col gap-2">
                        <div className="text-[13px] text-muted-brand">
                          자동 계산: <strong>{calcManDay(r.workedMinutesAuto ?? r.workedMinutesRaw)}</strong>
                        </div>
                        <div>
                          <label className="text-[12px] font-semibold text-body-brand block mb-1">분 (0~1440)</label>
                          <input
                            type="number" min={0} max={1440}
                            value={editMinutes}
                            onChange={e => setEditMinutes(e.target.value)}
                            className="px-2.5 py-1.5 border border-[#d1d5db] rounded-md text-[13px] w-full outline-none"
                            placeholder="예: 480"
                          />
                        </div>
                        <div>
                          <label className="text-[12px] font-semibold text-body-brand block mb-1">수정 사유</label>
                          <input
                            type="text"
                            value={editReason}
                            onChange={e => setEditReason(e.target.value)}
                            className="px-2.5 py-1.5 border border-[#d1d5db] rounded-md text-[13px] w-full outline-none"
                            placeholder="사유 입력 (2자 이상)"
                            maxLength={200}
                          />
                        </div>
                        <button
                          onClick={() => saveEdit(r.id)}
                          disabled={editSaving}
                          className="px-3.5 py-1.5 text-[13px] font-semibold bg-[#059669] text-white border-none rounded-md cursor-pointer disabled:opacity-50"
                        >
                          {editSaving ? '저장 중...' : '저장'}
                        </button>
                        {editError && <p className="text-[12px] text-status-rejected m-0">{editError}</p>}
                      </div>
                    </div>
                  )}
                </MobileCard>
              )
            }}
            renderTable={() => (
              <table className="w-full border-collapse text-[13px]">
                <thead className="bg-surface">
                  <tr>
                    {['근로자명', '현장', '출근', '퇴근', '공수', '상태', ...(isReadOnly ? [] : [''])].map((h, i) => (
                      <th key={i} className="px-4 py-3 text-left text-[12px] font-semibold text-muted-brand border-b border-brand whitespace-nowrap">{h}</th>
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
                        <tr key={r.id} className="border-b border-brand hover:bg-surface">
                          <td className="px-4 py-[13px] font-semibold text-[#1f2937]">{r.workerName}</td>
                          <td className="px-4 py-[13px] text-body-brand">{r.siteName || '—'}</td>
                          <td className="px-4 py-[13px] text-body-brand whitespace-nowrap">{fmtTime(r.checkInAt)}</td>
                          <td className="px-4 py-[13px] text-body-brand whitespace-nowrap">{fmtTime(r.checkOutAt)}</td>
                          <td className="px-4 py-[13px] text-body-brand whitespace-nowrap">
                            <span>{calcManDay(displayMinutes)}</span>
                            {r.manualAdjustedYn && (
                              <span className="ml-1.5 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-yellow-light text-status-pending">수동</span>
                            )}
                          </td>
                          <td className="px-4 py-[13px]">
                            <span className="text-[11px] px-2 py-[3px] rounded font-medium" style={{ background: st.bg, color: st.color }}>
                              {st.label}
                            </span>
                          </td>
                          {!isReadOnly && (
                            <td className="px-4 py-[13px]">
                              {canEdit && !isEditing && (
                                <button onClick={() => openEdit(r)} className="px-3 py-[5px] bg-brand-accent text-white border-none rounded-[5px] cursor-pointer text-[12px]">수정</button>
                              )}
                              {isEditing && (
                                <button onClick={cancelEdit} className="px-3 py-[5px] bg-muted-brand text-white border-none rounded-[5px] cursor-pointer text-[12px]">취소</button>
                              )}
                            </td>
                          )}
                        </tr>
                        {isEditing && (
                          <tr key={`${r.id}-edit`} className="bg-[#fffde7]">
                            <td colSpan={7} className="px-4 py-3">
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <span className="text-[13px] text-muted-brand">자동 계산: <strong>{calcManDay(r.workedMinutesAuto ?? r.workedMinutesRaw)}</strong></span>
                                <label className="text-[12px] font-semibold text-body-brand">분 (0~1440)</label>
                                <input
                                  type="number" min={0} max={1440}
                                  value={editMinutes}
                                  onChange={e => setEditMinutes(e.target.value)}
                                  className="px-2.5 py-1.5 border border-[#d1d5db] rounded-md text-[13px] w-[90px] outline-none"
                                  placeholder="예: 480"
                                />
                                <label className="text-[12px] font-semibold text-body-brand">수정 사유</label>
                                <input
                                  type="text"
                                  value={editReason}
                                  onChange={e => setEditReason(e.target.value)}
                                  className="px-2.5 py-1.5 border border-[#d1d5db] rounded-md text-[13px] outline-none w-[200px]"
                                  placeholder="사유 입력 (2자 이상)"
                                  maxLength={200}
                                />
                                <button
                                  onClick={() => saveEdit(r.id)}
                                  disabled={editSaving}
                                  className="px-3.5 py-1.5 text-[13px] font-semibold bg-[#059669] text-white border-none rounded-md cursor-pointer disabled:opacity-50"
                                >
                                  {editSaving ? '저장 중...' : '저장'}
                                </button>
                              </div>
                              {editError && <p className="mt-2 mb-0 text-[12px] text-status-rejected">{editError}</p>}
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            )}
          />
        </div>
      )}
    </div>
  )
}
