'use client'

import { useEffect, useState, useCallback } from 'react'

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface OpsSnapshot {
  worklogStatus: string | null
  presentCount: number
  tbmConducted: boolean
  tbmAbsentCount: number
  safetyIncident: boolean
  correctionNeeded: boolean
  correctionDone: boolean
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT:     '작성중',
  SUBMITTED: '검토 대기',
  RETURNED:  '반려됨',
  APPROVED:  '승인됨',
  LOCKED:    '확정',
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT:     'bg-gray-100 text-gray-600',
  SUBMITTED: 'bg-blue-100 text-blue-700',
  RETURNED:  'bg-red-100 text-red-700',
  APPROVED:  'bg-green-100 text-green-700',
  LOCKED:    'bg-purple-100 text-purple-700',
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export function DailyOpsCard({
  siteId,
  selectedDate,
  onStatusLoad,
  refreshKey,
}: {
  siteId: string
  selectedDate: string
  onStatusLoad?: (status: string | null) => void
  refreshKey?: number   // 부모가 증가시키면 재조회
}) {
  const [data, setData] = useState<OpsSnapshot | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [wlRes, tbmRes] = await Promise.all([
        fetch(`/api/admin/sites/${siteId}/worklogs?date=${selectedDate}`),
        fetch(`/api/admin/sites/${siteId}/tbm/${selectedDate}`),
      ])

      const wlData  = wlRes.ok  ? await wlRes.json()  : null
      const tbmData = tbmRes.ok ? await tbmRes.json() : null

      const wl      = wlData?.data?.workLog
      const summary = wl?.summary
      const tbmExist = tbmData?.data?.exists ?? false

      const snap: OpsSnapshot = {
        worklogStatus:    wl?.status                            ?? null,
        presentCount:     summary?.totalPresentCount            ?? 0,
        tbmConducted:     tbmExist || (summary?.tbmConducted   ?? false),
        tbmAbsentCount:   summary?.tbmAbsentCount               ?? 0,
        safetyIncident:   wl?.safetyIncidentOccurred            ?? false,
        correctionNeeded: wl?.safetyCorrectionNeeded            ?? false,
        correctionDone:   wl?.safetyCorrectionDone              ?? false,
      }
      setData(snap)
      onStatusLoad?.(snap.worklogStatus)
    } finally {
      setLoading(false)
    }
  }, [siteId, selectedDate, onStatusLoad])

  useEffect(() => { load() }, [load, refreshKey])

  if (loading) {
    return (
      <div className="bg-card border rounded-xl p-4 mb-4 flex items-center gap-3 text-gray-400 text-sm">
        <span className="animate-pulse">당일 운영 현황 로딩 중...</span>
      </div>
    )
  }

  const s = data

  return (
    <div className="bg-card border rounded-xl p-4 mb-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">

        {/* 작업일보 상태 */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-medium">작업일보</span>
          {s?.worklogStatus ? (
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_COLORS[s.worklogStatus] ?? 'bg-gray-100 text-gray-600'}`}>
              {STATUS_LABELS[s.worklogStatus] ?? s.worklogStatus}
            </span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-400">미작성</span>
          )}
        </div>

        <div className="h-4 w-px bg-gray-200" />

        {/* 출근 인원 */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">출근</span>
          <span className="text-sm font-bold text-gray-800">{s?.presentCount ?? 0}명</span>
        </div>

        <div className="h-4 w-px bg-gray-200" />

        {/* TBM */}
        <div className="flex items-center gap-1.5">
          {s?.tbmConducted ? (
            <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 font-medium">TBM 완료 ✓</span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700">TBM 미작성</span>
          )}
          {(s?.tbmAbsentCount ?? 0) > 0 && (
            <span className="text-xs text-red-600">미참석 {s!.tbmAbsentCount}명</span>
          )}
        </div>

        {/* 안전 이슈 뱃지 */}
        {s?.safetyIncident && (
          <>
            <div className="h-4 w-px bg-gray-200" />
            <span className="text-xs px-2 py-0.5 rounded bg-red-200 text-red-800 font-bold animate-pulse">
              ⚑ 사고/아차사고
            </span>
          </>
        )}
        {s?.correctionNeeded && !s.correctionDone && (
          <>
            <div className="h-4 w-px bg-gray-200" />
            <span className="text-xs px-2 py-0.5 rounded bg-orange-100 text-orange-700">시정 조치 필요</span>
          </>
        )}
        {s?.correctionDone && (
          <>
            <div className="h-4 w-px bg-gray-200" />
            <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">✓ 시정 완료</span>
          </>
        )}

        {/* LOCKED 전체 읽기전용 안내 */}
        {s?.worklogStatus === 'LOCKED' && (
          <>
            <div className="h-4 w-px bg-gray-200" />
            <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700 font-medium">
              🔒 마감 완료 — 전체 읽기 전용
            </span>
          </>
        )}
      </div>
    </div>
  )
}
