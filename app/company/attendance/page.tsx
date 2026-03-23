'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

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

  // 수동조정 필터
  const [showManualOnly, setShowManualOnly] = useState(false)

  // 편집 상태
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
    <div style={styles.container}>
      <h1 style={styles.title}>출퇴근 현황</h1>

      <div style={styles.filterRow}>
        <label style={styles.label}>날짜</label>
        <input type="date" value={date} onChange={handleDateChange} style={styles.dateInput} />
        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={showManualOnly}
            onChange={(e) => setShowManualOnly(e.target.checked)}
            style={{ marginRight: '6px', cursor: 'pointer' }}
          />
          수동조정만 보기
        </label>
      </div>

      {loading ? (
        <p style={styles.loading}>불러오는 중...</p>
      ) : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                {['근로자명', '현장', '출근시각', '퇴근시각', '공수', '상태', ''].map((h, i) => (
                  <th key={i} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayedRecords.length === 0 ? (
                <tr><td colSpan={7} style={styles.empty}>출퇴근 기록이 없습니다.</td></tr>
              ) : displayedRecords.map((r) => {
                const isEditing = editingId === r.id
                const canEdit = !!r.attendanceDayId && EDITABLE_STATUSES.has(r.status)
                const displayMinutes = r.workedMinutesRawFinal ?? r.workedMinutesRaw

                return (
                  <>
                    <tr key={r.id} style={styles.tr}>
                      <td style={styles.td}>{r.workerName}</td>
                      <td style={styles.td}>{r.siteName || '-'}</td>
                      <td style={styles.td}>{formatTime(r.checkInAt)}</td>
                      <td style={styles.td}>{formatTime(r.checkOutAt)}</td>
                      <td style={styles.td}>
                        <span>{calcManDay(displayMinutes)}</span>
                        {r.manualAdjustedYn && (
                          <span style={styles.manualBadge}>수동</span>
                        )}
                      </td>
                      <td style={styles.td}>
                        <span style={{
                          ...styles.badge,
                          background: STATUS_BG[r.status] ?? '#f5f5f5',
                          color: STATUS_COLOR[r.status] ?? '#555',
                        }}>
                          {STATUS_LABEL[r.status] ?? r.status}
                        </span>
                      </td>
                      <td style={styles.td}>
                        {canEdit && !isEditing && (
                          <button onClick={() => openEdit(r)} style={styles.editBtn}>
                            수정
                          </button>
                        )}
                        {isEditing && (
                          <button onClick={cancelEdit} style={styles.cancelBtn}>
                            취소
                          </button>
                        )}
                      </td>
                    </tr>
                    {isEditing && (
                      <tr key={`${r.id}-edit`} style={{ background: '#fffde7' }}>
                        <td colSpan={7} style={{ padding: '12px 16px' }}>
                          <div style={styles.editRow}>
                            <span style={styles.editInfo}>
                              자동 계산: <strong>{calcManDay(r.workedMinutesAuto ?? r.workedMinutesRaw)}</strong>
                            </span>
                            <label style={styles.editLabel}>분 (0~1440)</label>
                            <input
                              type="number"
                              min={0}
                              max={1440}
                              value={editMinutes}
                              onChange={(e) => setEditMinutes(e.target.value)}
                              style={styles.editInput}
                              placeholder="예: 480"
                            />
                            <label style={styles.editLabel}>수정 사유</label>
                            <input
                              type="text"
                              value={editReason}
                              onChange={(e) => setEditReason(e.target.value)}
                              style={{ ...styles.editInput, width: '200px' }}
                              placeholder="사유 입력 (2자 이상)"
                              maxLength={200}
                            />
                            <button
                              onClick={() => saveEdit(r.id)}
                              disabled={editSaving}
                              style={styles.saveBtn}
                            >
                              {editSaving ? '저장 중...' : '저장'}
                            </button>
                          </div>
                          {editError && (
                            <p style={styles.editError}>{editError}</p>
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

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '32px' },
  title: { fontSize: '22px', fontWeight: 700, margin: '0 0 20px', color: '#1a1a2e' },
  filterRow: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' },
  label: { fontSize: '13px', fontWeight: 600, color: '#555' },
  checkboxLabel: { fontSize: '13px', fontWeight: 500, color: '#555', display: 'flex', alignItems: 'center', cursor: 'pointer' },
  dateInput: { padding: '8px 12px', border: '1px solid #ddd', borderRadius: '7px', fontSize: '14px', outline: 'none' },
  loading: { color: '#888', fontSize: '15px' },
  tableWrapper: { background: 'white', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', overflow: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#666', borderBottom: '1px solid #eee', background: '#fafafa', whiteSpace: 'nowrap' as const },
  tr: { borderBottom: '1px solid #f0f0f0' },
  td: { padding: '12px 16px', fontSize: '14px', color: '#333', whiteSpace: 'nowrap' as const },
  empty: { padding: '32px', textAlign: 'center', color: '#aaa', fontSize: '14px' },
  badge: { padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 },
  manualBadge: { marginLeft: '6px', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: '#fff8e1', color: '#f57f17', border: '1px solid #ffe082' },
  editBtn: { padding: '4px 10px', fontSize: '12px', fontWeight: 600, background: '#1565c0', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' },
  cancelBtn: { padding: '4px 10px', fontSize: '12px', fontWeight: 600, background: '#757575', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' },
  saveBtn: { padding: '6px 14px', fontSize: '13px', fontWeight: 600, background: '#2e7d32', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' },
  editRow: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' as const },
  editLabel: { fontSize: '12px', fontWeight: 600, color: '#555' },
  editInfo: { fontSize: '13px', color: '#555', marginRight: '4px' },
  editInput: { padding: '6px 10px', border: '1px solid #bbb', borderRadius: '6px', fontSize: '13px', width: '90px', outline: 'none' },
  editError: { margin: '8px 0 0', fontSize: '12px', color: '#c62828', fontWeight: 500 },
}
