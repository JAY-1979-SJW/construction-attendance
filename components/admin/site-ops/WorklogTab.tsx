'use client'

import { useState, useEffect, useCallback } from 'react'

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface SiteWorkLog {
  id: string
  workDate: string
  status: string
  writtenById: string
  reviewedById: string | null
  approvedById: string | null
  createdAt: string
  updatedAt: string
  summaryText: string | null
  majorWorkText: string | null
  issueText: string | null
  tbmSummaryText: string | null
  safetySummaryText: string | null
  safetyHazardText: string | null
  safetyActionText: string | null
  safetyIncidentOccurred: boolean
  safetyCorrectionNeeded: boolean
  safetyCorrectionDone: boolean
  inspectionSummaryText: string | null
  materialSummaryText: string | null
  memoInternal: string | null
  summary: WorkLogSummary | null
}

interface WorkLogSummary {
  totalPresentCount: number
  directWorkerCount: number
  subcontractWorkerCount: number
  teamCount: number
  tbmConducted: boolean
  tbmAttendedCount: number
  tbmAbsentCount: number
  safetyIssueCount: number
  issueCount: number
  inspectionPlannedCount: number
  inspectionDoneCount: number
  materialDeliveryPlannedCount: number
  materialDeliveryDoneCount: number
  photoCount: number
}

interface TbmRecord {
  id: string
  title: string
  content: string | null
  conductedAt: string | null
  attendeeCount: number
  absentCount: number
  notes: string | null
}

interface WorkLogListItem {
  id: string
  workDate: string
  status: string
  summaryText: string | null
  majorWorkText: string | null
  safetyIncidentOccurred: boolean
  safetyCorrectionNeeded: boolean
  safetyCorrectionDone: boolean
  summary: WorkLogSummary | null
}

// ─── 상수 ─────────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  DRAFT:     '작성중',
  SUBMITTED: '제출됨',
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

const EMPTY_FORM = {
  summaryText: '', majorWorkText: '', issueText: '',
  tbmSummaryText: '',
  safetySummaryText: '', safetyHazardText: '', safetyActionText: '',
  safetyIncidentOccurred: false, safetyCorrectionNeeded: false, safetyCorrectionDone: false,
  inspectionSummaryText: '', materialSummaryText: '',
  memoInternal: '', status: 'DRAFT',
}

function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
}

