'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface PODetail {
  id: string
  orderNo: string
  status: string
  orderedByUserId: string
  issuedAt: string | null
  cancelledAt: string | null
  deliveryRequestedDate: string | null
  memo: string | null
  createdAt: string
  updatedAt: string
  materialRequest: { id: string; requestNo: string; title: string; status: string }
  site: { id: string; name: string } | null
  items: POItem[]
  history: HistoryEntry[]
}

interface POItem {
  id: string
  materialRequestItemId: string
  orderedQuantity: string
  receivedQuantity: string
  note: string | null
  itemNameSnapshot: string
  specSnapshot: string | null
  unitSnapshot: string | null
  disciplineCodeSnapshot: string | null
  requestQuantitySnapshot: string
  createdAt: string
}

interface HistoryEntry {
  id: string
  fromStatus: string | null
  toStatus: string
  changedByUserId: string | null
  reason: string | null
  createdAt: string
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT:              '작성중',
  ISSUED:             '발행됨',
  PARTIALLY_RECEIVED: '부분입고',
  RECEIVED:           '입고완료',
  CANCELLED:          '취소됨',
}
const STATUS_COLOR: Record<string, string> = {
  DRAFT:              '#607d8b',
  ISSUED:             '#1565c0',
  PARTIALLY_RECEIVED: '#f9a825',
  RECEIVED:           '#2e7d32',
  CANCELLED:          '#424242',
}

