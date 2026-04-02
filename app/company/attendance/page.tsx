'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MobileCardList, MobileCard, MobileCardField, MobileCardFields, MobileCardActions } from '@/components/admin/ui'

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

const STATUS_LABEL: Record<string, string> = {
  WORKING: '근무중',
  COMPLETED: '완료',
  MISSING_CHECKOUT: '미퇴근',
  EXCEPTION: '예외',
  ADJUSTED: '보정',
}
const STATUS_COLOR: Record<string, string> = {
  WORKING: '#2e7d32',
  COMPLETED: '#1565c0',
  MISSING_CHECKOUT: '#b71c1c',
  EXCEPTION: '#e65100',
  ADJUSTED: '#6a1b9a',
}
const STATUS_BG: Record<string, string> = {
  WORKING: '#e8f5e9',
  COMPLETED: '#e3f2fd',
  MISSING_CHECKOUT: '#ffebee',
  EXCEPTION: '#fff3e0',
  ADJUSTED: '#f3e5f5',
}

const EDITABLE_STATUSES = new Set(['COMPLETED', 'MISSING_CHECKOUT', 'EXCEPTION'])

function calcManDay(minutes: number | null | undefined): string {
  if (minutes == null) return '-'
  if (minutes >= 480) return '1.0공수'
  if (minutes >= 240) return '0.5공수'
  if (minutes > 0) return `${minutes}분`
  return '0분'
}

