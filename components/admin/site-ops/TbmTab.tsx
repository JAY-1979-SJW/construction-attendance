'use client'

import { useState, useEffect, useCallback } from 'react'

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface TbmRecord {
  id: string
  title: string
  content: string | null
  conductedAt: string | null
  conductorId: string | null
  attendeeCount: number
  absentCount: number
  notes: string | null
}

const EMPTY_FORM = {
  title: '금일 TBM',
  content: '',
  conductedAt: '',
  attendeeCount: 0,
  absentCount: 0,
  notes: '',
}

function fmtTime(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export function TbmTab({ siteId, selectedDate, locked = false }: {
  siteId: string
  selectedDate: string
  locked?: boolean
}) {
  const [record, setRecord]     = useState<TbmRecord | null>(null)
  const [exists, setExists]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [editing, setEditing]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const [form, setForm]         = useState({ ...EMPTY_FORM })
  const [syncMsg, setSyncMsg]   = useState<string | null>(null)

  // ── 데이터 로드 ──────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    setSyncMsg(null)
    try {
      const res = await fetch(`/api/admin/sites/${siteId}/tbm/${selectedDate}`)
      if (res.ok) {
        const data = await res.json()
        setExists(data.data?.exists ?? false)
        setRecord(data.data?.item ?? null)
      }
    } finally {
      setLoading(false)
    }
  }, [siteId, selectedDate])

  useEffect(() => {
    load()
    setEditing(false)
  }, [load])

  // ── 저장 ─────────────────────────────────────────────────────────────────────

  const save = async () => {
    if (!form.title.trim()) {
      alert('TBM 제목을 입력해 주세요.')
      return
    }
    setSaving(true)
    try {
      const body = {
        title:         form.title,
        content:       form.content  || null,
        conductedAt:   form.conductedAt || null,
        attendeeCount: form.attendeeCount,
        absentCount:   form.absentCount,
        notes:         form.notes    || null,
      }
      const res = await fetch(`/api/admin/sites/${siteId}/tbm/${selectedDate}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      if (res.ok) {
        setEditing(false)
        setSyncMsg('저장 완료. 작업일보 TBM 요약이 자동 반영됩니다.')
        await load()
      } else {
        const d = await res.json()
        alert(d.message ?? '저장 실패')
      }
    } finally {
      setSaving(false)
    }
  }

  const startEdit = () => {
    setForm(
      record
        ? {
            title:         record.title,
            content:       record.content       ?? '',
            conductedAt:   record.conductedAt
              ? new Date(record.conductedAt).toISOString().slice(0, 16)
              : '',
            attendeeCount: record.attendeeCount,
            absentCount:   record.absentCount,
            notes:         record.notes         ?? '',
          }
        : { ...EMPTY_FORM }
    )
    setEditing(true)
    setSyncMsg(null)
  }

  // ── 렌더 ─────────────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="text-center text-gray-400 py-10">불러오는 중...</div>
  }

  return (
    <div className="space-y-4">
      {/* 상단 상태 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-gray-700">TBM / 안전</h2>
          {exists ? (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">
              TBM 기록 있음 ✓
            </span>
          ) : (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
              TBM 기록 없음
            </span>
          )}
        </div>
        {!editing && !locked && (
          <button
            onClick={startEdit}
            className="text-sm border border-green-500 text-green-700 px-3 py-1.5 rounded hover:bg-green-50"
          >
            {exists ? '수정' : '+ 신규 작성'}
          </button>
        )}
        {locked && (
          <span className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-600">
            🔒 작업일보 확정 — 수정 불가
          </span>
        )}
      </div>

      {/* 동기화 안내 */}
      {syncMsg && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-700">
          ✓ {syncMsg}
        </div>
      )}

      {/* 편집 폼 */}
      {editing && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-green-800 text-sm">TBM 기록 {exists ? '수정' : '작성'}</h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs text-gray-600 block mb-1">TBM 제목 *</label>
              <input
                className="w-full border rounded px-2 py-1.5 text-sm bg-card"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="예: 오전 TBM"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">실시 시각</label>
              <input
                type="datetime-local"
                className="w-full border rounded px-2 py-1.5 text-sm bg-card"
                value={form.conductedAt}
                onChange={(e) => setForm((f) => ({ ...f, conductedAt: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-600 block mb-1">참석 인원</label>
                <input
                  type="number" min={0}
                  className="w-full border rounded px-2 py-1.5 text-sm bg-card"
                  value={form.attendeeCount}
                  onChange={(e) => setForm((f) => ({ ...f, attendeeCount: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 block mb-1">미참석 인원</label>
                <input
                  type="number" min={0}
                  className="w-full border rounded px-2 py-1.5 text-sm bg-card"
                  value={form.absentCount}
                  onChange={(e) => setForm((f) => ({ ...f, absentCount: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-600 block mb-1">교육/전달 내용</label>
              <textarea
                rows={4}
                className="w-full border rounded px-2 py-1.5 text-sm bg-card"
                placeholder="오늘 TBM 전달사항, 위험요인 및 예방조치 내용을 입력하세요"
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-600 block mb-1">특이사항</label>
              <input
                className="w-full border rounded px-2 py-1.5 text-sm bg-card"
                placeholder="예: A팀 1명 지각으로 별도 전달"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="text-sm bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="text-sm border px-4 py-2 rounded text-gray-600 hover:bg-gray-50"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 기록 표시 */}
      {!editing && exists && record && (
        <div className="bg-card border rounded-xl p-5 space-y-4">
          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-gray-800">{record.title}</span>
              {record.conductedAt && (
                <span className="text-xs text-gray-500">⏰ {fmtTime(record.conductedAt)}</span>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-green-700 font-medium">참석 {record.attendeeCount}명</span>
              {record.absentCount > 0 && (
                <span className="text-red-600 font-medium">미참석 {record.absentCount}명</span>
              )}
            </div>
          </div>

          {/* 미참석 경고 */}
          {record.absentCount > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">
              ⚠ TBM 미참석 인원 {record.absentCount}명 — 출근자 현황 탭에서 확인 후 조치하세요.
            </div>
          )}

          {/* 내용 */}
          {record.content && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">교육/전달 내용</h4>
              <p className="text-sm text-gray-700 whitespace-pre-line bg-gray-50 rounded p-3">{record.content}</p>
            </div>
          )}

          {/* 특이사항 */}
          {record.notes && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">특이사항</h4>
              <p className="text-sm text-gray-600 whitespace-pre-line">{record.notes}</p>
            </div>
          )}

          {/* 작업일보 동기화 안내 */}
          <div className="text-xs text-blue-600 bg-blue-50 rounded px-3 py-1.5">
            저장 시 작업일보의 TBM 요약에 자동 반영됩니다.
          </div>
        </div>
      )}

      {/* 빈 상태 */}
      {!editing && !exists && (
        <div className="text-center text-gray-400 py-10 bg-card border rounded-xl">
          <p className="mb-3">이 날짜의 TBM 기록이 없습니다.</p>
          {!locked && (
            <button
              onClick={startEdit}
              className="text-sm bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              TBM 작성하기
            </button>
          )}
        </div>
      )}
    </div>
  )
}
