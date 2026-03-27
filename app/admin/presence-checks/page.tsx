'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

// ─── Types ──────────────────────────────────────────────────────────────────

interface Site { id: string; name: string }

interface PresenceItem {
  id: string
  workerId: string
  workerName: string
  workerCompany: string
  siteId: string
  siteName: string
  slot: 'AM' | 'PM'
  checkDate: string
  scheduledAt: string
  expiresAt: string | null
  status: string
  respondedAt: string | null
  distanceMeters: number | null
  accuracyMeters: number | null
  needsReview: boolean
  reviewReason: string | null
  adminNote: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  reissueCount: number
}

interface DetailItem extends PresenceItem {
  siteLat: number
  siteLng: number
  siteAddress: string
  responseLat: number | null
  responseLng: number | null
  allowedRadiusMeters: number
  workerPhone: string
  auditLogs: AuditLog[]
}

interface AuditLog {
  id: string
  action: string
  actorType: string
  actorNameSnapshot: string | null
  fromStatus: string | null
  toStatus: string | null
  message: string | null
  createdAt: string
}

interface Summary {
  total: number
  completed: number
  pending: number
  noResponse: number
  outOfFence: number
  review: number
  needsReview: number
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  PENDING:            '대기중',
  COMPLETED:          '완료',
  MISSED:             '미응답(구)',
  OUT_OF_GEOFENCE:    '위치이탈',
  LOW_ACCURACY:       '정확도부족',
  SKIPPED:            '건너뜀',
  NO_RESPONSE:        '미응답',
  REVIEW_REQUIRED:    '검토필요',
  CANCELED:           '취소',
  MANUALLY_CONFIRMED: '수동승인',
  MANUALLY_REJECTED:  '이탈확정',
}

const STATUS_COLOR: Record<string, string> = {
  PENDING:            '#1565c0',
  COMPLETED:          '#2e7d32',
  MISSED:             '#888',
  OUT_OF_GEOFENCE:    '#e65100',
  LOW_ACCURACY:       '#7b1fa2',
  SKIPPED:            '#aaa',
  NO_RESPONSE:        '#b71c1c',
  REVIEW_REQUIRED:    '#f57f17',
  CANCELED:           '#888',
  MANUALLY_CONFIRMED: '#2e7d32',
  MANUALLY_REJECTED:  '#b71c1c',
}

const ROW_BG: Record<string, string> = {
  REVIEW_REQUIRED:    '#fff8e1',
  NO_RESPONSE:        '#fafafa',
  MANUALLY_REJECTED:  '#fff3f3',
  MANUALLY_CONFIRMED: '#f1fff3',
}

const ACTION_LABEL: Record<string, string> = {
  CREATED:                       '생성',
  AUTO_EXPIRED:                  '자동 만료',
  WORKER_RESPONDED:              '근로자 응답',
  AUTO_CLASSIFIED_COMPLETED:     '자동 완료',
  AUTO_CLASSIFIED_OUT_OF_GEOFENCE: '자동 위치이탈',
  AUTO_CLASSIFIED_REVIEW_REQUIRED: '검토 분류',
  ADMIN_CONFIRMED:               '정상 승인',
  ADMIN_REJECTED:                '이탈 확정',
  ADMIN_REISSUED:                '재확인 요청',
  ADMIN_NOTE_UPDATED:            '메모 저장',
  CANCELED:                      '취소',
}

function URGENCY_ORDER(status: string): number {
  const order: Record<string, number> = {
    REVIEW_REQUIRED: 0, PENDING: 1, OUT_OF_GEOFENCE: 2, NO_RESPONSE: 3,
    MANUALLY_REJECTED: 4, MISSED: 5, COMPLETED: 6, MANUALLY_CONFIRMED: 7,
    CANCELED: 8, SKIPPED: 9, LOW_ACCURACY: 10,
  }
  return order[status] ?? 99
}

