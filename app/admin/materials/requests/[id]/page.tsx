'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import MaterialPickerModal from '@/components/admin/MaterialPickerModal'

interface OrderableItem {
  id: string
  itemName: string
  spec: string | null
  unit: string | null
  requestedQty: string
  orderedQty: string
  remainingQty: string
  orderStatus: 'NONE' | 'PARTIAL' | 'FULL'
}

const ORDER_STATUS_LABEL: Record<string, string> = { NONE: '미발주', PARTIAL: '부분발주', FULL: '발주완료' }
const ORDER_STATUS_COLOR: Record<string, string> = { NONE: '#607d8b', PARTIAL: '#f9a825', FULL: '#2e7d32' }

interface RequestDetail {
  id: string
  requestNo: string
  title: string
  status: string
  requestedBy: string
  notes: string | null
  deliveryRequestedAt: string | null
  submittedAt: string | null
  reviewedAt: string | null
  reviewedBy: string | null
  approvedAt: string | null
  approvedBy: string | null
  rejectedAt: string | null
  rejectedBy: string | null
  rejectReason: string | null
  cancelledAt: string | null
  cancelledBy: string | null
  createdAt: string
  updatedAt: string
  site: { id: string; name: string } | null
  items: RequestItem[]
  history: HistoryEntry[]
}

interface RequestItem {
  id: string
  itemCode: string
  itemName: string
  spec: string | null
  unit: string | null
  disciplineCode: string | null
  requestedQty: string
  approvedQty: string | null
  unitPrice: string | null
  isUrgent: boolean
  allowSubstitute: boolean
  notes: string | null
}

interface HistoryEntry {
  id: string
  fromStatus: string | null
  toStatus: string
  actorId: string
  actorType: string
  reason: string | null
  createdAt: string
}

interface PickerItem {
  materialMasterId: string
  itemCode: string
  itemName: string
  spec: string | null
  unit: string | null
  disciplineCode: string | null
  requestedQty: number
  isUrgent: boolean
  allowSubstitute: boolean
  notes: string
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT:     '작성중',
  SUBMITTED: '제출됨',
  REVIEWED:  '검토됨',
  APPROVED:  '승인됨',
  REJECTED:  '반려됨',
  CANCELLED: '취소됨',
}

const STATUS_COLOR: Record<string, string> = {
  DRAFT:     '#607d8b',
  SUBMITTED: '#f9a825',
  REVIEWED:  '#1565c0',
  APPROVED:  '#2e7d32',
  REJECTED:  '#b71c1c',
  CANCELLED: '#424242',
}

