'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

// ─── 탭 정의 ──────────────────────────────────────────────────────────────────
type TabKey = 'workers' | 'companies' | 'ext-companies' | 'managers' | 'site-joins' | 'devices'

const TABS: { key: TabKey; label: string; api: string }[] = [
  { key: 'workers',       label: '작업자 가입',    api: '/api/admin/registrations' },
  { key: 'companies',     label: '업체 관리자 신청', api: '/api/admin/company-admin-requests' },
  { key: 'ext-companies', label: '외부회사 인증 대기', api: '/api/admin/companies?verificationStatus=PENDING_VERIFICATION' },
  { key: 'managers',      label: '업체 합류 신청',  api: '/api/admin/company-join-requests' },
  { key: 'site-joins',    label: '현장 참여 신청',  api: '/api/admin/site-join-requests' },
  { key: 'devices',       label: '기기 등록 신청',  api: '/api/admin/device-requests' },
]

// ─── 공통 타입 ────────────────────────────────────────────────────────────────
interface ApprovalItem {
  id: string
  displayName: string    // 요청자명 또는 업체명
  subName?: string       // 연락처, 이메일 등 부가 정보
  detail?: string        // 업체명, 현장명 등
  status: string
  requestedAt: string
  rejectReason?: string | null
}

// ─── 탭별 데이터 어댑터 ───────────────────────────────────────────────────────
function adaptItem(tab: TabKey, raw: Record<string, unknown>): ApprovalItem {
  switch (tab) {
    case 'workers':
      return {
        id: raw.id as string,
        displayName: raw.name as string,
        subName: raw.phone as string,
        detail: raw.jobTitle as string,
        status: raw.accountStatus as string,
        requestedAt: raw.createdAt as string,
        rejectReason: raw.rejectReason as string | null,
      }
    case 'companies':
      return {
        id: raw.id as string,
        displayName: raw.companyName as string,
        subName: `${raw.applicantName} · ${raw.phone}`,
        detail: raw.businessNumber as string,
        status: raw.status as string,
        requestedAt: raw.requestedAt as string,
        rejectReason: raw.rejectReason as string | null,
      }
    case 'managers':
      return {
        id: raw.id as string,
        displayName: raw.applicantName as string,
        subName: raw.phone as string,
        detail: raw.companyName as string,
        status: raw.status as string,
        requestedAt: raw.requestedAt as string,
        rejectReason: raw.rejectReason as string | null,
      }
    case 'site-joins':
      return {
        id: raw.id as string,
        displayName: raw.workerName as string,
        subName: raw.workerPhone as string,
        detail: raw.siteName as string,
        status: raw.status as string,
        requestedAt: raw.requestedAt as string,
        rejectReason: raw.rejectReason as string | null,
      }
    case 'ext-companies':
      return {
        id: raw.id as string,
        displayName: raw.companyName as string,
        subName: `사업자번호: ${(raw.businessNumber as string) ?? '미입력'}`,
        detail: `담당자: ${(raw.representativeName as string) ?? '—'} · ${(raw.contactPhone as string) ?? '—'}`,
        status: (raw.externalVerificationStatus as string) ?? 'PENDING_VERIFICATION',
        requestedAt: raw.updatedAt as string,
        rejectReason: raw.verificationNotes as string | null,
      }
    case 'devices':
      return {
        id: raw.id as string,
        displayName: raw.workerName as string,
        subName: raw.newDeviceName as string,
        detail: raw.reason as string,
        status: raw.status as string,
        requestedAt: (raw.requestedAt ?? raw.createdAt) as string,
        rejectReason: raw.rejectReason as string | null,
      }
  }
}

// ─── API 액션 경로 ────────────────────────────────────────────────────────────
function approveApi(tab: TabKey, id: string): string {
  const base: Record<TabKey, string> = {
    workers:         `/api/admin/registrations/${id}/approve`,
    companies:       `/api/admin/company-admin-requests/${id}/approve`,
    'ext-companies': `/api/admin/companies/${id}/verify`,
    managers:        `/api/admin/company-join-requests/${id}/approve`,
    'site-joins':    `/api/admin/site-join-requests/${id}/approve`,
    devices:         `/api/admin/device-requests/${id}/approve`,
  }
  return base[tab]
}