function fmtDate(d: string) {
  return new Date(d).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function fmtDateOnly(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export default function PurchaseOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [po, setPo] = useState<PODetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [editMemo, setEditMemo] = useState('')
  const [editDelivery, setEditDelivery] = useState('')

  const load = () => {
    setLoading(true)
    fetch(`/api/admin/materials/purchase-orders/${id}`)
      .then(r => r.json())
      .then(d => {
        if (!d.success) { router.push('/admin/login'); return }
        setPo(d.data)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id]) // eslint-disable-line

  const handleLogout = () => {
    fetch('/api/admin/auth/logout', { method: 'POST' }).then(() => router.push('/admin/login'))
  }

  const handleIssue = async () => {
    if (!confirm('이 발주서를 발행하시겠습니까?')) return
    setActionLoading(true)
    const res = await fetch(`/api/admin/materials/purchase-orders/${id}/issue`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
    })
    const d = await res.json()
    setActionLoading(false)
    if (d.success) load()
    else alert(d.error ?? d.message ?? '처리 실패')
  }

  const handleCancel = async () => {
    setActionLoading(true)
    const res = await fetch(`/api/admin/materials/purchase-orders/${id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: cancelReason || undefined }),
    })
    const d = await res.json()
    setActionLoading(false)
    if (d.success) { setShowCancelModal(false); setCancelReason(''); load() }
    else alert(d.error ?? d.message ?? '취소 실패')
  }

  const handleSaveEdit = async () => {
    setActionLoading(true)
    const body: Record<string, unknown> = {}
    if (editMemo !== undefined) body.memo = editMemo || null
    if (editDelivery) body.deliveryRequestedDate = editDelivery
    else body.deliveryRequestedDate = null
    const res = await fetch(`/api/admin/materials/purchase-orders/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const d = await res.json()
    setActionLoading(false)
    if (d.success) { setEditMode(false); load() }
    else alert(d.error ?? d.message ?? '수정 실패')
  }

  const startEdit = () => {
    if (!po) return
    setEditMemo(po.memo ?? '')
    setEditDelivery(po.deliveryRequestedDate ? po.deliveryRequestedDate.slice(0, 10) : '')
    setEditMode(true)
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('이 항목을 삭제하시겠습니까?')) return
    const res = await fetch(`/api/admin/materials/purchase-orders/${id}/items/${itemId}`, { method: 'DELETE' })
    const d = await res.json()
    if (d.success) load()
    else alert(d.error ?? d.message ?? '삭제 실패')
  }

  if (loading) return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#1B2838', alignItems: 'center', justifyContent: 'center', color: '#A0AEC0' }}>
      로딩 중...
    </div>
  )
  if (!po) return null

  const isDraft = po.status === 'DRAFT'
  const canIssue = isDraft
  const canCancel = ['DRAFT', 'ISSUED'].includes(po.status)

  return (
    <div style={S.layout}>
      <nav style={S.sidebar}>
        <div style={S.sidebarTitle}>해한 출퇴근</div>
        <div style={S.navSection}>관리</div>
        {[
          { href: '/admin', label: '대시보드' },
          { href: '/admin/materials', label: '자재관리' },
          { href: '/admin/materials/requests', label: '└ 자재청구' },
          { href: '/admin/materials/purchase-orders', label: '└ 발주관리' },
        ].map(item => (
          <Link key={item.href} href={item.href}
            style={item.href === '/admin/materials/purchase-orders' ? S.navItemActive : S.navItem}>
            {item.label}
          </Link>
        ))}
        <button onClick={handleLogout} style={S.logoutBtn}>로그아웃</button>
      </nav>

      <main style={S.main}>
        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link href="/admin/materials/purchase-orders" style={S.backBtn}>← 목록</Link>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 style={S.pageTitle}>{po.orderNo}</h1>
                <span style={{
                  padding: '3px 10px', borderRadius: '12px', fontSize: '12px',
                  background: STATUS_COLOR[po.status] + '22',
                  color: STATUS_COLOR[po.status],
                  border: `1px solid ${STATUS_COLOR[po.status]}66`,
                }}>
                  {STATUS_LABEL[po.status] ?? po.status}
                </span>
              </div>
              <p style={S.pageDesc}>
                청구서: {po.materialRequest.requestNo} — {po.materialRequest.title}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' as const, justifyContent: 'flex-end' }}>
            {isDraft && !editMode && (
              <button onClick={startEdit} style={S.secondaryBtn}>수정</button>
            )}
            {canIssue && (
              <button onClick={handleIssue} disabled={actionLoading} style={S.issueBtn}>발행</button>
            )}
            {canCancel && (
              <button onClick={() => setShowCancelModal(true)} disabled={actionLoading} style={S.cancelBtn}>취소</button>
            )}
          </div>
        </div>

        {/* 기본 정보 카드 */}
        <div style={S.card}>
          {editMode ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div style={S.formGroup}>
                  <label style={S.label}>납품 요청일</label>
                  <input type="date" value={editDelivery} onChange={e => setEditDelivery(e.target.value)} style={S.input} />
                </div>
                <div style={{ ...S.formGroup, gridColumn: '1 / -1' }}>
                  <label style={S.label}>메모</label>
                  <textarea value={editMemo} onChange={e => setEditMemo(e.target.value)} rows={2}
                    style={{ ...S.input, resize: 'vertical' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={() => setEditMode(false)} style={S.secondaryBtn}>취소</button>
                <button onClick={handleSaveEdit} disabled={actionLoading} style={S.primaryBtn}>저장</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              <InfoField label="청구서" value={po.materialRequest.requestNo} />
              <InfoField label="현장" value={po.site?.name ?? '-'} />
              <InfoField label="납품 요청일" value={po.deliveryRequestedDate ? fmtDateOnly(po.deliveryRequestedDate) : '-'} />
              <InfoField label="발행일" value={po.issuedAt ? fmtDate(po.issuedAt) : '-'} />
              <InfoField label="작성일" value={fmtDate(po.createdAt)} />
              {po.memo && <InfoField label="메모" value={po.memo} span />}
            </div>
          )}
        </div>

        {/* 발주 품목 */}
        <div style={{ ...S.card, marginTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>
              발주 품목 <span style={{ color: '#A0AEC0', fontWeight: 400 }}>({po.items.length}건)</span>
            </h2>
          </div>

          {po.items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: '#A0AEC0', fontSize: '14px' }}>
              발주 항목이 없습니다.
            </div>
          ) : (
            <table style={S.table}>
              <thead>
                <tr>
                  {['품목명', '규격', '단위', '청구수량', '발주수량', '입고수량', '비고', isDraft ? '삭제' : ''].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {po.items.map(item => (
                  <tr key={item.id}>
                    <td style={{ ...S.td, fontWeight: 500 }}>{item.itemNameSnapshot}</td>
                    <td style={{ ...S.td, fontSize: '12px', color: '#A0AEC0' }}>{item.specSnapshot ?? '-'}</td>
                    <td style={S.td}>{item.unitSnapshot ?? '-'}</td>
                    <td style={{ ...S.td, textAlign: 'right' as const, color: '#A0AEC0' }}>{Number(item.requestQuantitySnapshot).toLocaleString()}</td>
                    <td style={{ ...S.td, textAlign: 'right' as const, fontWeight: 600 }}>{Number(item.orderedQuantity).toLocaleString()}</td>
                    <td style={{ ...S.td, textAlign: 'right' as const, color: '#66bb6a' }}>{Number(item.receivedQuantity).toLocaleString()}</td>
                    <td style={{ ...S.td, fontSize: '12px', color: '#A0AEC0' }}>{item.note ?? '-'}</td>
                    {isDraft && (
                      <td style={S.td}>
                        <button onClick={() => handleDeleteItem(item.id)} style={S.deleteBtn}>삭제</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 상태 이력 */}
        <div style={{ ...S.card, marginTop: '16px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 16px' }}>상태 이력</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {po.history.map((h, i) => (
              <div key={h.id} style={{
                display: 'flex', gap: '12px', alignItems: 'flex-start',
                padding: '10px 14px',
                background: i === 0 ? 'rgba(244,121,32,0.06)' : 'rgba(255,255,255,0.02)',
                borderRadius: '6px',
                border: i === 0 ? '1px solid rgba(244,121,32,0.2)' : '1px solid rgba(91,164,217,0.08)',
              }}>
                <div style={{ minWidth: '6px', height: '6px', borderRadius: '50%', background: STATUS_COLOR[h.toStatus] ?? '#607d8b', marginTop: '5px' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' as const }}>
                    {h.fromStatus && (
                      <>
                        <span style={{ fontSize: '12px', color: '#A0AEC0' }}>{STATUS_LABEL[h.fromStatus] ?? h.fromStatus}</span>
                        <span style={{ fontSize: '11px', color: '#4a5568' }}>→</span>
                      </>
                    )}
                    <span style={{ fontSize: '13px', fontWeight: 600, color: STATUS_COLOR[h.toStatus] ?? 'white' }}>
                      {STATUS_LABEL[h.toStatus] ?? h.toStatus}
                    </span>
                    <span style={{ fontSize: '11px', color: '#A0AEC0' }}>{fmtDate(h.createdAt)}</span>
                  </div>
                  {h.reason && <div style={{ fontSize: '12px', color: '#A0AEC0', marginTop: '4px' }}>{h.reason}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* 취소 모달 */}
      {showCancelModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }}>
          <div style={{ background: '#243144', borderRadius: '10px', padding: '24px', width: '420px', maxWidth: '95vw' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 16px', color: 'white' }}>발주 취소</h3>
            <div style={{ marginBottom: '8px', fontSize: '13px', color: '#A0AEC0' }}>취소 사유 (선택)</div>
            <textarea
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              rows={3}
              placeholder="취소 사유를 입력하세요 (선택)."
              style={{ ...S.input, width: '100%', boxSizing: 'border-box' as const }}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button onClick={() => { setShowCancelModal(false); setCancelReason('') }} style={S.secondaryBtn}>닫기</button>
              <button onClick={handleCancel} disabled={actionLoading} style={S.cancelBtn}>취소 확정</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoField({ label, value, span }: { label: string; value: string; span?: boolean }) {
  return (
    <div style={{ gridColumn: span ? '1 / -1' : undefined }}>
      <div style={{ fontSize: '11px', color: '#A0AEC0', marginBottom: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>{label}</div>
      <div style={{ fontSize: '14px', color: 'white' }}>{value}</div>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  layout: { display: 'flex', minHeight: '100vh', background: '#1B2838', color: 'white' },
  sidebar: { width: '220px', background: '#141E2A', padding: '24px 0', flexShrink: 0, display: 'flex', flexDirection: 'column' },
  sidebarTitle: { color: 'white', fontSize: '16px', fontWeight: 700, padding: '0 20px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)' },
  navSection: { color: 'rgba(255,255,255,0.4)', fontSize: '11px', padding: '16px 20px 8px', textTransform: 'uppercase', letterSpacing: '1px' },
  navItem: { display: 'block', color: 'rgba(255,255,255,0.8)', padding: '10px 20px', fontSize: '14px', textDecoration: 'none' },
  navItemActive: { display: 'block', color: 'white', padding: '10px 20px', fontSize: '14px', textDecoration: 'none', background: 'rgba(244,121,32,0.15)', borderLeft: '3px solid #F47920' },
  logoutBtn: { margin: '24px 20px 0', padding: '10px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '13px' },
  main: { flex: 1, padding: '32px', overflowX: 'auto' },
  pageTitle: { fontSize: '22px', fontWeight: 700, margin: 0 },
  pageDesc: { fontSize: '13px', color: '#A0AEC0', margin: '4px 0 0' },
  backBtn: { color: '#A0AEC0', textDecoration: 'none', fontSize: '13px', padding: '6px 12px', border: '1px solid rgba(91,164,217,0.2)', borderRadius: '4px', whiteSpace: 'nowrap' as const },
  card: { background: '#243144', borderRadius: '10px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.35)' },
  formGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '12px', color: '#A0AEC0', fontWeight: 500 },
  input: { padding: '9px 12px', border: '1px solid rgba(91,164,217,0.3)', borderRadius: '6px', fontSize: '14px', background: '#1B2838', color: 'white' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '10px 12px', fontSize: '11px', color: '#A0AEC0', borderBottom: '2px solid rgba(91,164,217,0.2)' },
  td: { padding: '10px 12px', fontSize: '13px', borderBottom: '1px solid rgba(91,164,217,0.08)', color: 'white' },
  primaryBtn: { padding: '8px 18px', background: '#F47920', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 },
  secondaryBtn: { padding: '8px 16px', background: 'rgba(255,255,255,0.08)', color: '#A0AEC0', border: '1px solid rgba(91,164,217,0.2)', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' },
  issueBtn: { padding: '8px 18px', background: '#1565c0', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 },
  cancelBtn: { padding: '8px 16px', background: 'rgba(183,28,28,0.15)', color: '#ef5350', border: '1px solid rgba(183,28,28,0.3)', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' },
  deleteBtn: { padding: '3px 10px', background: 'rgba(183,28,28,0.15)', color: '#ef5350', border: '1px solid rgba(183,28,28,0.3)', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' },
}