function todayStr(): string {
  const d = new Date()
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

export default function CompanyAttendancePage() {
  const router = useRouter()
  const [date, setDate] = useState(todayStr())
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)

  const [showManualOnly, setShowManualOnly] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editMinutes, setEditMinutes] = useState('')
  const [editReason, setEditReason] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const load = (d = date) => {
    setLoading(true)
    fetch(`/api/company/attendance?date=${d}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) { router.push('/company/login'); return }
        setRecords(data.data.items)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [router]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDate(e.target.value)
    load(e.target.value)
  }

  const formatTime = (iso: string | null) => {
    if (!iso) return '-'
    const d = new Date(iso)
    const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
    return kst.toISOString().slice(11, 16)
  }

  const openEdit = (r: AttendanceRecord) => {
    const currentMinutes = r.workedMinutesRawFinal ?? r.workedMinutesRaw ?? ''
    setEditingId(r.id)
    setEditMinutes(currentMinutes === '' ? '' : String(currentMinutes))
    setEditReason('')
    setEditError('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditMinutes('')
    setEditReason('')
    setEditError('')
  }

  const saveEdit = async (recordId: string) => {
    const mins = parseInt(editMinutes, 10)
    if (isNaN(mins) || mins < 0 || mins > 1440) {
      setEditError('0~1440 사이의 숫자를 입력해주세요.')
      return
    }
    if (editReason.trim().length < 2) {
      setEditError('수정 사유를 2자 이상 입력해주세요.')
      return
    }
    setEditSaving(true)
    setEditError('')
    try {
      const res = await fetch(`/api/company/attendance/${recordId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workedMinutesOverride: mins,
          manualAdjustedReason: editReason.trim(),
        }),
      })
      const data = await res.json()
      if (res.status === 403) {
        setEditError('이 기능이 비활성화되어 있습니다.')
        setEditSaving(false)
        return
      }
      if (!data.success) {
        setEditError(data.error ?? '저장 실패')
        setEditSaving(false)
        return
      }
      cancelEdit()
      load(date)
    } catch {
      setEditError('네트워크 오류가 발생했습니다.')
      setEditSaving(false)
    }
  }

  const displayedRecords = showManualOnly
    ? records.filter((r) => r.manualAdjustedYn)
    : records

  return (
    <div className="p-8">
      <h1 className="text-[22px] font-bold m-0 mb-5 text-fore-brand">출퇴근 현황</h1>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <label className="text-[13px] font-semibold text-muted-brand">날짜</label>
        <input
          type="date"
          value={date}
          onChange={handleDateChange}
          className="px-3 py-2 border border-brand rounded-[7px] text-sm outline-none"
        />
        <label className="flex items-center text-[13px] font-medium text-muted-brand cursor-pointer">
          <input
            type="checkbox"
            checked={showManualOnly}
            onChange={(e) => setShowManualOnly(e.target.checked)}
            className="mr-1.5 cursor-pointer"
          />
          수동조정만 보기
        </label>
      </div>

      {loading ? (
        <p className="text-muted-brand text-[15px]">불러오는 중...</p>
      ) : (
        <MobileCardList
          items={displayedRecords}
          keyExtractor={(r) => r.id}
          emptyMessage="출퇴근 기록이 없습니다."
          renderCard={(r) => {
            const isEditing = editingId === r.id
            const canEdit = !!r.attendanceDayId && EDITABLE_STATUSES.has(r.status)
            const displayMinutes = r.workedMinutesRawFinal ?? r.workedMinutesRaw

            return (
              <MobileCard
                title={r.workerName}
                subtitle={r.siteName || '-'}
                badge={
                  <span
                    className="px-2 py-0.5 rounded text-[12px] font-semibold"
                    style={{ background: STATUS_BG[r.status] ?? '#f5f5f5', color: STATUS_COLOR[r.status] ?? '#555' }}
                  >
                    {STATUS_LABEL[r.status] ?? r.status}
                  </span>
                }
              >
                <MobileCardFields>
                  <MobileCardField label="출근" value={formatTime(r.checkInAt)} />
                  <MobileCardField label="퇴근" value={formatTime(r.checkOutAt)} />
                  <MobileCardField
                    label="공수"
                    value={
                      <span className="flex items-center gap-1.5">
                        {calcManDay(displayMinutes)}
                        {r.manualAdjustedYn && (
                          <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-[#fff8e1] text-[#f57f17] border border-[#ffe082]">수동</span>
                        )}
                      </span>
                    }
                  />
                </MobileCardFields>

                {isEditing ? (
                  <div className="mt-3 pt-2 border-t border-brand">
                    <div className="text-[12px] text-muted-brand mb-2">
                      자동 계산: <strong>{calcManDay(r.workedMinutesAuto ?? r.workedMinutesRaw)}</strong>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <label className="text-[12px] font-semibold text-muted-brand w-[60px] shrink-0">분 (0~1440)</label>
                        <input
                          type="number"
                          min={0}
                          max={1440}
                          value={editMinutes}
                          onChange={(e) => setEditMinutes(e.target.value)}
                          className="px-2.5 py-1.5 border border-[#D1D5DB] rounded-[6px] text-[13px] w-[90px] outline-none"
                          placeholder="예: 480"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-[12px] font-semibold text-muted-brand w-[60px] shrink-0">수정 사유</label>
                        <input
                          type="text"
                          value={editReason}
                          onChange={(e) => setEditReason(e.target.value)}
                          className="px-2.5 py-1.5 border border-[#D1D5DB] rounded-[6px] text-[13px] outline-none flex-1"
                          placeholder="사유 입력 (2자 이상)"
                          maxLength={200}
                        />
                      </div>
                      {editError && <p className="text-[12px] text-[#c62828] font-medium mb-0">{editError}</p>}
                    </div>
                    <MobileCardActions>
                      <button
                        onClick={() => saveEdit(r.id)}
                        disabled={editSaving}
                        className="px-3.5 py-1.5 text-[13px] font-semibold bg-[#2e7d32] text-white border-none rounded-[6px] cursor-pointer"
                      >
                        {editSaving ? '저장 중...' : '저장'}
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-3.5 py-1.5 text-[13px] font-semibold bg-[#757575] text-white border-none rounded-[6px] cursor-pointer"
                      >
                        취소
                      </button>
                    </MobileCardActions>
                  </div>
                ) : canEdit ? (
                  <MobileCardActions>
                    <button
                      onClick={() => openEdit(r)}
                      className="px-2.5 py-1 text-[12px] font-semibold bg-[#E06810] text-white border-none rounded-[5px] cursor-pointer"
                    >
                      수정
                    </button>
                  </MobileCardActions>
                ) : null}
              </MobileCard>
            )
          }}
          renderTable={() => (
            <div className="bg-card rounded-[10px] shadow-[0_2px_8px_rgba(0,0,0,0.07)] overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {['근로자명', '현장', '출근시각', '퇴근시각', '공수', '상태', ''].map((h, i) => (
                      <th
                        key={i}
                        className="px-4 py-3 text-left text-[12px] font-semibold text-muted-brand border-b border-brand bg-surface whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayedRecords.map((r) => {
                    const isEditing = editingId === r.id
                    const canEdit = !!r.attendanceDayId && EDITABLE_STATUSES.has(r.status)
                    const displayMinutes = r.workedMinutesRawFinal ?? r.workedMinutesRaw

                    return (
                      <>
                        <tr key={r.id} className="border-b border-brand">
                          <td className="px-4 py-3 text-sm text-body-brand whitespace-nowrap">{r.workerName}</td>
                          <td className="px-4 py-3 text-sm text-body-brand whitespace-nowrap">{r.siteName || '-'}</td>
                          <td className="px-4 py-3 text-sm text-body-brand whitespace-nowrap">{formatTime(r.checkInAt)}</td>
                          <td className="px-4 py-3 text-sm text-body-brand whitespace-nowrap">{formatTime(r.checkOutAt)}</td>
                          <td className="px-4 py-3 text-sm text-body-brand whitespace-nowrap">
                            <span>{calcManDay(displayMinutes)}</span>
                            {r.manualAdjustedYn && (
                              <span className="ml-1.5 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-[#fff8e1] text-[#f57f17] border border-[#ffe082]">수동</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-body-brand whitespace-nowrap">
                            <span
                              className="px-2 py-0.5 rounded text-[12px] font-semibold"
                              style={{ background: STATUS_BG[r.status] ?? '#f5f5f5', color: STATUS_COLOR[r.status] ?? '#555' }}
                            >
                              {STATUS_LABEL[r.status] ?? r.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-body-brand whitespace-nowrap">
                            {canEdit && !isEditing && (
                              <button
                                onClick={() => openEdit(r)}
                                className="px-2.5 py-1 text-[12px] font-semibold bg-[#E06810] text-white border-none rounded-[5px] cursor-pointer"
                              >
                                수정
                              </button>
                            )}
                            {isEditing && (
                              <button
                                onClick={cancelEdit}
                                className="px-2.5 py-1 text-[12px] font-semibold bg-[#757575] text-white border-none rounded-[5px] cursor-pointer"
                              >
                                취소
                              </button>
                            )}
                          </td>
                        </tr>
                        {isEditing && (
                          <tr key={`${r.id}-edit`} className="bg-[#fffde7]">
                            <td colSpan={7} className="px-4 py-3">
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <span className="text-[13px] text-muted-brand mr-1">
                                  자동 계산: <strong>{calcManDay(r.workedMinutesAuto ?? r.workedMinutesRaw)}</strong>
                                </span>
                                <label className="text-[12px] font-semibold text-muted-brand">분 (0~1440)</label>
                                <input
                                  type="number"
                                  min={0}
                                  max={1440}
                                  value={editMinutes}
                                  onChange={(e) => setEditMinutes(e.target.value)}
                                  className="px-2.5 py-1.5 border border-[#D1D5DB] rounded-[6px] text-[13px] w-[90px] outline-none"
                                  placeholder="예: 480"
                                />
                                <label className="text-[12px] font-semibold text-muted-brand">수정 사유</label>
                                <input
                                  type="text"
                                  value={editReason}
                                  onChange={(e) => setEditReason(e.target.value)}
                                  className="px-2.5 py-1.5 border border-[#D1D5DB] rounded-[6px] text-[13px] outline-none w-[200px]"
                                  placeholder="사유 입력 (2자 이상)"
                                  maxLength={200}
                                />
                                <button
                                  onClick={() => saveEdit(r.id)}
                                  disabled={editSaving}
                                  className="px-3.5 py-1.5 text-[13px] font-semibold bg-[#2e7d32] text-white border-none rounded-[6px] cursor-pointer"
                                >
                                  {editSaving ? '저장 중...' : '저장'}
                                </button>
                              </div>
                              {editError && (
                                <p className="mt-2 mb-0 text-[12px] text-[#c62828] font-medium">{editError}</p>
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
        />
      )}
    </div>
  )
}
