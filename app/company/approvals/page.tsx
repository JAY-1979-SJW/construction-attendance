'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

type TabKey = 'workers' | 'site-joins'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'workers',    label: '작업자 가입 승인' },
  { key: 'site-joins', label: '현장 참여 승인' },
]

interface ApprovalItem {
  id: string
  name: string
  sub: string
  detail?: string
  status: string
  requestedAt: string
  rejectReason?: string | null
}

const STATUS_LABEL: Record<string, string> = {
  PENDING:  '대기', APPROVED: '승인', REJECTED: '반려',
  PENDING_REVIEW: '검토중', ACTIVE: '활성',
}

const STATUS_COLOR: Record<string, string> = {
  PENDING:  '#92400e', APPROVED: '#065f46', REJECTED: '#991b1b', PENDING_REVIEW: '#1e40af',
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR')
}

function CompanyApprovalsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tabParam = (searchParams.get('tab') as TabKey) || 'workers'
  const [activeTab, setActiveTab] = useState<TabKey>(tabParam)

  const switchTab = (key: TabKey) => {
    setActiveTab(key)
    router.push(`/company/approvals?tab=${key}`, { scroll: false })
  }

  return (
    <div className="p-8 max-w-[900px] mx-auto">
      <h1 className="text-[22px] font-bold mb-5">승인 대기</h1>
      <div className="flex gap-1 mb-5 border-b border-[#e5e7eb]">
        {TABS.map(t => (
          <button
            key={t.key}
            className={[
              'px-4 py-2 border-0 bg-transparent cursor-pointer text-[13px] border-b-2 -mb-px',
              activeTab === t.key
                ? 'text-[#F97316] border-b-[#F97316] font-semibold'
                : 'text-[#6b7280] border-b-transparent',
            ].join(' ')}
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

export default function CompanyApprovalsPage() {
  return <Suspense fallback={<div className="p-8">로딩 중...</div>}><CompanyApprovalsContent /></Suspense>
}

function ApprovalTab({ tab }: { tab: TabKey }) {
  const [items, setItems] = useState<ApprovalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [rejectTarget, setRejectTarget] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    const api = tab === 'workers'
      ? '/api/admin/registrations?status=PENDING_REVIEW'
      : '/api/admin/site-join-requests?status=PENDING'
    fetch(api)
      .then(r => r.json())
      .then(d => {
        const raw: Record<string, unknown>[] = d.items ?? d.data?.items ?? []
        setItems(raw.map((r) => tab === 'workers' ? {
          id: r.id as string,
          name: r.name as string,
          sub: r.phone as string,
          detail: r.jobTitle as string,
          status: r.accountStatus as string,
          requestedAt: r.createdAt as string,
        } : {
          id: r.id as string,
          name: r.workerName as string,
          sub: r.workerPhone as string,
          detail: r.siteName as string,
          status: r.status as string,
          requestedAt: r.requestedAt as string,
          rejectReason: r.rejectReason as string | null,
        }))
      })
      .finally(() => setLoading(false))
  }, [tab])

  useEffect(() => { load() }, [load])

  const approve = async (id: string) => {
    setProcessing(id)
    setMsg(null)
    const api = tab === 'workers'
      ? `/api/admin/registrations/${id}/approve`
      : `/api/admin/site-join-requests/${id}/approve`
    try {
      const res = await fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      if (res.ok) {
        setMsg({ type: 'success', text: '승인 처리되었습니다.' })
        load()
      } else {
        const d = await res.json()
        setMsg({ type: 'error', text: d.message ?? '오류 발생' })
      }
    } finally { setProcessing(null) }
  }

  const rejectSubmit = async () => {
    if (!rejectTarget) return
    setProcessing(rejectTarget)
    const api = tab === 'workers'
      ? `/api/admin/registrations/${rejectTarget}/reject`
      : `/api/admin/site-join-requests/${rejectTarget}/reject`
    try {
      const res = await fetch(api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason }),
      })
      if (res.ok) {
        setMsg({ type: 'success', text: '반려 처리되었습니다.' })
        setRejectTarget(null)
        setRejectReason('')
        load()
      } else {
        const d = await res.json()
        setMsg({ type: 'error', text: d.message ?? '오류 발생' })
      }
    } finally { setProcessing(null) }
  }

  return (
    <div>
      {msg && (
        <div className="px-[14px] py-[10px] rounded-md mb-4 text-[13px]" style={{
          background: msg.type === 'success' ? '#d1fae5' : '#fee2e2',
          color: msg.type === 'success' ? '#065f46' : '#991b1b',
        }}>
          {msg.text}
        </div>
      )}

      {loading ? (
        <p className="text-[#9ca3af] text-center py-10">불러오는 중...</p>
      ) : items.length === 0 ? (
        <div className="text-center text-[#9ca3af] py-12 bg-card border border-[#e5e7eb] rounded-lg">대기 중인 항목이 없습니다.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map(item => (
            <div key={item.id} className="bg-card border border-[#e5e7eb] rounded-lg p-4 flex items-start gap-3">
              <div className="flex-1">
                <div className="text-[14px] font-semibold text-[#111827] mb-[2px]">{item.name}</div>
                <div className="text-[12px] text-[#6b7280]">{item.sub}</div>
                {item.detail && <div className="text-[12px] text-[#9ca3af] mt-[2px]">{item.detail}</div>}
                <div className="text-[11px] text-[#d1d5db] mt-1">{fmtDate(item.requestedAt)}</div>
              </div>
              <div className="flex flex-col items-end gap-[6px]">
                <span className="text-[11px] px-2 py-[2px] rounded bg-[#fef3c7]" style={{ color: STATUS_COLOR[item.status] ?? '#374151' }}>
                  {STATUS_LABEL[item.status] ?? item.status}
                </span>
                {item.status === 'PENDING_REVIEW' || item.status === 'PENDING' ? (
                  <div className="flex gap-[6px]">
                    <button
                      onClick={() => approve(item.id)}
                      disabled={processing === item.id}
                      className="px-3 py-[5px] bg-[#059669] text-white border-0 rounded-[5px] cursor-pointer text-[12px]"
                    >
                      승인
                    </button>
                    <button
                      onClick={() => { setRejectTarget(item.id); setRejectReason('') }}
                      disabled={processing === item.id}
                      className="px-3 py-[5px] bg-[#dc2626] text-white border-0 rounded-[5px] cursor-pointer text-[12px]"
                    >
                      반려
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 반려 사유 모달 */}
      {rejectTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-card rounded-[12px] p-6 w-[400px] max-w-[90vw]">
            <h3 className="m-0 mb-3 text-[15px] font-semibold">반려 사유</h3>
            <textarea
              rows={4}
              className="w-full border border-[rgba(91,164,217,0.3)] rounded-md p-2 text-[13px] box-border"
              placeholder="반려 사유를 입력하세요"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex gap-2 mt-3">
              <button onClick={rejectSubmit} className="px-3 py-[5px] bg-[#dc2626] text-white border-0 rounded-[5px] cursor-pointer text-[12px]">반려 확정</button>
              <button onClick={() => setRejectTarget(null)} className="px-3 py-[5px] bg-card text-[#374151] border border-[rgba(91,164,217,0.3)] rounded-[5px] cursor-pointer text-[12px]">취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
