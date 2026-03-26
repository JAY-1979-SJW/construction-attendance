'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { PageShell, PageHeader, AdminTable, AdminTr, AdminTd, EmptyRow, StatusBadge, Btn } from '@/components/admin/ui'

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
  displayName: string
  subName?: string
  detail?: string
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
function ApprovalsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tabParam = (searchParams.get('tab') as TabKey) || 'workers'
  const [activeTab, setActiveTab] = useState<TabKey>(tabParam)

  const switchTab = (key: TabKey) => {
    setActiveTab(key)
    router.push(`/admin/approvals?tab=${key}`, { scroll: false })
  }

  return (
    <PageShell>

      <div className="flex border-b border-[#E5E7EB] mb-0 flex-wrap gap-[2px] bg-white rounded-t-[10px] px-2 pt-1">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`px-[16px] py-[10px] border-none border-b-2 bg-transparent cursor-pointer text-[13px] -mb-px transition-colors ${
              activeTab === t.key
                ? 'text-[#F97316] border-b-[#F97316] font-semibold border-solid'
                : 'text-[#6B7280] border-transparent hover:text-[#374151]'
            }`}
            onClick={() => switchTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <ApprovalTab key={activeTab} tab={activeTab} />
    </PageShell>
  )
}

export default function ApprovalsPage() {
  return <Suspense fallback={<div className="p-8">로딩 중...</div>}><ApprovalsContent /></Suspense>
}