function fmtDate(d: string) {
  return new Date(d).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function fmtDateOnly(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export default function MaterialRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [req, setReq] = useState<RequestDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [showPicker, setShowPicker] = useState(false)
  const [orderableItems, setOrderableItems] = useState<OrderableItem[]>([])
  const [actionLoading, setActionLoading] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editDelivery, setEditDelivery] = useState('')

  const load = () => {
    setLoading(true)
    fetch(`/api/admin/materials/requests/${id}`)
      .then(r => r.json())
      .then(d => {
        if (!d.success) { router.push('/admin/login'); return }
        setReq(d.data)
        if (d.data.status === 'APPROVED') {
          fetch(`/api/admin/materials/requests/${id}/orderable-items`)
            .then(r2 => r2.json())
            .then(d2 => { if (d2.success) setOrderableItems(d2.data.items) })
        }
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id]) // eslint-disable-line

  const handleLogout = () => {
    fetch('/api/admin/auth/logout', { method: 'POST' }).then(() => router.push('/admin/login'))
  }

  const handleAddItem = async (item: PickerItem) => {
    const res = await fetch(`/api/admin/materials/requests/${id}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        materialMasterId: item.materialMasterId,
        itemCode:         item.itemCode,
        itemName:         item.itemName,
        spec:             item.spec,
        unit:             item.unit,
        disciplineCode:   item.disciplineCode,
        requestedQty:     item.requestedQty,
        isUrgent:         item.isUrgent,
        allowSubstitute:  item.allowSubstitute,
        notes:            item.notes || undefined,
      }),
    })
    const d = await res.json()
    if (d.success) {
      setShowPicker(false)
      load()
    } else {
      alert(d.error ?? '품목 추가 실패')
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('이 품목을 삭제하시겠습니까?')) return
    const res = await fetch(`/api/admin/materials/requests/${id}/items/${itemId}`, { method: 'DELETE' })
    const d = await res.json()
    if (d.success) load()
    else alert(d.error ?? '삭제 실패')
  }

  const handleAction = async (action: 'submit' | 'approve' | 'cancel') => {
    const labels: Record<string, string> = { submit: '제출', approve: '승인', cancel: '취소' }
    if (!confirm(`이 청구서를 ${labels[action]}하시겠습니까?`)) return
    setActionLoading(true)
    const res = await fetch(`/api/admin/materials/requests/${id}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const d = await res.json()
    setActionLoading(false)
    if (d.success) load()
    else alert(d.error ?? '처리 실패')
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) { alert('반려 사유를 입력하세요.'); return }
    setActionLoading(true)
    const res = await fetch(`/api/admin/materials/requests/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: rejectReason }),
    })
    const d = await res.json()
    setActionLoading(false)
    if (d.success) { setShowRejectModal(false); setRejectReason(''); load() }
    else alert(d.error ?? '반려 실패')
  }

  const handleSaveEdit = async () => {
    setActionLoading(true)
    const body: Record<string, unknown> = { title: editTitle }
    if (editNotes !== undefined) body.notes = editNotes
    if (editDelivery) body.deliveryRequestedAt = new Date(editDelivery).toISOString()
    else body.deliveryRequestedAt = null
    const res = await fetch(`/api/admin/materials/requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const d = await res.json()
    setActionLoading(false)
    if (d.success) { setEditMode(false); load() }
    else alert(d.error ?? '수정 실패')
  }

  const startEdit = () => {
    if (!req) return
    setEditTitle(req.title)
    setEditNotes(req.notes ?? '')
    setEditDelivery(req.deliveryRequestedAt ? req.deliveryRequestedAt.slice(0, 10) : '')
    setEditMode(true)
  }

  if (loading) return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#1B2838', alignItems: 'center', justifyContent: 'center', color: '#A0AEC0' }}>
      로딩 중...
    </div>
  )

  if (!req) return null

  const isDraft = req.status === 'DRAFT'
  const isEditable = ['DRAFT', 'REJECTED'].includes(req.status)
  const canSubmit = isDraft && req.items.length > 0
  const canApprove = ['SUBMITTED', 'REVIEWED'].includes(req.status)
  const canReject = ['SUBMITTED', 'REVIEWED'].includes(req.status)
  const canCancel = ['DRAFT', 'SUBMITTED'].includes(req.status)

  return (
    <div style={S.layout}>
      <nav style={S.sidebar}>
        <div style={S.sidebarTitle}>해한 출퇴근</div>
        <div style={S.navSection}>관리</div>
        {[
          { href: '/admin', label: '대시보드' },
          { href: '/admin/workers', label: '근로자 관리' },
          { href: '/admin/companies', label: '회사 관리' },
          { href: '/admin/sites', label: '현장 관리' },
          { href: '/admin/attendance', label: '출퇴근 조회' },
          { href: '/admin/materials', label: '자재관리' },
          { href: '/admin/materials/requests', label: '└ 자재청구' },
          { href: '/admin/materials/purchase-orders', label: '└ 발주관리' },
        ].map(item => (
          <Link key={item.href} href={item.href}
            style={item.href === '/admin/materials/requests' ? S.navItemActive : S.navItem}>
            {item.label}
          </Link>
        ))}
        <button onClick={handleLogout} style={S.logoutBtn}>로그아웃</button>
      </nav>

      <main style={S.main}>
        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link href="/admin/materials/requests" style={S.backBtn}>← 목록</Link>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 style={S.pageTitle}>{req.title}</h1>
                <span style={{
                  padding: '3px 10px', borderRadius: '12px', fontSize: '12px',
                  background: STATUS_COLOR[req.status] + '22',
                  color: STATUS_COLOR[req.status],
                  border: `1px solid ${STATUS_COLOR[req.status]}66`,
                }}>
                  {STATUS_LABEL[req.status] ?? req.status}
                </span>
              </div>
              <p style={S.pageDesc}>{req.requestNo} · {req.site?.name ?? '현장 미지정'}</p>
            </div>
          </div>

          {/* 액션 버튼 */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' as const, justifyContent: 'flex-end' }}>
            {isEditable && !editMode && (
              <button onClick={startEdit} style={S.secondaryBtn}>수정</button>
            )}
            {isDraft && (
              <button onClick={() => setShowPicker(true)} style={S.secondaryBtn}>+ 품목 추가</button>
            )}
            {canSubmit && (
              <button onClick={() => handleAction('submit')} disabled={actionLoading} style={S.submitBtn}>
                제출
              </button>
            )}
            {canApprove && (
              <button onClick={() => handleAction('approve')} disabled={actionLoading} style={S.approveBtn}>
                승인
              </button>
            )}
            {canReject && (
              <button onClick={() => setShowRejectModal(true)} disabled={actionLoading} style={S.rejectBtn}>
                반려
              </button>
            )}
            {canCancel && (
              <button onClick={() => handleAction('cancel')} disabled={actionLoading} style={S.cancelBtn}>
                취소
              </button>
            )}
            {req.status === 'APPROVED' && (
              <button
                onClick={() => router.push(`/admin/materials/purchase-orders/new?materialRequestId=${req.id}`)}
                style={S.orderBtn}>
                + 발주 생성
              </button>
            )}
          </div>
        </div>

        {/* 기본 정보 카드 */}
        <div style={S.card}>
          {editMode ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div style={S.formGroup}>
                  <label style={S.label}>제목</label>
                  <input value={editTitle} onChange={e => setEditTitle(e.target.value)} style={S.input} />
                </div>
                <div style={S.formGroup}>
                  <label style={S.label}>납품 요청일</label>
                  <input type="date" value={editDelivery} onChange={e => setEditDelivery(e.target.value)} style={S.input} />
                </div>
                <div style={{ ...S.formGroup, gridColumn: '1 / -1' }}>
                  <label style={S.label}>비고</label>
                  <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={2}
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
              <InfoField label="현장" value={req.site?.name ?? '-'} />
              <InfoField label="납품 요청일" value={req.deliveryRequestedAt ? fmtDateOnly(req.deliveryRequestedAt) : '-'} />
              <InfoField label="작성일" value={fmtDate(req.createdAt)} />
              {req.notes && <InfoField label="비고" value={req.notes} span />}
              {req.rejectReason && <InfoField label="반려 사유" value={req.rejectReason} span warn />}
            </div>
          )}
        </div>

        {/* 품목 목록 */}
        <div style={{ ...S.card, marginTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>
              청구 품목 <span style={{ color: '#A0AEC0', fontWeight: 400 }}>({req.items.length}건)</span>
            </h2>
            {isDraft && (
              <button onClick={() => setShowPicker(true)} style={S.primaryBtn}>+ 품목 추가</button>
            )}
          </div>

          {req.items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#A0AEC0', fontSize: '14px' }}>
              {isDraft ? '품목을 추가하세요.' : '등록된 품목이 없습니다.'}
            </div>
          ) : (
            <table style={S.table}>
              <thead>
                <tr>
                  {['품목코드', '품목명', '규격', '단위', '수량', '공종', '긴급', '대체허용', '비고', isDraft ? '삭제' : ''].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {req.items.map(item => (
                  <tr key={item.id}>
                    <td style={{ ...S.td, fontSize: '12px', color: '#A0AEC0' }}>{item.itemCode}</td>
                    <td style={{ ...S.td, fontWeight: 500 }}>{item.itemName}</td>
                    <td style={S.td}>{item.spec ?? '-'}</td>
                    <td style={S.td}>{item.unit ?? '-'}</td>
                    <td style={{ ...S.td, textAlign: 'right' as const }}>{Number(item.requestedQty).toLocaleString()}</td>
                    <td style={S.td}>{item.disciplineCode ?? '-'}</td>
                    <td style={{ ...S.td, textAlign: 'center' as const }}>
                      {item.isUrgent ? <span style={{ color: '#ef5350', fontSize: '12px' }}>긴급</span> : '-'}
                    </td>
                    <td style={{ ...S.td, textAlign: 'center' as const }}>
                      {item.allowSubstitute ? <span style={{ color: '#66bb6a', fontSize: '12px' }}>허용</span> : '-'}
                    </td>
                    <td style={{ ...S.td, fontSize: '12px', color: '#A0AEC0' }}>{item.notes ?? '-'}</td>
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

        {/* 발주 현황 — APPROVED 상태에서만 표시 */}
        {req.status === 'APPROVED' && orderableItems.length > 0 && (
          <div style={{ ...S.card, marginTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>발주 현황</h2>
              <button
                onClick={() => router.push(`/admin/materials/purchase-orders/new?materialRequestId=${req.id}`)}
                style={S.orderBtn}>
                + 발주 생성
              </button>
            </div>
            <table style={S.table}>
              <thead>
                <tr>
                  {['품목명', '규격', '단위', '청구수량', '발주수량', '잔량', '발주상태'].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orderableItems.map(item => (
                  <tr key={item.id}>
                    <td style={{ ...S.td, fontWeight: 500 }}>{item.itemName}</td>
                    <td style={{ ...S.td, fontSize: '12px', color: '#A0AEC0' }}>{item.spec ?? '-'}</td>
                    <td style={S.td}>{item.unit ?? '-'}</td>
                    <td style={{ ...S.td, textAlign: 'right' as const }}>{Number(item.requestedQty).toLocaleString()}</td>
                    <td style={{ ...S.td, textAlign: 'right' as const, color: '#5BA4D9' }}>{Number(item.orderedQty).toLocaleString()}</td>
                    <td style={{ ...S.td, textAlign: 'right' as const, color: Number(item.remainingQty) <= 0 ? '#607d8b' : '#66bb6a', fontWeight: 600 }}>
                      {Number(item.remainingQty).toLocaleString()}
                    </td>
                    <td style={S.td}>
                      <span style={{
                        padding: '2px 8px', borderRadius: '10px', fontSize: '11px',
                        background: ORDER_STATUS_COLOR[item.orderStatus] + '22',
                        color: ORDER_STATUS_COLOR[item.orderStatus],
                        border: `1px solid ${ORDER_STATUS_COLOR[item.orderStatus]}44`,
                      }}>
                        {ORDER_STATUS_LABEL[item.orderStatus]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 상태 이력 */}
        <div style={{ ...S.card, marginTop: '16px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 16px' }}>상태 이력</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {req.history.map((h, i) => (
              <div key={h.id} style={{
                display: 'flex', gap: '12px', alignItems: 'flex-start',
                padding: '10px 14px', background: i === 0 ? 'rgba(244,121,32,0.06)' : 'rgba(255,255,255,0.02)',
                borderRadius: '6px', border: i === 0 ? '1px solid rgba(244,121,32,0.2)' : '1px solid rgba(91,164,217,0.08)',
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

      {/* 자재 선택 모달 */}
      {showPicker && (
        <MaterialPickerModal
          onAdd={handleAddItem}
          onClose={() => setShowPicker(false)}
        />
      )}

      {/* 반려 모달 */}
      {showRejectModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }}>
          <div style={{ background: '#243144', borderRadius: '10px', padding: '24px', width: '420px', maxWidth: '95vw' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 16px', color: 'white' }}>반려 처리</h3>
            <div style={{ marginBottom: '8px', fontSize: '13px', color: '#A0AEC0' }}>반려 사유 *</div>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={3}
              placeholder="반려 사유를 입력하세요."
              style={{ ...S.input, width: '100%', boxSizing: 'border-box' as const }}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button onClick={() => { setShowRejectModal(false); setRejectReason('') }} style={S.secondaryBtn}>취소</button>
              <button onClick={handleReject} disabled={actionLoading} style={S.rejectBtn}>반려 확정</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoField({ label, value, span, warn }: { label: string; value: string; span?: boolean; warn?: boolean }) {
  return (
    <div style={{ gridColumn: span ? '1 / -1' : undefined }}>
      <div style={{ fontSize: '11px', color: '#A0AEC0', marginBottom: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>{label}</div>
      <div style={{ fontSize: '14px', color: warn ? '#ef5350' : 'white' }}>{value}</div>
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
  backBtn: { color: '#A0AEC0', textDecoration: 'none', fontSize: '13px', padding: '6px 12px', border: '1px solid rgba(91,164,217,0.2)', borderRadius: '4px', whiteSpace: 'nowrap' },
  card: { background: '#243144', borderRadius: '10px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.35)' },
  formGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '12px', color: '#A0AEC0', fontWeight: 500 },
  input: { padding: '9px 12px', border: '1px solid rgba(91,164,217,0.3)', borderRadius: '6px', fontSize: '14px', background: '#1B2838', color: 'white' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '10px 12px', fontSize: '11px', color: '#A0AEC0', borderBottom: '2px solid rgba(91,164,217,0.2)' },
  td: { padding: '10px 12px', fontSize: '13px', borderBottom: '1px solid rgba(91,164,217,0.08)', color: 'white' },
  primaryBtn: { padding: '8px 18px', background: '#F47920', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 },
  secondaryBtn: { padding: '8px 16px', background: 'rgba(255,255,255,0.08)', color: '#A0AEC0', border: '1px solid rgba(91,164,217,0.2)', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' },
  submitBtn: { padding: '8px 18px', background: '#1565c0', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 },
  approveBtn: { padding: '8px 18px', background: '#2e7d32', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 },
  rejectBtn: { padding: '8px 18px', background: '#b71c1c', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 },
  cancelBtn: { padding: '8px 16px', background: 'rgba(255,255,255,0.06)', color: '#607d8b', border: '1px solid rgba(97,125,139,0.3)', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' },
  deleteBtn: { padding: '3px 10px', background: 'rgba(183,28,28,0.15)', color: '#ef5350', border: '1px solid rgba(183,28,28,0.3)', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' },
  orderBtn: { padding: '8px 18px', background: '#0d47a1', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 },
}
