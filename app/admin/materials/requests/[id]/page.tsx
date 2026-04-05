'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import MaterialPickerModal from '@/components/admin/MaterialPickerModal'
import { Modal, MobileCardList, MobileCard, MobileCardField, MobileCardFields, MobileCardActions } from '@/components/admin/ui'

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
  SUBMITTED: '요청',
  REVIEWED:  '검토중',
  APPROVED:  '승인',
  ORDERED:   '발주완료',
  RECEIVED:  '입고완료',
  REJECTED:  '반려',
  CANCELLED: '취소',
}

const STATUS_COLOR: Record<string, string> = {
  DRAFT:     '#607d8b',
  SUBMITTED: '#f9a825',
  REVIEWED:  '#1565c0',
  APPROVED:  '#2e7d32',
  ORDERED:   '#6a1b9a',
  RECEIVED:  '#00695c',
  REJECTED:  '#b71c1c',
  CANCELLED: '#424242',
}

function fmtDate(d: string) {
  return new Date(d).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function fmtDateOnly(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export default function MaterialRequestDetailPage() {
  const { id } = useParams<{ id: string }>()
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
      alert(d.message ?? '품목 추가 실패')
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('이 품목을 삭제하시겠습니까?')) return
    const res = await fetch(`/api/admin/materials/requests/${id}/items/${itemId}`, { method: 'DELETE' })
    const d = await res.json()
    if (d.success) load()
    else alert(d.message ?? '삭제 실패')
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
    else alert(d.message ?? '처리 실패')
  }

  const handleStatusChange = async (toStatus: string) => {
    const labels: Record<string, string> = { REVIEWED: '검토중', APPROVED: '승인', ORDERED: '발주완료', RECEIVED: '입고완료' }
    if (!confirm(`${labels[toStatus] ?? toStatus}으로 변경하시겠습니까?`)) return
    setActionLoading(true)
    const res = await fetch(`/api/admin/materials/requests/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toStatus }),
    })
    const d = await res.json()
    setActionLoading(false)
    if (d.success) load()
    else alert(d.message ?? '상태 변경 실패')
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
    else alert(d.message ?? '반려 실패')
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
    else alert(d.message ?? '수정 실패')
  }

  const startEdit = () => {
    if (!req) return
    setEditTitle(req.title)
    setEditNotes(req.notes ?? '')
    setEditDelivery(req.deliveryRequestedAt ? req.deliveryRequestedAt.slice(0, 10) : '')
    setEditMode(true)
  }

  if (loading) return (
    <div className="p-8 text-muted-brand">
      로딩 중...
    </div>
  )

  if (!req) return null

  const isDraft = req.status === 'DRAFT'
  const isEditable = ['DRAFT', 'REJECTED'].includes(req.status)
  const canSubmit = isDraft && req.items.length > 0
  const canReview = req.status === 'SUBMITTED'
  const canApprove = ['SUBMITTED', 'REVIEWED'].includes(req.status)
  const canReject = ['SUBMITTED', 'REVIEWED'].includes(req.status)
  const canCancel = ['DRAFT', 'SUBMITTED'].includes(req.status)
  const canOrder = req.status === 'APPROVED'
  const canReceive = req.status === 'ORDERED'

  return (
    <div className="p-4 sm:p-8 overflow-x-auto">
        {/* 헤더 */}
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-3">
            <Link href="/admin/materials/requests" className="text-muted-brand no-underline text-[13px] px-3 py-[6px] border border-[rgba(91,164,217,0.2)] rounded whitespace-nowrap">← 목록</Link>
            <div>
              <div className="flex items-center gap-[10px]">
                <h1 className="text-[22px] font-bold m-0">{req.title}</h1>
                <span style={{
                  padding: '3px 10px', borderRadius: '12px', fontSize: '12px',
                  background: STATUS_COLOR[req.status] + '22',
                  color: STATUS_COLOR[req.status],
                  border: `1px solid ${STATUS_COLOR[req.status]}66`,
                }}>
                  {STATUS_LABEL[req.status] ?? req.status}
                </span>
              </div>
              <p className="text-[13px] text-muted-brand mt-1 mb-0">{req.requestNo} · {req.site?.name ?? '현장 미지정'}</p>
            </div>
          </div>

          {/* 액션 버튼 */}
          <div className="flex gap-2 items-center flex-wrap justify-end">
            {isEditable && !editMode && (
              <button onClick={startEdit} className="px-4 py-2 bg-white/[0.08] text-muted-brand border border-[rgba(91,164,217,0.2)] rounded-md cursor-pointer text-[13px]">수정</button>
            )}
            {isDraft && (
              <button onClick={() => setShowPicker(true)} className="px-4 py-2 bg-white/[0.08] text-muted-brand border border-[rgba(91,164,217,0.2)] rounded-md cursor-pointer text-[13px]">+ 품목 추가</button>
            )}
            {canSubmit && (
              <button onClick={() => handleAction('submit')} disabled={actionLoading} className="px-[18px] py-2 bg-[#1565c0] text-white border-0 rounded-md cursor-pointer text-[13px] font-semibold">제출</button>
            )}
            {canReview && (
              <button onClick={() => handleStatusChange('REVIEWED')} disabled={actionLoading} className="px-[18px] py-2 bg-[#1565c0] text-white border-0 rounded-md cursor-pointer text-[13px] font-semibold">검토중</button>
            )}
            {canApprove && (
              <button onClick={() => handleStatusChange('APPROVED')} disabled={actionLoading} className="px-[18px] py-2 bg-[#2e7d32] text-white border-0 rounded-md cursor-pointer text-[13px] font-semibold">승인</button>
            )}
            {canOrder && (
              <button onClick={() => handleStatusChange('ORDERED')} disabled={actionLoading} className="px-[18px] py-2 bg-[#6a1b9a] text-white border-0 rounded-md cursor-pointer text-[13px] font-semibold">발주완료</button>
            )}
            {canReceive && (
              <button onClick={() => handleStatusChange('RECEIVED')} disabled={actionLoading} className="px-[18px] py-2 bg-[#00695c] text-white border-0 rounded-md cursor-pointer text-[13px] font-semibold">입고완료</button>
            )}
            {canReject && (
              <button onClick={() => setShowRejectModal(true)} disabled={actionLoading} className="px-[18px] py-2 bg-[#b71c1c] text-white border-0 rounded-md cursor-pointer text-[13px] font-semibold">반려</button>
            )}
            {canCancel && (
              <button onClick={() => handleAction('cancel')} disabled={actionLoading} className="px-4 py-2 bg-white/[0.06] text-[#607d8b] border border-[rgba(97,125,139,0.3)] rounded-md cursor-pointer text-[13px]">취소</button>
            )}
          </div>
        </div>

        {/* 기본 정보 카드 */}
        <div className="bg-card rounded-[12px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          {editMode ? (
            <div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div className="flex flex-col gap-[6px]">
                  <label className="text-[12px] text-muted-brand font-medium">제목</label>
                  <input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="px-3 py-[9px] border border-[rgba(91,164,217,0.3)] rounded-md text-sm bg-brand text-white" />
                </div>
                <div className="flex flex-col gap-[6px]">
                  <label className="text-[12px] text-muted-brand font-medium">납품 요청일</label>
                  <input type="date" value={editDelivery} onChange={e => setEditDelivery(e.target.value)} className="px-3 py-[9px] border border-[rgba(91,164,217,0.3)] rounded-md text-sm bg-brand text-white" />
                </div>
                <div className="flex flex-col gap-[6px] col-span-2">
                  <label className="text-[12px] text-muted-brand font-medium">비고</label>
                  <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={2}
                    className="px-3 py-[9px] border border-[rgba(91,164,217,0.3)] rounded-md text-sm bg-brand text-white resize-y" />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setEditMode(false)} className="px-4 py-2 bg-white/[0.08] text-muted-brand border border-[rgba(91,164,217,0.2)] rounded-md cursor-pointer text-[13px]">취소</button>
                <button onClick={handleSaveEdit} disabled={actionLoading} className="px-[18px] py-2 bg-brand-accent text-white border-0 rounded-md cursor-pointer text-[13px] font-semibold">저장</button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <InfoField label="현장" value={req.site?.name ?? '-'} />
              <InfoField label="납품 요청일" value={req.deliveryRequestedAt ? fmtDateOnly(req.deliveryRequestedAt) : '-'} />
              <InfoField label="작성일" value={fmtDate(req.createdAt)} />
              {req.notes && <InfoField label="비고" value={req.notes} span />}
              {req.rejectReason && <InfoField label="반려 사유" value={req.rejectReason} span warn />}
            </div>
          )}
        </div>

        {/* 품목 목록 */}
        <div className="bg-card rounded-[12px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)] mt-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-[15px] font-semibold m-0">
              청구 품목 <span className="text-muted-brand font-normal">({req.items.length}건)</span>
            </h2>
            {isDraft && (
              <button onClick={() => setShowPicker(true)} className="px-[18px] py-2 bg-brand-accent text-white border-0 rounded-md cursor-pointer text-[13px] font-semibold">+ 품목 추가</button>
            )}
          </div>

          {req.items.length === 0 ? (
            <div className="text-center py-10 text-muted-brand text-sm">
              {isDraft ? '품목을 추가하세요.' : '등록된 품목이 없습니다.'}
            </div>
          ) : (
            <MobileCardList
              items={req.items}
              keyExtractor={(item) => item.id}
              emptyMessage="등록된 품목이 없습니다."
              renderCard={(item) => (
                <MobileCard
                  title={item.itemName}
                  subtitle={item.itemCode}
                  badge={item.isUrgent ? <span className="text-[11px] text-[#ef5350] bg-[rgba(183,28,28,0.1)] px-2 py-0.5 rounded">긴급</span> : undefined}
                >
                  <MobileCardFields>
                    {item.spec && <MobileCardField label="규격" value={item.spec} />}
                    <MobileCardField label="단위" value={item.unit ?? '-'} />
                    <MobileCardField label="수량" value={Number(item.requestedQty).toLocaleString()} />
                    {item.disciplineCode && <MobileCardField label="공종" value={item.disciplineCode} />}
                    {item.allowSubstitute && <MobileCardField label="대체" value="허용" />}
                    {item.notes && <MobileCardField label="비고" value={item.notes} />}
                  </MobileCardFields>
                  {isDraft && (
                    <MobileCardActions>
                      <button onClick={() => handleDeleteItem(item.id)} className="px-[10px] py-[3px] bg-[rgba(183,28,28,0.15)] text-[#ef5350] border border-[rgba(183,28,28,0.3)] rounded cursor-pointer text-[12px]">삭제</button>
                    </MobileCardActions>
                  )}
                </MobileCard>
              )}
              renderTable={() => (
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      {['품목코드', '품목명', '규격', '단위', '수량', '공종', '긴급', '대체허용', '비고', isDraft ? '삭제' : ''].map(h => (
                        <th key={h} className="text-left px-3 py-[10px] text-[11px] text-muted-brand border-b-2 border-[rgba(91,164,217,0.2)]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {req.items.map(item => (
                      <tr key={item.id}>
                        <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.08)] text-white text-[12px] text-muted-brand">{item.itemCode}</td>
                        <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.08)] text-white font-medium">{item.itemName}</td>
                        <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.08)] text-white">{item.spec ?? '-'}</td>
                        <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.08)] text-white">{item.unit ?? '-'}</td>
                        <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.08)] text-white text-right">{Number(item.requestedQty).toLocaleString()}</td>
                        <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.08)] text-white">{item.disciplineCode ?? '-'}</td>
                        <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.08)] text-white text-center">
                          {item.isUrgent ? <span className="text-[#ef5350] text-[12px]">긴급</span> : '-'}
                        </td>
                        <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.08)] text-white text-center">
                          {item.allowSubstitute ? <span className="text-[#66bb6a] text-[12px]">허용</span> : '-'}
                        </td>
                        <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.08)] text-white text-[12px] text-muted-brand">{item.notes ?? '-'}</td>
                        {isDraft && (
                          <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.08)] text-white">
                            <button onClick={() => handleDeleteItem(item.id)} className="px-[10px] py-[3px] bg-[rgba(183,28,28,0.15)] text-[#ef5350] border border-[rgba(183,28,28,0.3)] rounded cursor-pointer text-[12px]">삭제</button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            />
          )}
        </div>

        {/* 발주 현황 — APPROVED 상태에서만 표시 */}
        {req.status === 'APPROVED' && orderableItems.length > 0 && (
          <div className="bg-card rounded-[12px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)] mt-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-[15px] font-semibold m-0">발주 현황</h2>
              <button
                onClick={() => router.push(`/admin/materials/purchase-orders/new?materialRequestId=${req.id}`)}
                className="px-[18px] py-2 bg-[#0d47a1] text-white border-0 rounded-md cursor-pointer text-[13px] font-semibold">
                + 발주 생성
              </button>
            </div>
            <MobileCardList
              items={orderableItems}
              keyExtractor={(item) => item.id}
              emptyMessage="발주 품목이 없습니다."
              renderCard={(item) => (
                <MobileCard
                  title={item.itemName}
                  subtitle={item.spec ?? undefined}
                  badge={
                    <span style={{
                      padding: '2px 8px', borderRadius: '10px', fontSize: '11px',
                      background: ORDER_STATUS_COLOR[item.orderStatus] + '22',
                      color: ORDER_STATUS_COLOR[item.orderStatus],
                      border: `1px solid ${ORDER_STATUS_COLOR[item.orderStatus]}44`,
                    }}>
                      {ORDER_STATUS_LABEL[item.orderStatus]}
                    </span>
                  }
                >
                  <MobileCardFields>
                    <MobileCardField label="단위" value={item.unit ?? '-'} />
                    <MobileCardField label="청구수량" value={Number(item.requestedQty).toLocaleString()} />
                    <MobileCardField label="발주수량" value={Number(item.orderedQty).toLocaleString()} />
                    <MobileCardField label="잔량" value={
                      <span style={{ color: Number(item.remainingQty) <= 0 ? '#607d8b' : '#66bb6a', fontWeight: 600 }}>
                        {Number(item.remainingQty).toLocaleString()}
                      </span>
                    } />
                  </MobileCardFields>
                </MobileCard>
              )}
              renderTable={() => (
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      {['품목명', '규격', '단위', '청구수량', '발주수량', '잔량', '발주상태'].map(h => (
                        <th key={h} className="text-left px-3 py-[10px] text-[11px] text-muted-brand border-b-2 border-[rgba(91,164,217,0.2)]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {orderableItems.map(item => (
                      <tr key={item.id}>
                        <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.08)] text-white font-medium">{item.itemName}</td>
                        <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.08)] text-white text-[12px] text-muted-brand">{item.spec ?? '-'}</td>
                        <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.08)] text-white">{item.unit ?? '-'}</td>
                        <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.08)] text-white text-right">{Number(item.requestedQty).toLocaleString()}</td>
                        <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.08)] text-white text-right text-secondary-brand">{Number(item.orderedQty).toLocaleString()}</td>
                        <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.08)] text-white text-right font-semibold"
                          style={{ color: Number(item.remainingQty) <= 0 ? '#607d8b' : '#66bb6a' }}>
                          {Number(item.remainingQty).toLocaleString()}
                        </td>
                        <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.08)] text-white">
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
              )}
            />
          </div>
        )}

        {/* 상태 이력 */}
        <div className="bg-card rounded-[12px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)] mt-4">
          <h2 className="text-[15px] font-semibold m-0 mb-4">상태 이력</h2>
          <div className="flex flex-col gap-2">
            {req.history.map((h, i) => (
              <div key={h.id} className="flex gap-3 items-start px-[14px] py-[10px] rounded-md"
                style={{
                  background: i === 0 ? 'rgba(244,121,32,0.06)' : 'rgba(255,255,255,0.02)',
                  border: i === 0 ? '1px solid rgba(244,121,32,0.2)' : '1px solid rgba(91,164,217,0.08)',
                }}>
                <div className="min-w-[6px] h-[6px] rounded-full mt-[5px]" style={{ background: STATUS_COLOR[h.toStatus] ?? '#607d8b' }} />
                <div className="flex-1">
                  <div className="flex gap-2 items-center flex-wrap">
                    {h.fromStatus && (
                      <>
                        <span className="text-[12px] text-muted-brand">{STATUS_LABEL[h.fromStatus] ?? h.fromStatus}</span>
                        <span className="text-[11px] text-[#4a5568]">→</span>
                      </>
                    )}
                    <span className="text-[13px] font-semibold" style={{ color: STATUS_COLOR[h.toStatus] ?? 'white' }}>
                      {STATUS_LABEL[h.toStatus] ?? h.toStatus}
                    </span>
                    <span className="text-[11px] text-muted-brand">{fmtDate(h.createdAt)}</span>
                  </div>
                  {h.reason && <div className="text-[12px] text-muted-brand mt-1">{h.reason}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>

      {/* 자재 선택 모달 */}
      {showPicker && (
        <MaterialPickerModal
          onAdd={handleAddItem}
          onClose={() => setShowPicker(false)}
        />
      )}

      {/* 반려 모달 */}
      <Modal open={showRejectModal} onClose={() => { setShowRejectModal(false); setRejectReason('') }} title="반려 처리">
            <div className="mb-2 text-[13px] text-muted-brand">반려 사유 *</div>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={3}
              placeholder="반려 사유를 입력하세요."
              className="w-full px-3 py-[9px] border border-[rgba(91,164,217,0.3)] rounded-md text-sm bg-brand text-white box-border"
            />
            <div className="flex gap-2 justify-end mt-4">
              <button onClick={() => { setShowRejectModal(false); setRejectReason('') }} className="px-4 py-2 bg-white/[0.08] text-muted-brand border border-[rgba(91,164,217,0.2)] rounded-md cursor-pointer text-[13px]">취소</button>
              <button onClick={handleReject} disabled={actionLoading} className="px-[18px] py-2 bg-[#b71c1c] text-white border-0 rounded-md cursor-pointer text-[13px] font-semibold">반려 확정</button>
            </div>
      </Modal>
    </div>
  )
}

function InfoField({ label, value, span, warn }: { label: string; value: string; span?: boolean; warn?: boolean }) {
  return (
    <div className={span ? 'col-span-3' : undefined}>
      <div className="text-[11px] text-muted-brand mb-1 uppercase tracking-[0.5px]">{label}</div>
      <div className="text-sm" style={{ color: warn ? '#ef5350' : 'white' }}>{value}</div>
    </div>
  )
}