// ─── 개별 탭 컴포넌트 ─────────────────────────────────────────────────────────
function ApprovalTab({ tab }: { tab: TabKey }) {
  const tabDef = TABS.find(t => t.key === tab)!
  const [statusFilter, setStatusFilter] = useState('PENDING')
  const [items, setItems] = useState<ApprovalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkProcessing, setBulkProcessing] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [rejectTarget, setRejectTarget] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [approveResult, setApproveResult] = useState<Record<string, unknown> | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    const url = tab === 'ext-companies'
      ? tabDef.api
      : `${tabDef.api}?status=${statusFilter}`
    fetch(url)
      .then(r => r.json())
      .then(d => {
        const rawItems: Record<string, unknown>[] =
          d.data?.items ?? d.items ?? (Array.isArray(d.data) ? d.data : [])
        setItems(rawItems.map(raw => adaptItem(tab, raw)))
      })
      .finally(() => setLoading(false))
  }, [tab, tabDef.api, statusFilter])

  useEffect(() => { load(); setSelectedIds(new Set()) }, [load])

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  const toggleSelectAll = () => {
    const pendingItems = items.filter(i => i.status === 'PENDING')
    if (selectedIds.size === pendingItems.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(pendingItems.map(i => i.id)))
    }
  }

  const handleBulkApprove = async () => {
    if (!selectedIds.size) return
    setBulkProcessing(true)
    await Promise.all([...selectedIds].map(id =>
      fetch(approveApi(tab, id), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    ))
    setBulkProcessing(false)
    setSelectedIds(new Set())
    setMsg({ type: 'success', text: `${selectedIds.size}건 일괄 승인 처리되었습니다.` })
    load()
  }

  const handleBulkReject = async () => {
    const reason = prompt('일괄 반려 사유를 입력하세요.')
    if (!reason?.trim()) return
    setBulkProcessing(true)
    await Promise.all([...selectedIds].map(id =>
      fetch(rejectApi(tab, id), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rejectReason: reason }) })
    ))
    setBulkProcessing(false)
    setSelectedIds(new Set())
    setMsg({ type: 'success', text: `${selectedIds.size}건 일괄 반려 처리되었습니다.` })
    load()
  }

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
    <div className="bg-white rounded-b-[10px] border border-[#E5E7EB] border-t-0 p-6">
      {/* 상태 필터 */}
      <div className="flex gap-2 mb-4 items-center flex-wrap">
        {tab !== 'ext-companies' && ['PENDING', 'APPROVED', 'REJECTED'].map(s => (
          <button
            key={s}
            className={`px-[14px] py-[6px] border rounded-md cursor-pointer text-[13px] flex items-center gap-[6px] transition-colors ${
              statusFilter === s
                ? 'bg-[#FFF7ED] border-[#F97316] text-[#F97316] font-semibold'
                : 'bg-white border-[rgba(91,164,217,0.3)] text-[#374151]'
            }`}
            onClick={() => setStatusFilter(s)}
          >
            {s === 'PENDING' ? '대기' : s === 'APPROVED' ? '승인' : '반려'}
            {s === 'PENDING' && pendingCount > 0 && (
              <span className="bg-[#dc2626] text-white rounded-[10px] px-[6px] text-[11px] min-w-[18px] text-center">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
        <Btn variant="secondary" onClick={load} className="ml-auto">↻ 새로고침</Btn>
      </div>

      {/* 알림 */}
      {msg && (
        <div className={`px-4 py-[10px] rounded-md mb-3 text-sm ${
          msg.type === 'success' ? 'bg-[#d1fae5] text-[#065f46]' : 'bg-[#fee2e2] text-[#991b1b]'
        }`}>
          {msg.text}
        </div>
      )}

      {/* 승인 결과 모달 */}
      {approveResult && (
        <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-lg px-5 py-4 mb-4">
          <strong>✅ 승인 완료</strong>
          {approveResult.temporaryPassword != null && (
            <p>임시 비밀번호: <code className="bg-[#e0f2fe] px-2 py-[2px] rounded font-mono font-bold text-[#0369a1]">{String(approveResult.temporaryPassword)}</code></p>
          )}
          {!(approveResult.emailSent as boolean) && (
            <p className="text-[#b45309]">⚠️ 이메일 없음 — 수동으로 전달 필요</p>
          )}
          <Btn variant="secondary" onClick={() => setApproveResult(null)} className="mt-2">닫기</Btn>
        </div>
      )}

      {/* 일괄 처리 바 */}
      {statusFilter === 'PENDING' && selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 mb-3 bg-[#FFF7ED] border border-[#FDE68A] rounded-lg">
          <span className="text-[13px] font-semibold text-[#92400E]">선택 {selectedIds.size}건</span>
          <Btn size="sm" variant="success" disabled={bulkProcessing} onClick={handleBulkApprove}>
            {bulkProcessing ? '처리 중...' : '일괄 승인'}
          </Btn>
          <Btn size="sm" variant="danger" disabled={bulkProcessing} onClick={handleBulkReject}>일괄 반려</Btn>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-[12px] text-[#92400E] bg-none border-none cursor-pointer underline"
          >
            선택 해제
          </button>
        </div>
      )}

      {/* 테이블 */}
      {loading ? (
        <p className="text-[#6b7280] text-sm">로딩 중...</p>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-[#6b7280]">
          <p>{statusFilter === 'PENDING' ? '승인 대기 항목이 없습니다.' : '항목이 없습니다.'}</p>
        </div>
      ) : (
        <AdminTable headers={[
          ...(statusFilter === 'PENDING' ? [<input key="cb" type="checkbox" className="cursor-pointer" checked={selectedIds.size > 0 && selectedIds.size === items.filter(i => i.status === 'PENDING').length} onChange={toggleSelectAll} />] : []),
          '신청일', '이름/업체', '상세', '상태',
          ...(statusFilter === 'PENDING' ? ['액션'] : []),
        ]}>
          {items.map(item => (
            <AdminTr key={item.id}>
              {statusFilter === 'PENDING' && (
                <AdminTd><input type="checkbox" className="cursor-pointer" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} /></AdminTd>
              )}
              <AdminTd className="text-xs align-top">{new Date(item.requestedAt).toLocaleDateString('ko-KR')}</AdminTd>
              <AdminTd className="align-top">
                <div className="font-semibold text-[#111827]">{item.displayName}</div>
                {item.subName && <div className="text-xs text-[#6b7280]">{item.subName}</div>}
              </AdminTd>
              <AdminTd className="text-[#6b7280] align-top">
                {item.detail}
                {item.rejectReason && <div className="text-[#dc2626] text-xs">사유: {item.rejectReason}</div>}
              </AdminTd>
              <AdminTd className="align-top">
                <StatusBadge status={item.status} />
              </AdminTd>
              {statusFilter === 'PENDING' && (
                <AdminTd className="align-top">
                  <div className="flex gap-[6px]">
                    <Btn size="xs" variant="success" disabled={processing === item.id} onClick={() => handleApprove(item.id)}>
                      {processing === item.id ? '처리 중...' : '승인'}
                    </Btn>
                    <Btn size="xs" variant="danger" disabled={processing === item.id} onClick={() => { setRejectTarget(item.id); setRejectReason('') }}>반려</Btn>
                  </div>
                </AdminTd>
              )}
            </AdminTr>
          ))}
        </AdminTable>
      )}

      {/* 반려 사유 모달 */}
      {rejectTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1000]">
          <div className="bg-white rounded-[10px] p-7 w-[400px] max-w-[90vw]">
            <h3 className="text-base font-bold text-[#111827] mb-4 mt-0">반려 사유 입력</h3>
            <textarea
              className="w-full p-[10px] border border-[rgba(91,164,217,0.3)] rounded-md text-sm resize-y box-border"
              rows={4}
              placeholder="반려 사유를 입력하세요. (필수)"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
            />
            <div className="flex gap-2 justify-end mt-4">
              <Btn variant="secondary" onClick={() => setRejectTarget(null)}>취소</Btn>
              <Btn size="xs" variant="danger" disabled={!rejectReason.trim() || processing === rejectTarget} onClick={handleReject}>
                {processing === rejectTarget ? '처리 중...' : '반려 확인'}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

