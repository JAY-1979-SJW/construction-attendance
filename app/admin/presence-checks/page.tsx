'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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
        if (data.success) setSites(data.data ?? [])
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

  const handleLogout = () => {
    fetch('/api/admin/auth/logout', { method: 'POST' }).then(() => router.push('/admin/login'))
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
    <div style={s.layout}>
      {/* ── Sidebar ── */}
      <nav style={s.sidebar}>
        <div style={s.sidebarTitle}>해한 출퇴근</div>
        <div style={s.navSection}>관리</div>
        {[
          { href: '/admin',                label: '대시보드' },
          { href: '/admin/workers',         label: '근로자 관리' },
  { href: '/admin/companies', label: '회사 관리' },
          { href: '/admin/sites',           label: '현장 관리' },
          { href: '/admin/attendance',      label: '출퇴근 조회' },
          { href: '/admin/presence-checks', label: '체류확인 현황' },
          { href: '/admin/presence-report', label: '체류확인 리포트' },
          { href: '/admin/labor',           label: '투입현황/노임서류' },
          { href: '/admin/exceptions',      label: '예외 승인' },
          { href: '/admin/device-requests', label: '기기 변경' },
          { href: '/admin/settings',        label: '설정' },
        ].map((item) => (
          <Link key={item.href} href={item.href} style={{
            ...s.navItem,
            ...(item.href === '/admin/presence-checks' ? s.navActive : {}),
          }}>{item.label}</Link>
        ))}
        <button onClick={handleLogout} style={s.logoutBtn}>로그아웃</button>
      </nav>

      {/* ── Main ── */}
      <main style={{ ...s.main, marginRight: selected ? 420 : 0 }}>
        {/* Header */}
        <div style={s.header}>
          <div>
            <h1 style={s.pageTitle}>체류확인 현황</h1>
            <p style={s.subtitle}>GPS 체류확인 응답 내역 및 검토 처리</p>
          </div>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={s.datePicker} />
        </div>

        {/* 미처리 건 알림 */}
        {!loading && summary && (summary.review > 0 || summary.noResponse > 0) && (
          <div style={s.alertBar}>
            {summary.review > 0 && (
              <span style={{ ...s.alertChip, background: '#fff8e1', color: '#f57f17', border: '1px solid #ffcc80' }}>
                검토필요 {summary.review}건 — 즉시 처리 필요
              </span>
            )}
            {summary.noResponse > 0 && (
              <span style={{ ...s.alertChip, background: '#fff3f3', color: '#b71c1c', border: '1px solid #ef9a9a' }}>
                미응답 {summary.noResponse}건
              </span>
            )}
          </div>
        )}

        {/* Filter row */}
        <div style={s.filterRow}>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={s.select}>
            <option value="">전체 상태</option>
            {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)} style={s.select}>
            <option value="">전체 현장</option>
            {sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
          </select>
          <input
            type="text"
            placeholder="근로자 검색"
            value={workerSearch}
            onChange={(e) => setWorkerSearch(e.target.value)}
            style={s.searchInput}
          />
          <label style={s.toggle}>
            <input type="checkbox" checked={onlyReview} onChange={(e) => setOnlyReview(e.target.checked)} />
            &nbsp;검토필요만
          </label>
          <label style={s.toggle}>
            <input type="checkbox" checked={onlyNoResponse} onChange={(e) => setOnlyNoResponse(e.target.checked)} />
            &nbsp;미응답만
          </label>
        </div>

        {/* Summary cards */}
        {summary && (
          <div style={s.cards}>
            {[
              { label: '전체',     value: summary.total,       color: '#37474f' },
              { label: '완료',     value: summary.completed,   color: '#2e7d32' },
              { label: '대기중',   value: summary.pending,     color: '#4A93C8' },
              { label: '미응답',   value: summary.noResponse,  color: '#b71c1c' },
              { label: '위치이탈', value: summary.outOfFence,  color: '#e65100' },
              { label: '검토필요', value: summary.review,      color: '#f57f17' },
            ].map((c) => (
              <div key={c.label} style={{ ...s.card, borderTop: `4px solid ${c.color}` }}>
                <div style={{ ...s.cardVal, color: c.color }}>{c.value}</div>
                <div style={s.cardLabel}>{c.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Table */}
        <div style={s.tableCard}>
          <div style={s.tableTitle}>
            {date} 체류확인 목록
            {summary && summary.review > 0 && (
              <span style={s.reviewBadge}>{summary.review}건 검토필요</span>
            )}
          </div>
          {loading ? (
            <div style={s.empty}>로딩 중...</div>
          ) : items.length === 0 ? (
            <div style={s.empty}>해당 조건에 맞는 기록이 없습니다.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    {['이름', '현장', '구분', '예약', '만료', '응답', '거리(m)', 'GPS(m)', '상태', '메모'].map((h) => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...items].sort((a, b) => URGENCY_ORDER(a.status) - URGENCY_ORDER(b.status)).map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => openDetail(item.id)}
                      style={{
                        ...s.tr,
                        background:   ROW_BG[item.status] ?? undefined,
                        cursor:       'pointer',
                        outline:      selected?.id === item.id ? '2px solid #1976d2' : undefined,
                      }}
                    >
                      <td style={s.td}>
                        <div style={{ fontWeight: 600 }}>{item.workerName}</div>
                        <div style={{ fontSize: '11px', color: '#999' }}>{item.workerCompany}</div>
                      </td>
                      <td style={s.td}>{item.siteName}</td>
                      <td style={s.td}>
                        <span style={{
                          ...s.slotBadge,
                          background: item.slot === 'AM' ? '#e3f2fd' : '#fff3e0',
                          color:      item.slot === 'AM' ? '#1565c0' : '#e65100',
                        }}>
                          {item.slot === 'AM' ? '오전' : '오후'}
                        </span>
                      </td>
                      <td style={s.td}>{fmt(item.scheduledAt)}</td>
                      <td style={s.td}>{fmt(item.expiresAt)}</td>
                      <td style={s.td}>{fmt(item.respondedAt)}</td>
                      <td style={{ ...s.td, textAlign: 'right' as const }}>
                        {item.distanceMeters != null ? (
                          <span style={{ color: item.distanceMeters > 100 ? '#b71c1c' : undefined }}>
                            {Math.round(item.distanceMeters)}
                          </span>
                        ) : '-'}
                      </td>
                      <td style={{ ...s.td, textAlign: 'right' as const }}>
                        {item.accuracyMeters != null ? (
                          <span style={{ color: item.accuracyMeters >= 80 ? '#e65100' : undefined }}>
                            {item.accuracyMeters >= 80 && '⚠ '}{Math.round(item.accuracyMeters)}
                          </span>
                        ) : '-'}
                      </td>
                      <td style={s.td}>
                        <span style={{ color: STATUS_COLOR[item.status] ?? '#333', fontWeight: 600, fontSize: '13px' }}>
                          {STATUS_LABEL[item.status] ?? item.status}
                        </span>
                        {item.reissueCount > 0 && (
                          <span style={s.reissueTag}>재{item.reissueCount}</span>
                        )}
                      </td>
                      <td style={s.td}>
                        {item.adminNote && <span style={s.noteTag}>메모</span>}
                        {item.needsReview && item.status === 'REVIEW_REQUIRED' && (
                          <span style={s.reviewTag}>검토</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* ── Detail Panel ── */}
      {(selected || detailLoading) && (
        <aside style={s.panel}>
          <div style={s.panelHeader}>
            <span style={s.panelTitle}>체류확인 상세</span>
            <button onClick={() => setSelected(null)} style={s.closeBtn}>✕</button>
          </div>

          {detailLoading && <div style={s.empty}>로딩 중...</div>}

          {selected && !detailLoading && (
            <div style={s.panelBody}>
              {/* Status */}
              <div style={s.statusRow}>
                <span style={{
                  ...s.statusChip,
                  background: STATUS_COLOR[selected.status] + '22',
                  color:      STATUS_COLOR[selected.status] ?? '#333',
                  border:     `1px solid ${STATUS_COLOR[selected.status] ?? '#ccc'}`,
                }}>
                  {STATUS_LABEL[selected.status] ?? selected.status}
                </span>
                <span style={{ fontSize: '12px', color: '#A0AEC0' }}>
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

              {/* Actions — only for actionable statuses */}
              {(canConfirm || canReject || canReissue) && (
                <Section title="관리자 판정">
                  <div style={s.actionGroup}>
                    {canConfirm && (
                      <button
                        onClick={doConfirm}
                        disabled={actionLoading}
                        style={{ ...s.actionBtn, background: '#2e7d32', color: 'white' }}
                      >
                        정상 승인
                      </button>
                    )}
                    {canReject && (
                      <button
                        onClick={doReject}
                        disabled={actionLoading}
                        style={{ ...s.actionBtn, background: '#b71c1c', color: 'white' }}
                      >
                        이탈 확정
                      </button>
                    )}
                  </div>
                  {canReissue && (
                    <div style={s.reissueForm}>
                      <div style={s.reissueLabel}>재확인 요청 (최대 2회)</div>
                      <div style={s.reissueInputRow}>
                        <input
                          type="number"
                          min={2}
                          max={60}
                          value={reissueMinutes}
                          onChange={(e) => setReissueMinutes(Number(e.target.value))}
                          style={{ ...s.miniInput, width: '60px' }}
                        />
                        <span style={{ fontSize: '13px', color: '#666' }}>분</span>
                        <input
                          type="text"
                          placeholder="사유 (선택)"
                          value={reissueReason}
                          onChange={(e) => setReissueReason(e.target.value)}
                          style={{ ...s.miniInput, flex: 1 }}
                        />
                        <button
                          onClick={doReissue}
                          disabled={actionLoading}
                          style={{ ...s.actionBtn, background: '#E06810', color: 'white', margin: 0 }}
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
                  style={s.textarea}
                />
                <button
                  onClick={doSaveNote}
                  disabled={actionLoading}
                  style={{ ...s.actionBtn, background: '#546e7a', color: 'white' }}
                >
                  메모 저장
                </button>
              </Section>

              {/* Audit log */}
              {selected.auditLogs.length > 0 && (
                <Section title="이력">
                  {selected.auditLogs.map((log) => (
                    <div key={log.id} style={s.auditRow}>
                      <div style={s.auditMeta}>
                        <span style={s.auditAction}>{ACTION_LABEL[log.action] ?? log.action}</span>
                        <span style={s.auditTime}>{fmtFull(log.createdAt)}</span>
                      </div>
                      {log.message && <div style={s.auditMsg}>{log.message}</div>}
                      {log.actorNameSnapshot && (
                        <div style={s.auditActor}>{log.actorType === 'ADMIN' ? '관리자' : log.actorType}: {log.actorNameSnapshot}</div>
                      )}
                    </div>
                  ))}
                </Section>
              )}
            </div>
          )}
        </aside>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: '#A0AEC0', textTransform: 'uppercase' as const, letterSpacing: '0.8px', marginBottom: '8px' }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f0f0f0', fontSize: '13px' }}>
      <span style={{ color: '#A0AEC0', flexShrink: 0, marginRight: '8px' }}>{label}</span>
      <span style={{ fontWeight: 500, textAlign: 'right' as const, wordBreak: 'break-all' as const }}>{value ?? '-'}</span>
    </div>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  layout:       { display: 'flex', minHeight: '100vh', background: '#1B2838', position: 'relative' },
  sidebar:      { width: '220px', background: '#141E2A', padding: '24px 0', flexShrink: 0, display: 'flex', flexDirection: 'column' },
  sidebarTitle: { color: 'white', fontSize: '16px', fontWeight: 700, padding: '0 20px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)' },
  navSection:   { color: 'rgba(255,255,255,0.4)', fontSize: '11px', padding: '16px 20px 8px', textTransform: 'uppercase', letterSpacing: '1px' },
  navItem:      { display: 'block', color: 'rgba(255,255,255,0.8)', padding: '10px 20px', fontSize: '14px', textDecoration: 'none' },
  navActive:    { background: 'rgba(255,255,255,0.1)', color: 'white', borderLeft: '3px solid #4fc3f7' },
  logoutBtn:    { margin: '24px 20px 0', padding: '10px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '13px' },

  main:         { flex: 1, padding: '32px', transition: 'margin-right 0.2s', minWidth: 0 },
  header:       { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' },
  pageTitle:    { fontSize: '24px', fontWeight: 700, margin: '0 0 4px' },
  subtitle:     { fontSize: '14px', color: '#A0AEC0', margin: 0 },
  datePicker:   { padding: '8px 12px', border: '1px solid rgba(91,164,217,0.3)', borderRadius: '8px', fontSize: '14px' },

  alertBar:     { display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px', alignItems: 'center' },
  alertChip:    { padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 600 },
  filterRow:    { display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px', alignItems: 'center' },
  select:       { padding: '7px 10px', border: '1px solid rgba(91,164,217,0.3)', borderRadius: '6px', fontSize: '13px', background: '#1E3048', color: '#E2E8F0' },
  searchInput:  { padding: '7px 10px', border: '1px solid rgba(91,164,217,0.3)', borderRadius: '6px', fontSize: '13px', width: '140px' },
  toggle:       { display: 'flex', alignItems: 'center', fontSize: '13px', cursor: 'pointer', color: '#444', whiteSpace: 'nowrap' },

  cards:        { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '12px', marginBottom: '20px' },
  card:         { background: '#243144', borderRadius: '10px', padding: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.35)' },
  cardVal:      { fontSize: '26px', fontWeight: 700, marginBottom: '2px' },
  cardLabel:    { fontSize: '12px', color: '#A0AEC0' },

  tableCard:    { background: '#243144', borderRadius: '10px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.35)' },
  tableTitle:   { fontSize: '15px', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px' },
  reviewBadge:  { background: '#fff3e0', color: '#e65100', fontSize: '12px', fontWeight: 600, padding: '3px 10px', borderRadius: '12px', border: '1px solid #ffcc80' },
  table:        { width: '100%', borderCollapse: 'collapse' },
  th:           { textAlign: 'left', padding: '9px 10px', fontSize: '12px', color: '#A0AEC0', borderBottom: '2px solid rgba(91,164,217,0.2)', whiteSpace: 'nowrap' },
  td:           { padding: '10px', fontSize: '13px', borderBottom: '1px solid #f5f5f5', whiteSpace: 'nowrap' },
  tr:           { transition: 'background 0.1s' },
  slotBadge:    { padding: '2px 7px', borderRadius: '10px', fontSize: '12px', fontWeight: 600 },
  reissueTag:   { display: 'inline-block', marginLeft: '4px', background: '#e8eaf6', color: '#3949ab', fontSize: '11px', padding: '1px 5px', borderRadius: '8px' },
  noteTag:      { display: 'inline-block', marginRight: '4px', background: 'rgba(244,121,32,0.12)', color: '#F47920', fontSize: '11px', padding: '1px 5px', borderRadius: '8px' },
  reviewTag:    { display: 'inline-block', background: '#fce4ec', color: '#c62828', fontSize: '11px', padding: '1px 5px', borderRadius: '8px', fontWeight: 600 },
  empty:        { textAlign: 'center', padding: '32px', color: '#718096', fontSize: '14px' },

  // Detail panel
  panel:        { position: 'fixed', right: 0, top: 0, width: '420px', height: '100vh', background: 'white', borderLeft: '1px solid #e0e0e0', boxShadow: '-4px 0 20px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', zIndex: 100, overflow: 'hidden' },
  panelHeader:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #f0f0f0', flexShrink: 0 },
  panelTitle:   { fontSize: '16px', fontWeight: 700 },
  closeBtn:     { background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#666', padding: '4px 8px' },
  panelBody:    { flex: 1, overflowY: 'auto', padding: '16px 20px' },
  statusRow:    { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' },
  statusChip:   { padding: '4px 12px', borderRadius: '16px', fontSize: '13px', fontWeight: 700 },

  actionGroup:  { display: 'flex', gap: '8px', marginBottom: '10px' },
  actionBtn:    { padding: '8px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, margin: '0 0 6px' },

  reissueForm:       { background: '#f8f9fa', borderRadius: '8px', padding: '10px', marginTop: '6px' },
  reissueLabel:      { fontSize: '12px', color: '#666', marginBottom: '8px' },
  reissueInputRow:   { display: 'flex', gap: '6px', alignItems: 'center' },
  miniInput:         { padding: '6px 8px', border: '1px solid rgba(91,164,217,0.3)', borderRadius: '5px', fontSize: '13px' },

  textarea:     { width: '100%', padding: '8px', border: '1px solid rgba(91,164,217,0.3)', borderRadius: '6px', fontSize: '13px', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', display: 'block', marginBottom: '6px' },

  auditRow:    { padding: '8px 0', borderBottom: '1px solid #f0f0f0', fontSize: '12px' },
  auditMeta:   { display: 'flex', justifyContent: 'space-between', marginBottom: '2px' },
  auditAction: { fontWeight: 600, color: '#333' },
  auditTime:   { color: '#aaa' },
  auditMsg:    { color: '#555' },
  auditActor:  { color: '#A0AEC0', fontSize: '11px' },
}
