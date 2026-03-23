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

export default function CompanyApprovalsPage() {
  return <Suspense fallback={<div style={{ padding: 32 }}>로딩 중...</div>}><CompanyApprovalsContent /></Suspense>
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
        <div style={{
          padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px',
          background: msg.type === 'success' ? '#d1fae5' : '#fee2e2',
          color: msg.type === 'success' ? '#065f46' : '#991b1b',
        }}>
          {msg.text}
        </div>
      )}

      {loading ? (
        <p style={{ color: '#9ca3af', textAlign: 'center', padding: '40px 0' }}>불러오는 중...</p>
      ) : items.length === 0 ? (
        <div style={styles.empty}>대기 중인 항목이 없습니다.</div>
      ) : (
        <div style={styles.list}>
          {items.map(item => (
            <div key={item.id} style={styles.item}>
              <div style={{ flex: 1 }}>
                <div style={styles.itemName}>{item.name}</div>
                <div style={styles.itemSub}>{item.sub}</div>
                {item.detail && <div style={styles.itemDetail}>{item.detail}</div>}
                <div style={styles.itemDate}>{fmtDate(item.requestedAt)}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                <span style={{
                  fontSize: '11px', padding: '2px 8px', borderRadius: '4px',
                  background: '#fef3c7', color: STATUS_COLOR[item.status] ?? '#374151',
                }}>
                  {STATUS_LABEL[item.status] ?? item.status}
                </span>
                {item.status === 'PENDING_REVIEW' || item.status === 'PENDING' ? (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => approve(item.id)}
                      disabled={processing === item.id}
                      style={styles.approveBtn}
                    >
                      승인
                    </button>
                    <button
                      onClick={() => { setRejectTarget(item.id); setRejectReason('') }}
                      disabled={processing === item.id}
                      style={styles.rejectBtn}
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
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h3 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 600 }}>반려 사유</h3>
            <textarea
              rows={4}
              style={{ width: '100%', border: '1px solid rgba(91,164,217,0.3)', borderRadius: '6px', padding: '8px', fontSize: '13px', boxSizing: 'border-box' }}
              placeholder="반려 사유를 입력하세요"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button onClick={rejectSubmit} style={styles.rejectBtn}>반려 확정</button>
              <button onClick={() => setRejectTarget(null)} style={styles.cancelBtn}>취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '32px', maxWidth: '900px', margin: '0 auto', fontFamily: 'sans-serif' },
  title: { fontSize: '22px', fontWeight: 700, color: '#111827', marginBottom: '20px' },
  tabRow: { display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '1px solid #e5e7eb', paddingBottom: '0' },
  tab: {
    padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
    fontSize: '13px', color: '#6b7280', borderBottom: '2px solid transparent', marginBottom: '-1px',
  },
  tabActive: { color: '#0f4c75', borderBottomColor: '#0f4c75', fontWeight: 600 },
  list: { display: 'flex', flexDirection: 'column', gap: '8px' },
  item: {
    background: '#243144', border: '1px solid #e5e7eb', borderRadius: '8px',
    padding: '16px', display: 'flex', alignItems: 'flex-start', gap: '12px',
  },
  itemName: { fontSize: '14px', fontWeight: 600, color: '#111827', marginBottom: '2px' },
  itemSub: { fontSize: '12px', color: '#6b7280' },
  itemDetail: { fontSize: '12px', color: '#9ca3af', marginTop: '2px' },
  itemDate: { fontSize: '11px', color: '#d1d5db', marginTop: '4px' },
  empty: { textAlign: 'center', color: '#9ca3af', padding: '48px 0', background: '#243144', border: '1px solid #e5e7eb', borderRadius: '8px' },
  approveBtn: {
    padding: '5px 12px', background: '#059669', color: 'white',
    border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '12px',
  },
  rejectBtn: {
    padding: '5px 12px', background: '#dc2626', color: 'white',
    border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '12px',
  },
  cancelBtn: {
    padding: '5px 12px', background: '#243144', color: '#374151',
    border: '1px solid rgba(91,164,217,0.3)', borderRadius: '5px', cursor: 'pointer', fontSize: '12px',
  },
  modalOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
  },
  modal: {
    background: '#243144', borderRadius: '12px', padding: '24px', width: '400px', maxWidth: '90vw',
  },
}