function todayKST() {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function PresenceChecksPage() {
  const router = useRouter()

  // filter state
  const [date,            setDate]            = useState(todayKST)
  const [statusFilter,    setStatusFilter]    = useState('')
  const [siteFilter,      setSiteFilter]      = useState('')
  const [workerSearch,    setWorkerSearch]    = useState('')
  const [onlyReview,      setOnlyReview]      = useState(false)
  const [onlyNoResponse,  setOnlyNoResponse]  = useState(false)

  // data state
  const [items,   setItems]   = useState<PresenceItem[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [sites,   setSites]   = useState<Site[]>([])
  const [loading, setLoading] = useState(true)

  // detail panel state
  const [selected,       setSelected]       = useState<DetailItem | null>(null)
  const [detailLoading,  setDetailLoading]  = useState(false)
  const [actionLoading,  setActionLoading]  = useState(false)

  // reissue form
  const [reissueMinutes, setReissueMinutes] = useState(10)
  const [reissueReason,  setReissueReason]  = useState('')

  // note form
  const [noteText, setNoteText] = useState('')

  // ── Fetch list ──────────────────────────────────────────────────────────
  const loadList = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ date })
    if (statusFilter)   params.set('status',          statusFilter)
    if (siteFilter)     params.set('siteId',          siteFilter)
    if (workerSearch)   params.set('workerName',      workerSearch)
    if (onlyReview)     params.set('onlyNeedsReview', 'true')
    if (onlyNoResponse) params.set('onlyNoResponse',  'true')

    fetch(`/api/admin/presence-checks?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) { router.push('/admin/login'); return }
        setItems(data.data.items ?? [])
        setSummary(data.data.summary ?? null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [date, statusFilter, siteFilter, workerSearch, onlyReview, onlyNoResponse, router])

  useEffect(() => { loadList() }, [loadList])

  // ── Fetch sites ─────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/admin/sites')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setSites(data.data?.items ?? data.data ?? [])
      })
  }, [])

  // ── Open detail panel ──────────────────────────────────────────────────
  const openDetail = useCallback(async (id: string) => {
    setDetailLoading(true)
    setSelected(null)
    setNoteText('')
    fetch(`/api/admin/presence-checks/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setSelected(data.data)
          setNoteText(data.data.adminNote ?? '')
        }
        setDetailLoading(false)
      })
      .catch(() => setDetailLoading(false))
  }, [])

  // ── Actions ─────────────────────────────────────────────────────────────
  const doConfirm = async () => {
    if (!selected) return
    setActionLoading(true)
    const r = await fetch(`/api/admin/presence-checks/${selected.id}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: noteText || undefined }),
    }).then((r) => r.json())
    setActionLoading(false)
    if (r.success) { loadList(); openDetail(selected.id) }
    else alert(`오류: ${r.error ?? '알 수 없음'}`)
  }

  const doReject = async () => {
    if (!selected) return
    const reason = prompt('이탈 확정 사유를 입력하세요')
    if (reason === null) return
    setActionLoading(true)
    const r = await fetch(`/api/admin/presence-checks/${selected.id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    }).then((r) => r.json())
    setActionLoading(false)
    if (r.success) { loadList(); openDetail(selected.id) }
    else alert(`오류: ${r.error ?? '알 수 없음'}`)
  }

  const doReissue = async () => {
    if (!selected) return
    setActionLoading(true)
    const r = await fetch(`/api/admin/presence-checks/${selected.id}/reissue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresInMinutes: reissueMinutes, reason: reissueReason || '재확인 요청' }),
    }).then((r) => r.json())
    setActionLoading(false)
    if (r.success) { loadList(); openDetail(selected.id) }
    else alert(`오류: ${r.error ?? '알 수 없음'}`)
  }

  const doSaveNote = async () => {
    if (!selected) return
    setActionLoading(true)
    const r = await fetch(`/api/admin/presence-checks/${selected.id}/note`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: noteText }),
    }).then((r) => r.json())
    setActionLoading(false)
    if (r.success) { loadList(); openDetail(selected.id) }
    else alert(`오류: ${r.error ?? '알 수 없음'}`)
  }

  // ── Helpers ─────────────────────────────────────────────────────────────
  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-'

  const fmtFull = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'

  const canConfirm  = selected?.status === 'REVIEW_REQUIRED'
  const canReject   = selected?.status === 'REVIEW_REQUIRED'
  const canReissue  = selected && ['REVIEW_REQUIRED', 'PENDING', 'OUT_OF_GEOFENCE', 'NO_RESPONSE'].includes(selected.status) && (selected.reissueCount ?? 0) < 2

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Main ── */}
      <div className="p-8 min-w-0" style={{ marginRight: selected ? 420 : 0, transition: 'margin-right 0.2s' }}>
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold mb-1 mt-0">체류확인 현황</h1>
            <p className="text-[14px] text-muted-brand m-0">GPS 체류확인 응답 내역 및 검토 처리</p>
          </div>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2 border border-[rgba(91,164,217,0.3)] rounded-lg text-[14px]" />
        </div>

        {/* 미처리 건 알림 */}
        {!loading && summary && (summary.review > 0 || summary.noResponse > 0) && (
          <div className="flex gap-2.5 flex-wrap mb-3 items-center">
            {summary.review > 0 && (
              <span className="px-[14px] py-1.5 rounded-[20px] text-[13px] font-semibold bg-[#fff8e1] text-[#f57f17] border border-[#ffcc80]">
                검토필요 {summary.review}건 — 즉시 처리 필요
              </span>
            )}
            {summary.noResponse > 0 && (
              <span className="px-[14px] py-1.5 rounded-[20px] text-[13px] font-semibold bg-[#fff3f3] text-[#b71c1c] border border-[#ef9a9a]">
                미응답 {summary.noResponse}건
              </span>
            )}
          </div>
        )}

        {/* Filter row */}
        <div className="flex gap-2.5 flex-wrap mb-4 items-center">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-[#E5E7EB] rounded-[8px] text-[13px] text-[#111827] bg-white focus:outline-none focus:border-[#F97316]">
            <option value="">전체 상태</option>
            {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}
            className="px-3 py-2 border border-[#E5E7EB] rounded-[8px] text-[13px] text-[#111827] bg-white focus:outline-none focus:border-[#F97316]">
            <option value="">전체 현장</option>
            {sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
          </select>
          <input
            type="text"
            placeholder="근로자 검색"
            value={workerSearch}
            onChange={(e) => setWorkerSearch(e.target.value)}
            className="px-3 py-2 border border-[#E5E7EB] rounded-[8px] text-[13px] text-[#111827] w-[140px] focus:outline-none focus:border-[#F97316] placeholder:text-[#9CA3AF]"
          />
          <label className="flex items-center text-[13px] cursor-pointer text-[#444] whitespace-nowrap">
            <input type="checkbox" checked={onlyReview} onChange={(e) => setOnlyReview(e.target.checked)} />
            &nbsp;검토필요만
          </label>
          <label className="flex items-center text-[13px] cursor-pointer text-[#444] whitespace-nowrap">
            <input type="checkbox" checked={onlyNoResponse} onChange={(e) => setOnlyNoResponse(e.target.checked)} />
            &nbsp;미응답만
          </label>
        </div>

        {/* Summary cards */}
        {summary && (
          <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
            {[
              { label: '전체',     value: summary.total,       color: '#37474f' },
              { label: '완료',     value: summary.completed,   color: '#2e7d32' },
              { label: '대기중',   value: summary.pending,     color: '#4A93C8' },
              { label: '미응답',   value: summary.noResponse,  color: '#b71c1c' },
              { label: '위치이탈', value: summary.outOfFence,  color: '#e65100' },
              { label: '검토필요', value: summary.review,      color: '#f57f17' },
            ].map((c) => (
              <div key={c.label} className="bg-white rounded-[12px] p-[14px] shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                style={{ borderTop: `4px solid ${c.color}` }}>
                <div className="text-[26px] font-bold mb-0.5" style={{ color: c.color }}>{c.value}</div>
                <div className="text-[12px] text-muted-brand">{c.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-[12px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          <div className="text-[15px] font-bold mb-[14px] flex items-center gap-2.5">
            {date} 체류확인 목록
            {summary && summary.review > 0 && (
              <span className="bg-[#fff3e0] text-[#e65100] text-[12px] font-semibold px-[10px] py-[3px] rounded-xl border border-[#ffcc80]">
                {summary.review}건 검토필요
              </span>
            )}
          </div>
          {loading ? (
            <div className="text-center py-8 text-[#718096] text-[14px]">로딩 중...</div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-[#718096] text-[14px]">해당 조건에 맞는 기록이 없습니다.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {['이름', '현장', '구분', '예약', '만료', '응답', '거리(m)', 'GPS(m)', '상태', '메모'].map((h) => (
                      <th key={h} className="text-left px-[10px] py-[9px] text-[12px] text-muted-brand border-b-2 border-[rgba(91,164,217,0.2)] whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...items].sort((a, b) => URGENCY_ORDER(a.status) - URGENCY_ORDER(b.status)).map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => openDetail(item.id)}
                      style={{
                        background:   ROW_BG[item.status] ?? undefined,
                        cursor:       'pointer',
                        outline:      selected?.id === item.id ? '2px solid #1976d2' : undefined,
                        transition:   'background 0.1s',
                      }}
                    >
                      <td className="px-[10px] py-[10px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap">
                        <div className="font-semibold">{item.workerName}</div>
                        <div className="text-[11px] text-[#999]">{item.workerCompany}</div>
                      </td>
                      <td className="px-[10px] py-[10px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap">{item.siteName}</td>
                      <td className="px-[10px] py-[10px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap">
                        <span style={{
                          padding: '2px 7px',
                          borderRadius: '10px',
                          fontSize: '12px',
                          fontWeight: 600,
                          background: item.slot === 'AM' ? '#e3f2fd' : '#fff3e0',
                          color:      item.slot === 'AM' ? '#1565c0' : '#e65100',
                        }}>
                          {item.slot === 'AM' ? '오전' : '오후'}
                        </span>
                      </td>
                      <td className="px-[10px] py-[10px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap">{fmt(item.scheduledAt)}</td>
                      <td className="px-[10px] py-[10px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap">{fmt(item.expiresAt)}</td>
                      <td className="px-[10px] py-[10px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap">{fmt(item.respondedAt)}</td>
                      <td className="px-[10px] py-[10px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap text-right">
                        {item.distanceMeters != null ? (
                          <span style={{ color: item.distanceMeters > 100 ? '#b71c1c' : undefined }}>
                            {Math.round(item.distanceMeters)}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-[10px] py-[10px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap text-right">
                        {item.accuracyMeters != null ? (
                          <span style={{ color: item.accuracyMeters >= 80 ? '#e65100' : undefined }}>
                            {item.accuracyMeters >= 80 && '⚠ '}{Math.round(item.accuracyMeters)}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-[10px] py-[10px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap">
                        <span style={{ color: STATUS_COLOR[item.status] ?? '#333', fontWeight: 600, fontSize: '13px' }}>
                          {STATUS_LABEL[item.status] ?? item.status}
                        </span>
                        {item.reissueCount > 0 && (
                          <span className="inline-block ml-1 bg-[#e8eaf6] text-[#3949ab] text-[11px] px-1.5 py-[1px] rounded-lg">
                            재{item.reissueCount}
                          </span>
                        )}
                      </td>
                      <td className="px-[10px] py-[10px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap">
                        {item.adminNote && (
                          <span className="inline-block mr-1 bg-[rgba(244,121,32,0.12)] text-accent text-[11px] px-1.5 py-[1px] rounded-lg">
                            메모
                          </span>
                        )}
                        {item.needsReview && item.status === 'REVIEW_REQUIRED' && (
                          <span className="inline-block bg-[#fce4ec] text-[#c62828] text-[11px] px-1.5 py-[1px] rounded-lg font-semibold">
                            검토
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Detail Panel ── */}
      {(selected || detailLoading) && (
        <aside className="fixed right-0 top-0 w-[420px] h-screen bg-white border-l border-[#e0e0e0] shadow-[-4px_0_20px_rgba(0,0,0,0.08)] flex flex-col z-[100] overflow-hidden">
          <div className="flex justify-between items-center px-5 py-4 border-b border-[#f0f0f0] flex-shrink-0">
            <span className="text-base font-bold">체류확인 상세</span>
            <button onClick={() => setSelected(null)}
              className="bg-transparent border-none cursor-pointer text-[18px] text-muted-brand px-2 py-1">
              ✕
            </button>
          </div>

          {detailLoading && <div className="text-center py-8 text-[#718096] text-[14px]">로딩 중...</div>}

          {selected && !detailLoading && (
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {/* Status */}
              <div className="flex items-center gap-2.5 mb-4">
                <span style={{
                  padding: '4px 12px',
                  borderRadius: '16px',
                  fontSize: '13px',
                  fontWeight: 700,
                  background: STATUS_COLOR[selected.status] + '22',
                  color:      STATUS_COLOR[selected.status] ?? '#333',
                  border:     `1px solid ${STATUS_COLOR[selected.status] ?? '#ccc'}`,
                }}>
                  {STATUS_LABEL[selected.status] ?? selected.status}
                </span>
                <span className="text-[12px] text-muted-brand">
                  {selected.slot === 'AM' ? '오전' : '오후'} · {selected.checkDate}
                </span>
              </div>

              {/* Worker / Site */}
              <Section title="근로자 / 현장">
                <Row label="이름" value={selected.workerName} />
                <Row label="회사" value={selected.workerCompany} />
                <Row label="전화" value={selected.workerPhone} />
                <Row label="현장" value={selected.siteName} />
                <Row label="주소" value={selected.siteAddress} />
              </Section>

              {/* Times */}
              <Section title="시간 정보">
                <Row label="예약시각" value={fmtFull(selected.scheduledAt)} />
                <Row label="만료시각" value={fmtFull(selected.expiresAt)} />
                <Row label="응답시각" value={fmtFull(selected.respondedAt)} />
              </Section>

              {/* Location */}
              <Section title="위치 정보">
                <Row label="현장 좌표" value={`${selected.siteLat.toFixed(5)}, ${selected.siteLng.toFixed(5)}`} />
                <Row label="응답 좌표" value={
                  selected.responseLat != null
                    ? `${selected.responseLat.toFixed(5)}, ${selected.responseLng!.toFixed(5)}`
                    : '-'
                } />
                <Row label="GPS 정확도" value={
                  selected.accuracyMeters != null
                    ? <span style={{ color: selected.accuracyMeters >= 80 ? '#e65100' : undefined }}>
                        {Math.round(selected.accuracyMeters)}m{selected.accuracyMeters >= 80 ? ' ⚠' : ''}
                      </span>
                    : '-'
                } />
                <Row label="계산 거리" value={
                  selected.distanceMeters != null ? `${Math.round(selected.distanceMeters)}m` : '-'
                } />
                <Row label="허용 반경" value={`${selected.allowedRadiusMeters}m`} />
              </Section>

              {/* Review */}
              {(selected.reviewReason || selected.reviewedBy) && (
                <Section title="검토 정보">
                  {selected.reviewReason && <Row label="검토 사유" value={selected.reviewReason} />}
                  {selected.reviewedBy   && <Row label="판정자"   value={selected.reviewedBy} />}
                  {selected.reviewedAt   && <Row label="판정시각" value={fmtFull(selected.reviewedAt)} />}
                  {selected.reissueCount > 0 && <Row label="재확인 횟수" value={`${selected.reissueCount}회`} />}
                </Section>
              )}

              {/* Actions */}
              {(canConfirm || canReject || canReissue) && (
                <Section title="관리자 판정">
                  <div className="flex gap-2 mb-2.5">
                    {canConfirm && (
                      <button
                        onClick={doConfirm}
                        disabled={actionLoading}
                        className="px-4 py-2 border-none rounded-md cursor-pointer text-[13px] font-semibold mb-1.5 text-white"
                        style={{ background: '#2e7d32' }}
                      >
                        정상 승인
                      </button>
                    )}
                    {canReject && (
                      <button
                        onClick={doReject}
                        disabled={actionLoading}
                        className="px-4 py-2 border-none rounded-md cursor-pointer text-[13px] font-semibold mb-1.5 text-white"
                        style={{ background: '#b71c1c' }}
                      >
                        이탈 확정
                      </button>
                    )}
                  </div>
                  {canReissue && (
                    <div className="bg-brand rounded-lg p-2.5 mt-1.5">
                      <div className="text-[12px] text-muted-brand mb-2">재확인 요청 (최대 2회)</div>
                      <div className="flex gap-1.5 items-center">
                        <input
                          type="number"
                          min={2}
                          max={60}
                          value={reissueMinutes}
                          onChange={(e) => setReissueMinutes(Number(e.target.value))}
                          className="px-2 py-1.5 border border-[rgba(91,164,217,0.3)] rounded-[5px] text-[13px] w-[60px]"
                        />
                        <span className="text-[13px] text-muted-brand">분</span>
                        <input
                          type="text"
                          placeholder="사유 (선택)"
                          value={reissueReason}
                          onChange={(e) => setReissueReason(e.target.value)}
                          className="px-2 py-1.5 border border-[rgba(91,164,217,0.3)] rounded-[5px] text-[13px] flex-1"
                        />
                        <button
                          onClick={doReissue}
                          disabled={actionLoading}
                          className="px-4 py-2 border-none rounded-md cursor-pointer text-[13px] font-semibold text-white"
                          style={{ background: '#E06810' }}
                        >
                          요청
                        </button>
                      </div>
                    </div>
                  )}
                </Section>
              )}

              {/* Admin note */}
              <Section title="관리자 메모">
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  rows={3}
                  placeholder="운영 판단 근거, 현장소장 확인 내용 등"
                  className="w-full px-2 py-2 border border-[rgba(91,164,217,0.3)] rounded-md text-[13px] resize-y font-[inherit] box-border block mb-1.5"
                />
                <button
                  onClick={doSaveNote}
                  disabled={actionLoading}
                  className="px-4 py-2 border-none rounded-md cursor-pointer text-[13px] font-semibold mb-1.5 text-white"
                  style={{ background: '#546e7a' }}
                >
                  메모 저장
                </button>
              </Section>

              {/* Audit log */}
              {selected.auditLogs.length > 0 && (
                <Section title="이력">
                  {selected.auditLogs.map((log) => (
                    <div key={log.id} className="py-2 border-b border-[#f0f0f0] text-[12px]">
                      <div className="flex justify-between mb-0.5">
                        <span className="font-semibold text-[#CBD5E0]">{ACTION_LABEL[log.action] ?? log.action}</span>
                        <span className="text-[#aaa]">{fmtFull(log.createdAt)}</span>
                      </div>
                      {log.message && <div className="text-muted-brand">{log.message}</div>}
                      {log.actorNameSnapshot && (
                        <div className="text-muted-brand text-[11px]">{log.actorType === 'ADMIN' ? '관리자' : log.actorType}: {log.actorNameSnapshot}</div>
                      )}
                    </div>
                  ))}
                </Section>
              )}
            </div>
          )}
        </aside>
      )}
    </>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-[11px] font-bold text-muted-brand uppercase tracking-[0.8px] mb-2">
        {title}
      </div>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between py-[5px] border-b border-[#f0f0f0] text-[13px]">
      <span className="text-muted-brand flex-shrink-0 mr-2">{label}</span>
      <span className="font-medium text-right break-all">{value ?? '-'}</span>
    </div>
  )
}