function fmtTime(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

// ─── 경고 배너 ────────────────────────────────────────────────────────────────

function WarningBanner({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null
  return (
    <div className="bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 mb-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-amber-600 font-semibold text-sm">⚠ 주의사항</span>
      </div>
      <ul className="space-y-0.5">
        {warnings.map((w, i) => (
          <li key={i} className="text-sm text-amber-700">• {w}</li>
        ))}
      </ul>
    </div>
  )
}

// ─── 요약 카드 ────────────────────────────────────────────────────────────────

function SummaryCard({ log, manpowerStats }: { log: SiteWorkLog; manpowerStats?: { yesterday: number; today: number; monthlyCumulative: number; totalCumulative: number } | null }) {
  const s = log.summary
  if (!s) return null
  return (
    <div className="bg-card border rounded-xl p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-600 mb-3">당일 현황 요약</h3>
      {/* 인원 */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        {[
          { label: '총 출근', value: s.totalPresentCount,      color: 'bg-slate-50'  },
          { label: '직영',    value: s.directWorkerCount,      color: 'bg-blue-50'   },
          { label: '외주',    value: s.subcontractWorkerCount, color: 'bg-indigo-50' },
          { label: '팀 수',   value: s.teamCount,              color: 'bg-slate-50'  },
        ].map(({ label, value, color }) => (
          <div key={label} className={`${color} rounded-lg p-3 text-center`}>
            <div className="text-2xl font-bold text-gray-800">{value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>
      {/* 인원 누계 */}
      {manpowerStats && (
        <div className="grid grid-cols-4 gap-2 mb-3">
          {[
            { label: '전일 인원', value: manpowerStats.yesterday },
            { label: '오늘 인원', value: manpowerStats.today },
            { label: '월 누계',   value: manpowerStats.monthlyCumulative },
            { label: '총 누계',   value: manpowerStats.totalCumulative },
          ].map(({ label, value }) => (
            <div key={label} className="bg-amber-50 rounded-lg p-2.5 text-center border border-amber-100">
              <div className="text-lg font-bold text-amber-800">{value.toLocaleString()}</div>
              <div className="text-[11px] text-amber-600 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      )}
      {/* TBM */}
      <div className={`rounded-lg p-3 mb-3 flex items-center justify-between ${s.tbmConducted ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>

        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${s.tbmConducted ? 'text-green-700' : 'text-red-600'}`}>
            TBM {s.tbmConducted ? '실시 ✓' : '미실시 ✗'}
          </span>
        </div>
        {s.tbmConducted && (
          <div className="text-xs text-gray-600">
            참석 <span className="font-semibold text-green-700">{s.tbmAttendedCount}</span>명
            {s.tbmAbsentCount > 0 && (
              <span className="ml-2 text-red-600">미참석 {s.tbmAbsentCount}명</span>
            )}
          </div>
        )}
      </div>
      {/* 안전 */}
      {(log.safetyIncidentOccurred || log.safetyCorrectionNeeded || s.safetyIssueCount > 0) && (
        <div className="rounded-lg p-3 bg-red-50 border border-red-200 text-sm">
          <span className="font-semibold text-red-700">⚑ 안전 특이사항</span>
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-red-600">
            {log.safetyIncidentOccurred && <span className="bg-red-100 px-2 py-0.5 rounded">사고/아차사고 발생</span>}
            {log.safetyCorrectionNeeded && !log.safetyCorrectionDone && <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded">시정 조치 필요</span>}
            {log.safetyCorrectionDone   && <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded">시정 완료</span>}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 작업일보 목록 아이템 ─────────────────────────────────────────────────────

function WorklogListItem({
  item,
  onSelect,
}: {
  item: WorkLogListItem
  onSelect: (date: string) => void
}) {
  const s = item.summary
  return (
    <button
      onClick={() => onSelect(item.workDate.slice(0, 10))}
      className="w-full text-left bg-card border rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-800 text-sm">{fmtDate(item.workDate)}</span>
          <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[item.status] ?? ''}`}>
            {STATUS_LABELS[item.status] ?? item.status}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {s && <span>출근 {s.totalPresentCount}명</span>}
          {s?.tbmConducted ? (
            <span className="text-green-600">TBM ✓</span>
          ) : (
            <span className="text-red-500">TBM ✗</span>
          )}
          {item.safetyIncidentOccurred && <span className="text-red-600 font-medium">⚑ 사고</span>}
          {item.safetyCorrectionNeeded && !item.safetyCorrectionDone && (
            <span className="text-orange-500">시정 필요</span>
          )}
        </div>
      </div>
      {item.summaryText && (
        <p className="text-xs text-gray-500 line-clamp-2">{item.summaryText}</p>
      )}
    </button>
  )
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export function WorklogTab({ siteId, selectedDate, onDateChange, onStatusChange }: {
  siteId: string
  selectedDate: string
  onDateChange?: (d: string) => void
  onStatusChange?: (status: string | null) => void
}) {
  const setSelectedDate = (d: string) => onDateChange?.(d)
  const [view, setView] = useState<'list' | 'detail'>('list')

  // 목록
  const [wlList, setWlList] = useState<WorkLogListItem[]>([])
  const [listLoading, setLL] = useState(false)

  // 상세
  const [workLog, setWorkLog]   = useState<SiteWorkLog | null>(null)
  const [tbmList, setTbmList]   = useState<TbmRecord[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [manpower, setManpower] = useState<{ yesterday: number; today: number; monthlyCumulative: number; totalCumulative: number } | null>(null)
  const [detailLoading, setDL]  = useState(false)

  // 편집
  const [editing, setEditing]   = useState(false)
  const [form, setForm]         = useState({ ...EMPTY_FORM })

  // TBM 입력 폼
  const [tbmForm, setTbmForm]         = useState({ title: '', content: '', conductedAt: '', attendeeCount: 0, absentCount: 0, notes: '' })
  const [showTbmForm, setShowTbmForm] = useState(false)

  // 반려 모달
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectNote, setRejectNote]           = useState('')

  // ── 데이터 로드 ───────────────────────────────────────────────

  const loadList = useCallback(async () => {
    setLL(true)
    try {
      const res = await fetch(`/api/admin/sites/${siteId}/worklogs?limit=60`)
      if (res.ok) {
        const data = await res.json()
        setWlList(data.data?.workLogs ?? [])
      }
    } finally { setLL(false) }
  }, [siteId])

  const loadDetail = useCallback(async (date: string) => {
    setDL(true)
    setWorkLog(null); setTbmList([]); setWarnings([]); setManpower(null)
    try {
      const res = await fetch(`/api/admin/sites/${siteId}/worklogs?date=${date}`)
      if (res.ok) {
        const data = await res.json()
        const wl = data.data?.workLog ?? null
        setWorkLog(wl)
        setTbmList(data.data?.tbmRecords ?? [])
        setWarnings(data.data?.warnings ?? [])
        setManpower(data.data?.manpowerStats ?? null)
        onStatusChange?.(wl?.status ?? null)
      } else {
        onStatusChange?.(null)
      }
    } finally { setDL(false) }
  }, [siteId, onStatusChange])

  useEffect(() => { loadList() }, [loadList])

  const openDetail = (date: string) => {
    setSelectedDate(date)
    setView('detail')
    loadDetail(date)
  }

  const openNew = () => {
    setSelectedDate(new Date().toISOString().slice(0, 10))
    setView('detail')
    setWorkLog(null)
    setEditing(true)
    setForm({ ...EMPTY_FORM })
  }

  // ── 저장/제출/승인/반려 ───────────────────────────────────────

  const saveForm = async () => {
    const payload = {
      workDate: selectedDate,
      ...form,
      inspectionSummaryText: form.inspectionSummaryText || null,
      materialSummaryText:   form.materialSummaryText   || null,
    }
    const res = await fetch(`/api/admin/sites/${siteId}/worklogs`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })
    if (res.ok) {
      const data = await res.json()
      setWorkLog(data.data?.workLog ?? null)
      setTbmList(data.data?.tbmRecords ?? [])
      setWarnings(data.data?.warnings ?? [])
      setEditing(false)
      loadList()
    } else {
      const d = await res.json()
      alert(d.message ?? '저장 실패')
    }
  }

  const doAction = async (action: string, note?: string) => {
    const res = await fetch(`/api/admin/sites/${siteId}/worklogs/${selectedDate}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action, note }),
    })
    if (res.ok) {
      const data = await res.json()
      const wl = data.data?.workLog ?? null
      setWorkLog(wl)
      onStatusChange?.(wl?.status ?? null)
      loadList()
    } else {
      const d = await res.json()
      alert(d.message ?? '상태 변경 실패')
    }
  }

  const openEdit = () => {
    if (!workLog) return
    setForm({
      summaryText:          workLog.summaryText          ?? '',
      majorWorkText:        workLog.majorWorkText        ?? '',
      issueText:            workLog.issueText            ?? '',
      tbmSummaryText:       workLog.tbmSummaryText       ?? '',
      safetySummaryText:    workLog.safetySummaryText    ?? '',
      safetyHazardText:     workLog.safetyHazardText     ?? '',
      safetyActionText:     workLog.safetyActionText     ?? '',
      safetyIncidentOccurred: workLog.safetyIncidentOccurred,
      safetyCorrectionNeeded: workLog.safetyCorrectionNeeded,
      safetyCorrectionDone:   workLog.safetyCorrectionDone,
      inspectionSummaryText: workLog.inspectionSummaryText ?? '',
      materialSummaryText:  workLog.materialSummaryText  ?? '',
      memoInternal:         workLog.memoInternal         ?? '',
      status:               workLog.status,
    })
    setEditing(true)
  }

  const submitTbm = async () => {
    const body = {
      title:         tbmForm.title,
      content:       tbmForm.content || null,
      conductedAt:   tbmForm.conductedAt || null,
      attendeeCount: tbmForm.attendeeCount,
      absentCount:   tbmForm.absentCount,
      notes:         tbmForm.notes || null,
    }
    const res = await fetch(`/api/admin/sites/${siteId}/tbm/${selectedDate}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })
    if (res.ok) {
      setShowTbmForm(false)
      setTbmForm({ title: '', content: '', conductedAt: '', attendeeCount: 0, absentCount: 0, notes: '' })
      loadDetail(selectedDate)
    } else {
      const d = await res.json()
      alert(d.message ?? 'TBM 등록 실패')
    }
  }

  // ── 렌더 ─────────────────────────────────────────────────────

  if (view === 'list') {
    return (
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-gray-700">작업일보 목록</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => openDetail(selectedDate)}
              className="text-sm border border-blue-500 text-blue-600 px-3 py-1.5 rounded hover:bg-blue-50"
            >
              날짜 조회
            </button>
            <button
              onClick={openNew}
              className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"
            >
              + 작성
            </button>
          </div>
        </div>

        {listLoading ? (
          <div className="text-center text-gray-400 py-10">불러오는 중...</div>
        ) : wlList.length === 0 ? (
          <div className="text-center text-gray-400 py-10">
            <p className="mb-3">아직 작성된 작업일보가 없습니다.</p>
            <button
              onClick={openNew}
              className="text-sm bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              첫 작업일보 작성
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {wlList.map((item) => (
              <WorklogListItem key={item.id} item={item} onSelect={openDetail} />
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── 상세 뷰 ───────────────────────────────────────────────────

  return (
    <div>
      {/* 상세 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setView('list'); setEditing(false) }}
            className="text-gray-400 hover:text-gray-600 text-sm"
          >
            ← 목록
          </button>
          <h2 className="font-semibold text-gray-700">{fmtDate(selectedDate)} 작업일보</h2>
          {workLog && (
            <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[workLog.status] ?? ''}`}>
              {STATUS_LABELS[workLog.status] ?? workLog.status}
            </span>
          )}
        </div>
        {/* 액션 버튼 */}
        <div className="flex items-center gap-2">
          {!editing && (
            <>
              {/* 작성/수정 — DRAFT·RETURNED 상태에서만 */}
              {(!workLog || workLog.status === 'DRAFT' || workLog.status === 'RETURNED') && (
                <button
                  onClick={() => { if (workLog) openEdit(); else { setForm({ ...EMPTY_FORM }); setEditing(true) } }}
                  className="text-sm border border-gray-300 px-3 py-1.5 rounded text-gray-600 hover:bg-gray-50"
                >
                  {workLog ? '수정' : '+ 작성'}
                </button>
              )}
              {/* 제출 — DRAFT 또는 RETURNED 상태 */}
              {(workLog?.status === 'DRAFT' || workLog?.status === 'RETURNED') && (
                <button
                  onClick={() => doAction('submit')}
                  className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"
                >
                  제출
                </button>
              )}
              {/* 반려 / 승인 — SUBMITTED 상태 */}
              {workLog?.status === 'SUBMITTED' && (
                <>
                  <button
                    onClick={() => setShowRejectModal(true)}
                    className="text-sm border border-red-400 text-red-600 px-3 py-1.5 rounded hover:bg-red-50"
                  >
                    반려
                  </button>
                  <button
                    onClick={() => { if (confirm('이 작업일보를 승인하시겠습니까?')) doAction('approve') }}
                    className="text-sm bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700"
                  >
                    승인
                  </button>
                </>
              )}
              {/* 재작성 / 잠금 — APPROVED 상태 */}
              {workLog?.status === 'APPROVED' && (
                <>
                  <button
                    onClick={() => doAction('reopen')}
                    className="text-sm border border-gray-300 text-gray-500 px-3 py-1.5 rounded hover:bg-gray-50"
                  >
                    재작성
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('잠금 처리 시 수정이 불가합니다. 계속하시겠습니까?')) doAction('lock')
                    }}
                    className="text-sm bg-purple-600 text-white px-3 py-1.5 rounded hover:bg-purple-700"
                  >
                    잠금
                  </button>
                </>
              )}
              {/* 잠금 해제 — LOCKED 상태 (SUPER_ADMIN만 서버에서 허용) */}
              {workLog?.status === 'LOCKED' && (
                <button
                  onClick={() => { if (confirm('잠금을 해제하시겠습니까? (권한 필요)')) doAction('reopen') }}
                  className="text-sm border border-purple-400 text-purple-600 px-3 py-1.5 rounded hover:bg-purple-50"
                >
                  잠금 해제
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* 경고 배너 */}
      <WarningBanner warnings={warnings} />

      {/* 편집 폼 */}
      {editing && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6 space-y-4">
          <h3 className="font-semibold text-amber-800 text-sm mb-2">작업일보 {workLog ? '수정' : '작성'}</h3>

          {/* 운영 요약 */}
          <fieldset className="border rounded-lg p-4 space-y-3">
            <legend className="text-xs font-semibold text-gray-500 px-1">운영 요약</legend>
            {[
              { key: 'summaryText',   label: '당일 운영 요약', placeholder: '오늘 전반적인 현장 운영 내용을 요약' },
              { key: 'majorWorkText', label: '팀별 주요 작업', placeholder: '예: 배관1팀 — 지하1층 소화배관 설치 4명\n전기1팀 — 3층 감지기 배선 정리 3명' },
              { key: 'issueText',     label: '특이사항 / 조정사항', placeholder: '우천으로 외부작업 일부 조정 등' },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="text-xs text-gray-600 block mb-1">{label}</label>
                <textarea rows={3} className="w-full border rounded px-2 py-1.5 text-sm bg-card"
                  placeholder={placeholder}
                  value={form[key as keyof typeof form] as string}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              </div>
            ))}
          </fieldset>

          {/* TBM 요약 */}
          <fieldset className="border border-green-200 rounded-lg p-4 space-y-3 bg-green-50">
            <legend className="text-xs font-semibold text-green-700 px-1">TBM 요약</legend>
            <div>
              <label className="text-xs text-gray-600 block mb-1">TBM 결과 요약 (전달사항 포함)</label>
              <textarea rows={3} className="w-full border rounded px-2 py-1.5 text-sm bg-card"
                placeholder="예: 07:20 실시 완료 / 고소작업 구간 보호구 착용, 펌프실 출입 통제 전달"
                value={form.tbmSummaryText}
                onChange={(e) => setForm((f) => ({ ...f, tbmSummaryText: e.target.value }))}
              />
            </div>
          </fieldset>

          {/* 안전 */}
          <fieldset className="border border-red-200 rounded-lg p-4 space-y-3 bg-red-50">
            <legend className="text-xs font-semibold text-red-700 px-1">안전 사항</legend>
            {[
              { key: 'safetySummaryText', label: '안전 전달사항', placeholder: '당일 안전 교육 및 전달사항 요약' },
              { key: 'safetyHazardText',  label: '위험요소',      placeholder: '예: 고소작업 구간, 자재 적치 구간 혼잡' },
              { key: 'safetyActionText',  label: '조치사항',      placeholder: '예: 출입 통제, 적치 재정리, 안전망 설치' },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="text-xs text-gray-600 block mb-1">{label}</label>
                <textarea rows={2} className="w-full border rounded px-2 py-1.5 text-sm bg-card"
                  placeholder={placeholder}
                  value={form[key as keyof typeof form] as string}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              </div>
            ))}
            <div className="flex flex-wrap gap-4">
              {[
                { key: 'safetyIncidentOccurred', label: '사고/아차사고 발생' },
                { key: 'safetyCorrectionNeeded', label: '시정 조치 필요' },
                { key: 'safetyCorrectionDone',   label: '시정 완료' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form[key as keyof typeof form] as boolean}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          {/* 관리자 메모 */}
          <fieldset className="border border-dashed rounded-lg p-4">
            <legend className="text-xs font-semibold text-gray-400 px-1">🔒 관리자 메모 (비공개)</legend>
            <textarea rows={2} className="w-full border rounded px-2 py-1.5 text-sm bg-gray-50"
              placeholder="근로자에게 노출되지 않는 내부 메모"
              value={form.memoInternal}
              onChange={(e) => setForm((f) => ({ ...f, memoInternal: e.target.value }))}
            />
          </fieldset>

          <div className="flex gap-2">
            <button onClick={saveForm}
              className="text-sm bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
              저장
            </button>
            <button onClick={() => setEditing(false)}
              className="text-sm border px-4 py-2 rounded text-gray-600 hover:bg-gray-50">
              취소
            </button>
          </div>
        </div>
      )}

      {/* 반려 모달 */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-card rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="font-semibold text-gray-800 mb-3">반려 사유 입력</h3>
            <textarea
              rows={3}
              className="w-full border rounded px-3 py-2 text-sm mb-4"
              placeholder="반려 사유를 입력하세요 (선택 사항)"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowRejectModal(false); setRejectNote('') }}
                className="text-sm border px-4 py-2 rounded text-gray-600 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={() => {
                  doAction('reject', rejectNote || undefined)
                  setShowRejectModal(false)
                  setRejectNote('')
                }}
                className="text-sm bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
              >
                반려 확인
              </button>
            </div>
          </div>
        </div>
      )}

      {detailLoading && <div className="text-center text-gray-400 py-10">불러오는 중...</div>}

      {!detailLoading && !workLog && !editing && (
        <div className="text-center text-gray-400 py-10">
          <p className="mb-3">이 날짜의 작업일보가 없습니다.</p>
          <button
            onClick={() => { setForm({ ...EMPTY_FORM }); setEditing(true) }}
            className="text-sm bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            작성하기
          </button>
        </div>
      )}

      {workLog && !editing && (
        <div className="space-y-4">
          {/* 요약 카드 */}
          <SummaryCard log={workLog} manpowerStats={manpower} />

          {/* 작업 내용 */}
          {(workLog.summaryText || workLog.majorWorkText || workLog.issueText) && (
            <div className="bg-card border rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-gray-600">당일 작업 내용</h3>
              {workLog.summaryText && (
                <Section title="운영 요약" text={workLog.summaryText} />
              )}
              {workLog.majorWorkText && (
                <Section title="팀별 주요 작업" text={workLog.majorWorkText} />
              )}
              {workLog.issueText && (
                <Section title="특이사항" text={workLog.issueText} highlight />
              )}
            </div>
          )}

          {/* TBM 섹션 */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-green-800">TBM 기록</h3>
              <button
                onClick={() => setShowTbmForm((v) => !v)}
                className="text-xs text-green-700 border border-green-400 px-2 py-1 rounded hover:bg-green-100"
              >
                {showTbmForm ? '닫기' : '+ TBM 추가'}
              </button>
            </div>

            {workLog.tbmSummaryText && (
              <p className="text-sm text-gray-700 whitespace-pre-line mb-3 bg-card rounded p-3">
                {workLog.tbmSummaryText}
              </p>
            )}

            {/* TBM 입력 폼 */}
            {showTbmForm && (
              <div className="bg-card rounded-lg border p-4 mb-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs text-gray-600 block mb-1">TBM 제목</label>
                    <input className="w-full border rounded px-2 py-1.5 text-sm"
                      value={tbmForm.title}
                      onChange={(e) => setTbmForm((f) => ({ ...f, title: e.target.value }))}
                      placeholder="예: 오전 작업 TBM"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 block mb-1">실시 시각</label>
                    <input type="datetime-local" className="w-full border rounded px-2 py-1.5 text-sm"
                      value={tbmForm.conductedAt}
                      onChange={(e) => setTbmForm((f) => ({ ...f, conductedAt: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-600 block mb-1">참석</label>
                      <input type="number" min={0} className="w-full border rounded px-2 py-1.5 text-sm"
                        value={tbmForm.attendeeCount}
                        onChange={(e) => setTbmForm((f) => ({ ...f, attendeeCount: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 block mb-1">미참석</label>
                      <input type="number" min={0} className="w-full border rounded px-2 py-1.5 text-sm"
                        value={tbmForm.absentCount}
                        onChange={(e) => setTbmForm((f) => ({ ...f, absentCount: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-600 block mb-1">전달 내용</label>
                    <textarea rows={3} className="w-full border rounded px-2 py-1.5 text-sm"
                      value={tbmForm.content}
                      onChange={(e) => setTbmForm((f) => ({ ...f, content: e.target.value }))}
                      placeholder="오늘 TBM 전달사항을 입력하세요"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={submitTbm}
                    className="text-sm bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700">
                    등록
                  </button>
                  <button onClick={() => setShowTbmForm(false)}
                    className="text-sm border px-3 py-1.5 rounded text-gray-500">
                    취소
                  </button>
                </div>
              </div>
            )}

            {tbmList.length > 0 ? (
              <div className="space-y-3">
                {tbmList.map((t) => (
                  <div key={t.id} className="bg-card rounded-lg border p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-800 text-sm">{t.title}</span>
                      {t.conductedAt && (
                        <span className="text-xs text-gray-500">{fmtTime(t.conductedAt)}</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-600 mb-2">
                      참석 <strong className="text-green-700">{t.attendeeCount}</strong>명
                      {t.absentCount > 0 && (
                        <span className="ml-2 text-red-600">미참석 {t.absentCount}명</span>
                      )}
                    </div>
                    {t.content && (
                      <p className="text-sm text-gray-700 whitespace-pre-line">{t.content}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : !workLog.tbmSummaryText ? (
              <p className="text-sm text-gray-400">TBM 기록이 없습니다.</p>
            ) : null}
          </div>

          {/* 안전 섹션 */}
          {(workLog.safetySummaryText || workLog.safetyHazardText || workLog.safetyActionText || workLog.safetyIncidentOccurred || workLog.safetyCorrectionNeeded) && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-red-800 mb-3">안전 사항</h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {workLog.safetyIncidentOccurred && (
                  <span className="text-xs bg-red-200 text-red-800 px-3 py-1 rounded-full font-medium">
                    ⚑ 사고/아차사고 발생
                  </span>
                )}
                {workLog.safetyCorrectionNeeded && !workLog.safetyCorrectionDone && (
                  <span className="text-xs bg-orange-200 text-orange-800 px-3 py-1 rounded-full">
                    시정 조치 필요
                  </span>
                )}
                {workLog.safetyCorrectionDone && (
                  <span className="text-xs bg-green-200 text-green-800 px-3 py-1 rounded-full">
                    ✓ 시정 완료
                  </span>
                )}
              </div>
              <div className="space-y-3">
                {workLog.safetySummaryText && (
                  <Section title="안전 전달사항" text={workLog.safetySummaryText} />
                )}
                {workLog.safetyHazardText && (
                  <Section title="위험요소" text={workLog.safetyHazardText} highlight />
                )}
                {workLog.safetyActionText && (
                  <Section title="조치사항" text={workLog.safetyActionText} />
                )}
              </div>
            </div>
          )}

          {/* 관리자 메모 */}
          {workLog.memoInternal && (
            <div className="bg-card border border-dashed rounded-xl p-4">
              <h3 className="text-xs font-semibold text-gray-400 mb-2">🔒 관리자 메모 (비공개)</h3>
              <p className="text-sm text-gray-600 whitespace-pre-line">{workLog.memoInternal}</p>
            </div>
          )}

          {/* 이력 패널 */}
          <AuditTrail workLog={workLog} />
        </div>
      )}
    </div>
  )
}

// ─── 감사 이력 컴포넌트 ─────────────────────────────────────────────────────────

interface AuditWorkLog {
  status: string
  createdAt: string
  updatedAt: string
  writtenById: string
  reviewedById: string | null
  approvedById: string | null
  memoInternal: string | null
}

function AuditTrail({ workLog }: { workLog: AuditWorkLog }) {
  // memoInternal에서 [ACTION] note 패턴을 파싱해 이력 줄 추출
  const actionLines: { action: string; note: string }[] = []
  if (workLog.memoInternal) {
    workLog.memoInternal.split('\n').forEach((line) => {
      const m = line.match(/^\[([A-Z]+)\]\s*(.*)$/)
      if (m) actionLines.push({ action: m[1], note: m[2] })
    })
  }

  const ACTION_LABELS: Record<string, string> = {
    SUBMIT:  '제출',
    APPROVE: '승인',
    REJECT:  '반려',
    REOPEN:  '재작성',
    LOCK:    '잠금',
  }

  const STATUS_LABELS_HIST: Record<string, string> = {
    DRAFT:     '작성중',
    SUBMITTED: '검토 대기',
    RETURNED:  '반려됨',
    APPROVED:  '승인됨',
    LOCKED:    '확정',
  }

  return (
    <div className="bg-gray-50 border rounded-xl p-4">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">이력</h3>
      <ol className="relative border-l border-gray-200 space-y-3 ml-2">
        {/* 생성 */}
        <li className="ml-4">
          <span className="absolute -left-1.5 mt-1 h-2.5 w-2.5 rounded-full border border-white bg-gray-300" />
          <p className="text-xs text-gray-500">
            <span className="font-medium text-gray-700">생성</span>
            {' · '}
            {new Date(workLog.createdAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            {' · '}
            작성자 ID: {workLog.writtenById.slice(-6)}
          </p>
        </li>

        {/* 마지막 수정 (생성 시각과 다를 때만) */}
        {workLog.updatedAt !== workLog.createdAt && (
          <li className="ml-4">
            <span className="absolute -left-1.5 mt-1 h-2.5 w-2.5 rounded-full border border-white bg-gray-200" />
            <p className="text-xs text-gray-500">
              <span className="font-medium text-gray-700">마지막 수정</span>
              {' · '}
              {new Date(workLog.updatedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </li>
        )}

        {/* 메모에서 파싱된 액션 이력 */}
        {actionLines.map((a, i) => (
          <li key={i} className="ml-4">
            <span className={`absolute -left-1.5 mt-1 h-2.5 w-2.5 rounded-full border border-white ${
              a.action === 'APPROVE' ? 'bg-green-400' :
              a.action === 'REJECT'  ? 'bg-red-400'   :
              a.action === 'LOCK'    ? 'bg-purple-400' :
              'bg-blue-300'
            }`} />
            <p className="text-xs text-gray-600">
              <span className="font-medium text-gray-800">{ACTION_LABELS[a.action] ?? a.action}</span>
              {a.note && <span className="ml-1 text-gray-500">— {a.note}</span>}
            </p>
          </li>
        ))}

        {/* 현재 상태 */}
        <li className="ml-4">
          <span className="absolute -left-1.5 mt-1 h-2.5 w-2.5 rounded-full border border-white bg-blue-500" />
          <p className="text-xs text-gray-600">
            <span className="font-medium text-gray-800">현재 상태: </span>
            {STATUS_LABELS_HIST[workLog.status] ?? workLog.status}
            {workLog.approvedById && (
              <span className="ml-1 text-gray-500">· 승인자 ID: {workLog.approvedById.slice(-6)}</span>
            )}
            {workLog.reviewedById && !workLog.approvedById && (
              <span className="ml-1 text-gray-500">· 검토자 ID: {workLog.reviewedById.slice(-6)}</span>
            )}
          </p>
        </li>
      </ol>
    </div>
  )
}

// ─── 공통 섹션 컴포넌트 ────────────────────────────────────────────────────────

function Section({ title, text, highlight }: { title: string; text: string; highlight?: boolean }) {
  return (
    <div>
      <h4 className={`text-xs font-semibold uppercase tracking-wide mb-1 ${highlight ? 'text-red-500' : 'text-gray-400'}`}>
        {title}
      </h4>
      <p className="text-sm text-gray-700 whitespace-pre-line">{text}</p>
    </div>
  )
}