function rejectApi(tab: TabKey, id: string): string {
  const base: Record<TabKey, string> = {
    workers:         `/api/admin/registrations/${id}/reject`,
    companies:       `/api/admin/company-admin-requests/${id}/reject`,
    'ext-companies': `/api/admin/companies/${id}/reject`,
    managers:        `/api/admin/company-join-requests/${id}/reject`,
    'site-joins':    `/api/admin/site-join-requests/${id}/reject`,
    devices:         `/api/admin/device-requests/${id}/reject`,
  }
  return base[tab]
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────
export default function ApprovalsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tabParam = (searchParams.get('tab') as TabKey) || 'workers'
  const [activeTab, setActiveTab] = useState<TabKey>(tabParam)

  const switchTab = (key: TabKey) => {
    setActiveTab(key)
    router.push(`/admin/approvals?tab=${key}`, { scroll: false })
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>승인 대기</h1>

      <div style={styles.tabRow}>
        {TABS.map(t => (
          <button
            key={t.key}
            style={{ ...styles.tab, ...(activeTab === t.key ? styles.tabActive : {}) }}
            onClick={() => switchTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <ApprovalTab key={activeTab} tab={activeTab} />
    </div>
  )
}

// ─── 개별 탭 컴포넌트 ─────────────────────────────────────────────────────────
function ApprovalTab({ tab }: { tab: TabKey }) {
  const tabDef = TABS.find(t => t.key === tab)!
  const [statusFilter, setStatusFilter] = useState('PENDING')
  const [items, setItems] = useState<ApprovalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [rejectTarget, setRejectTarget] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [approveResult, setApproveResult] = useState<Record<string, unknown> | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    // ext-companies: verificationStatus이미 URL에 포함, status 파라미터 추가 불필요
    const url = tab === 'ext-companies'
      ? tabDef.api
      : `${tabDef.api}?status=${statusFilter}`
    fetch(url)
      .then(r => r.json())
      .then(d => {
        // companies API는 d.data.items, 나머지는 d.items 또는 d.data
        const rawItems: Record<string, unknown>[] =
          d.data?.items ?? d.items ?? (Array.isArray(d.data) ? d.data : [])
        setItems(rawItems.map(raw => adaptItem(tab, raw)))
      })
      .finally(() => setLoading(false))
  }, [tab, tabDef.api, statusFilter])

  useEffect(() => { load() }, [load])

  const handleApprove = async (id: string) => {
    setProcessing(id)
    setMsg(null)
    try {
      const res = await fetch(approveApi(tab, id), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const d = await res.json()
      if (res.ok) {
        setMsg({ type: 'success', text: '승인 처리되었습니다.' })
        if (d.data?.temporaryPassword) setApproveResult(d.data)
        load()
      } else {
        setMsg({ type: 'error', text: d.message ?? '오류가 발생했습니다.' })
      }
    } finally {
      setProcessing(null)
    }
  }

  const handleReject = async () => {
    if (!rejectTarget || !rejectReason.trim()) return
    setProcessing(rejectTarget)
    setMsg(null)
    try {
      const res = await fetch(rejectApi(tab, rejectTarget), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectReason }),
      })
      const d = await res.json()
      if (res.ok) {
        setMsg({ type: 'success', text: '반려 처리되었습니다.' })
        setRejectTarget(null)
        setRejectReason('')
        load()
      } else {
        setMsg({ type: 'error', text: d.message ?? '오류가 발생했습니다.' })
      }
    } finally {
      setProcessing(null)
    }
  }

  const pendingCount = items.filter(i => i.status === 'PENDING').length

  return (
    <div style={styles.tabContent}>
      {/* 상태 필터 (ext-companies는 URL에 이미 필터 내장 — 숨김) */}
      <div style={styles.filterRow}>
        {tab !== 'ext-companies' && ['PENDING', 'APPROVED', 'REJECTED'].map(s => (
          <button
            key={s}
            style={{ ...styles.filterBtn, ...(statusFilter === s ? styles.filterBtnActive : {}) }}
            onClick={() => setStatusFilter(s)}
          >
            {s === 'PENDING' ? '대기' : s === 'APPROVED' ? '승인' : '반려'}
            {s === 'PENDING' && pendingCount > 0 && (
              <span style={styles.badge}>{pendingCount}</span>
            )}
          </button>
        ))}
        <button style={styles.refreshBtn} onClick={load}>↻ 새로고침</button>
      </div>

      {/* 알림 */}
      {msg && (
        <div style={{ ...styles.alert, background: msg.type === 'success' ? '#d1fae5' : '#fee2e2', color: msg.type === 'success' ? '#065f46' : '#991b1b' }}>
          {msg.text}
        </div>
      )}

      {/* 승인 결과 모달 (임시비밀번호 등) */}
      {approveResult && (
        <div style={styles.resultBox}>
          <strong>✅ 승인 완료</strong>
          {approveResult.temporaryPassword != null && (
            <p>임시 비밀번호: <code style={styles.code}>{String(approveResult.temporaryPassword)}</code></p>
          )}
          {!(approveResult.emailSent as boolean) && (
            <p style={{ color: '#b45309' }}>⚠️ 이메일 없음 — 수동으로 전달 필요</p>
          )}
          <button style={styles.closeBtn} onClick={() => setApproveResult(null)}>닫기</button>
        </div>
      )}

      {/* 테이블 */}
      {loading ? (
        <p style={styles.muted}>로딩 중...</p>
      ) : items.length === 0 ? (
        <div style={styles.emptyState}>
          <p>{statusFilter === 'PENDING' ? '승인 대기 항목이 없습니다.' : '항목이 없습니다.'}</p>
        </div>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.thead}>
                <th style={styles.th}>신청일</th>
                <th style={styles.th}>이름/업체</th>
                <th style={styles.th}>상세</th>
                <th style={styles.th}>상태</th>
                {statusFilter === 'PENDING' && <th style={styles.th}>액션</th>}
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} style={styles.tr}>
                  <td style={{ ...styles.td, color: '#9ca3af', fontSize: '12px', whiteSpace: 'nowrap' }}>
                    {new Date(item.requestedAt).toLocaleDateString('ko-KR')}
                  </td>
                  <td style={styles.td}>
                    <div style={{ fontWeight: 600 }}>{item.displayName}</div>
                    {item.subName && <div style={{ fontSize: '12px', color: '#6b7280' }}>{item.subName}</div>}
                  </td>
                  <td style={{ ...styles.td, color: '#6b7280', fontSize: '13px' }}>
                    {item.detail}
                    {item.rejectReason && (
                      <div style={{ color: '#dc2626', fontSize: '12px' }}>사유: {item.rejectReason}</div>
                    )}
                  </td>
                  <td style={styles.td}>
                    <StatusBadge status={item.status} />
                  </td>
                  {statusFilter === 'PENDING' && (
                    <td style={styles.td}>
                      <div style={styles.actionButtons}>
                        <button
                          style={styles.approveBtn}
                          disabled={processing === item.id}
                          onClick={() => handleApprove(item.id)}
                        >
                          {processing === item.id ? '처리 중...' : '승인'}
                        </button>
                        <button
                          style={styles.rejectBtn}
                          disabled={processing === item.id}
                          onClick={() => { setRejectTarget(item.id); setRejectReason('') }}
                        >
                          반려
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 반려 사유 모달 */}
      {rejectTarget && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h3 style={styles.modalTitle}>반려 사유 입력</h3>
            <textarea
              style={styles.textarea}
              rows={4}
              placeholder="반려 사유를 입력하세요. (필수)"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
            />
            <div style={styles.modalActions}>
              <button style={styles.cancelBtn} onClick={() => setRejectTarget(null)}>취소</button>
              <button
                style={{ ...styles.rejectBtn, opacity: rejectReason.trim() ? 1 : 0.5 }}
                disabled={!rejectReason.trim() || processing === rejectTarget}
                onClick={handleReject}
              >
                {processing === rejectTarget ? '처리 중...' : '반려 확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    PENDING:              { label: '대기',      bg: '#fef3c7', color: '#92400e' },
    APPROVED:             { label: '승인',      bg: '#d1fae5', color: '#065f46' },
    REJECTED:             { label: '반려',      bg: '#fee2e2', color: '#991b1b' },
    ACTIVE:               { label: '승인',      bg: '#d1fae5', color: '#065f46' },
    PENDING_VERIFICATION: { label: '인증 대기', bg: '#fff8e1', color: '#e65100' },
    VERIFIED:             { label: '인증 완료', bg: '#d1fae5', color: '#065f46' },
    DRAFT:                { label: '미제출',    bg: '#f3f4f6', color: '#6b7280' },
    INACTIVE:             { label: '비활성',    bg: '#f3f4f6', color: '#6b7280' },
  }
  const s = map[status] ?? { label: status, bg: '#f3f4f6', color: '#6b7280' }
  return <span style={{ ...styles.statusBadge, background: s.bg, color: s.color }}>{s.label}</span>
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '32px' },
  title: { fontSize: '22px', fontWeight: 700, color: '#111827', marginBottom: '20px' },
  tabRow: {
    display: 'flex',
    borderBottom: '1px solid #e5e7eb',
    marginBottom: '0',
    flexWrap: 'wrap',
    gap: '2px',
  },
  tab: {
    padding: '10px 18px',
    border: 'none',
    borderBottom: '2px solid transparent',
    background: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#6b7280',
    marginBottom: '-1px',
  },
  tabActive: { color: '#1d4ed8', borderBottom: '2px solid #1d4ed8', fontWeight: 600 },
  tabContent: { background: '#fff', borderRadius: '0 0 8px 8px', border: '1px solid #e5e7eb', borderTop: 'none', padding: '24px' },
  filterRow: { display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' },
  filterBtn: {
    padding: '6px 14px', border: '1px solid #d1d5db', borderRadius: '6px',
    background: '#fff', cursor: 'pointer', fontSize: '13px', color: '#374151',
    display: 'flex', alignItems: 'center', gap: '6px',
  },
  filterBtnActive: { background: '#eff6ff', borderColor: '#1d4ed8', color: '#1d4ed8', fontWeight: 600 },
  badge: {
    background: '#dc2626', color: '#fff', borderRadius: '10px',
    padding: '0 6px', fontSize: '11px', minWidth: '18px', textAlign: 'center',
  },
  refreshBtn: {
    padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: '6px',
    background: '#fff', cursor: 'pointer', fontSize: '13px', color: '#6b7280',
    marginLeft: 'auto',
  },
  alert: { padding: '10px 16px', borderRadius: '6px', marginBottom: '12px', fontSize: '14px' },
  resultBox: {
    background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px',
    padding: '16px 20px', marginBottom: '16px',
  },
  code: { background: '#e0f2fe', padding: '2px 8px', borderRadius: '4px', fontFamily: 'monospace', fontWeight: 700, color: '#0369a1' },
  closeBtn: { marginTop: '8px', padding: '5px 12px', border: '1px solid #d1d5db', borderRadius: '5px', cursor: 'pointer', fontSize: '13px', background: '#fff' },
  emptyState: { textAlign: 'center', padding: '48px 0', color: '#6b7280' },
  tableWrap: { border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  thead: { background: '#f9fafb' },
  th: { padding: '11px 14px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb' },
  tr: { borderBottom: '1px solid #f3f4f6' },
  td: { padding: '13px 14px', fontSize: '14px', color: '#1f2937', verticalAlign: 'top' },
  statusBadge: { fontSize: '11px', padding: '3px 8px', borderRadius: '4px', fontWeight: 500 },
  actionButtons: { display: 'flex', gap: '6px' },
  approveBtn: {
    padding: '5px 12px', background: '#059669', color: '#fff',
    border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
  },
  rejectBtn: {
    padding: '5px 12px', background: '#dc2626', color: '#fff',
    border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
  },
  cancelBtn: {
    padding: '7px 16px', background: '#fff', border: '1px solid #d1d5db',
    borderRadius: '6px', cursor: 'pointer', fontSize: '14px',
  },
  modalOverlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  modal: { background: '#fff', borderRadius: '10px', padding: '28px', width: '400px', maxWidth: '90vw' },
  modalTitle: { fontSize: '16px', fontWeight: 700, color: '#111827', marginBottom: '16px', marginTop: 0 },
  textarea: { width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box' },
  modalActions: { display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' },
  muted: { color: '#6b7280', fontSize: '14px' },
}
