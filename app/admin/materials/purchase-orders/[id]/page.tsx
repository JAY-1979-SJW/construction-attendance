'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Modal } from '@/components/admin/ui'

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
  goodsReceipts: GoodsReceipt[]
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

interface GoodsReceiptItem {
  id: string
  poItemId: string
  quantity: string
  inspectionNote: string | null
  poItem: { id: string; itemNameSnapshot: string; unitSnapshot: string | null }
}

interface GoodsReceipt {
  id: string
  receiptNo: string
  receivedAt: string
  memo: string | null
  createdAt: string
  items: GoodsReceiptItem[]
}

interface ReceiveFormItem {
  poItemId: string
  itemName: string
  unit: string | null
  orderedQuantity: number
  receivedQuantity: number
  quantity: string
  inspectionNote: string
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

export default function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [po, setPo] = useState<PODetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [editMemo, setEditMemo] = useState('')
  const [editDelivery, setEditDelivery] = useState('')
  const [showReceiveModal, setShowReceiveModal] = useState(false)
  const [receiveItems, setReceiveItems] = useState<ReceiveFormItem[]>([])
  const [receiveMemo, setReceiveMemo] = useState('')

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

  const openReceiveModal = () => {
    if (!po) return
    const formItems: ReceiveFormItem[] = po.items
      .filter(item => Number(item.orderedQuantity) > Number(item.receivedQuantity))
      .map(item => ({
        poItemId:         item.id,
        itemName:         item.itemNameSnapshot,
        unit:             item.unitSnapshot,
        orderedQuantity:  Number(item.orderedQuantity),
        receivedQuantity: Number(item.receivedQuantity),
        quantity:         String(Number(item.orderedQuantity) - Number(item.receivedQuantity)),
        inspectionNote:   '',
      }))
    setReceiveItems(formItems)
    setReceiveMemo('')
    setShowReceiveModal(true)
  }

  const handleReceive = async () => {
    const validItems = receiveItems.filter(i => Number(i.quantity) > 0)
    if (validItems.length === 0) { alert('입고 수량을 1개 이상 입력하세요.'); return }
    setActionLoading(true)
    const res = await fetch(`/api/admin/materials/purchase-orders/${id}/receive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: validItems.map(i => ({
          poItemId:       i.poItemId,
          quantity:       Number(i.quantity),
          inspectionNote: i.inspectionNote || undefined,
        })),
        memo: receiveMemo || undefined,
      }),
    })
    const d = await res.json()
    setActionLoading(false)
    if (d.success) {
      setShowReceiveModal(false)
      load()
    } else {
      alert(d.error ?? d.message ?? '입고 처리 실패')
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('이 항목을 삭제하시겠습니까?')) return
    const res = await fetch(`/api/admin/materials/purchase-orders/${id}/items/${itemId}`, { method: 'DELETE' })
    const d = await res.json()
    if (d.success) load()
    else alert(d.error ?? d.message ?? '삭제 실패')
  }

  if (loading) return (
    <div className="p-8 text-muted-brand">
      로딩 중...
    </div>
  )
  if (!po) return null

  const isDraft = po.status === 'DRAFT'
  const canIssue = isDraft
  const canCancel = ['DRAFT', 'ISSUED'].includes(po.status)
  const canReceive = ['ISSUED', 'PARTIALLY_RECEIVED'].includes(po.status)

  return (
    <div className="p-8 overflow-x-auto">
        {/* 헤더 */}
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-3">
            <Link href="/admin/materials/purchase-orders" className="text-muted-brand no-underline text-[13px] px-3 py-[6px] border border-[rgba(91,164,217,0.2)] rounded whitespace-nowrap">← 목록</Link>
            <div>
              <div className="flex items-center gap-[10px]">
                <h1 className="text-[22px] font-bold m-0">{po.orderNo}</h1>
                <span style={{
                  padding: '3px 10px', borderRadius: '12px', fontSize: '12px',
                  background: STATUS_COLOR[po.status] + '22',
                  color: STATUS_COLOR[po.status],
                  border: `1px solid ${STATUS_COLOR[po.status]}66`,
                }}>
                  {STATUS_LABEL[po.status] ?? po.status}
                </span>
              </div>
              <p className="text-[13px] text-muted-brand mt-1 mb-0">
                청구서: {po.materialRequest.requestNo} — {po.materialRequest.title}
              </p>
            </div>
          </div>

          <div className="flex gap-2 items-center flex-wrap justify-end">
            {isDraft && !editMode && (
              <button onClick={startEdit} className="px-4 py-2 bg-white/[0.08] text-muted-brand border border-[rgba(91,164,217,0.2)] rounded-md cursor-pointer text-[13px]">수정</button>
            )}
            {canIssue && (
              <button onClick={handleIssue} disabled={actionLoading} className="px-[18px] py-2 bg-[#1565c0] text-white border-0 rounded-md cursor-pointer text-[13px] font-semibold">발행</button>
            )}
            {canReceive && (
              <button onClick={openReceiveModal} disabled={actionLoading} className="px-[18px] py-2 bg-[#2e7d32] text-white border-0 rounded-md cursor-pointer text-[13px] font-semibold">입고처리</button>
            )}
            {canCancel && (
              <button onClick={() => setShowCancelModal(true)} disabled={actionLoading} className="px-4 py-2 bg-[rgba(183,28,28,0.15)] text-[#ef5350] border border-[rgba(183,28,28,0.3)] rounded-md cursor-pointer text-[13px]">취소</button>
            )}
          </div>
        </div>

        {/* 기본 정보 카드 */}
        <div className="bg-card rounded-[12px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          {editMode ? (
            <div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div className="flex flex-col gap-[6px]">
                  <label className="text-[12px] text-muted-brand font-medium">납품 요청일</label>
                  <input type="date" value={editDelivery} onChange={e => setEditDelivery(e.target.value)} className="px-3 py-[9px] border border-[rgba(91,164,217,0.3)] rounded-md text-sm bg-brand text-white" />
                </div>
                <div className="flex flex-col gap-[6px] col-span-2">
                  <label className="text-[12px] text-muted-brand font-medium">메모</label>
                  <textarea value={editMemo} onChange={e => setEditMemo(e.target.value)} rows={2}
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
        <div className="bg-card rounded-[12px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)] mt-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-[15px] font-semibold m-0">
              발주 품목 <span className="text-muted-brand font-normal">({po.items.length}건)</span>
            </h2>
          </div>

          {po.items.length === 0 ? (
            <div className="text-center py-8 text-muted-brand text-sm">
              발주 항목이 없습니다.
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {['품목명', '규격', '단위', '청구수량', '발주수량', '입고수량', '비고', isDraft ? '삭제' : ''].map(h => (
                    <th key={h} className="text-left px-3 py-[10px] text-[11px] text-muted-brand border-b-2 border-[rgba(91,164,217,0.2)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {po.items.map(item => (
                  <tr key={item.id}>
                    <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.08)] text-white font-medium">{item.itemNameSnapshot}</td>
                    <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.08)] text-white text-[12px] text-muted-brand">{item.specSnapshot ?? '-'}</td>
                    <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.08)] text-white">{item.unitSnapshot ?? '-'}</td>
                    <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.08)] text-white text-right text-muted-brand">{Number(item.requestQuantitySnapshot).toLocaleString()}</td>
                    <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.08)] text-white text-right font-semibold">{Number(item.orderedQuantity).toLocaleString()}</td>
                    <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.08)] text-white text-right text-[#66bb6a]">{Number(item.receivedQuantity).toLocaleString()}</td>
                    <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.08)] text-white text-[12px] text-muted-brand">{item.note ?? '-'}</td>
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
        </div>

        {/* 입고 이력 */}
        {po.goodsReceipts.length > 0 && (
          <div className="bg-card rounded-[12px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)] mt-4">
            <h2 className="text-[15px] font-semibold m-0 mb-4">
              입고 이력 <span className="text-muted-brand font-normal">({po.goodsReceipts.length}건)</span>
            </h2>
            <div className="flex flex-col gap-3">
              {po.goodsReceipts.map(gr => (
                <div key={gr.id} className="border border-[rgba(46,125,50,0.3)] rounded-md p-4 bg-[rgba(46,125,50,0.04)]">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[13px] font-semibold text-[#66bb6a]">{gr.receiptNo}</span>
                    <span className="text-[12px] text-muted-brand">{fmtDate(gr.receivedAt)}</span>
                  </div>
                  {gr.memo && <div className="text-[12px] text-muted-brand mb-2">{gr.memo}</div>}
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        {['품목명', '단위', '입고수량', '검수메모'].map(h => (
                          <th key={h} className="text-left px-2 py-[6px] text-[11px] text-muted-brand border-b border-[rgba(91,164,217,0.12)]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {gr.items.map(item => (
                        <tr key={item.id}>
                          <td className="px-2 py-[6px] text-[12px] text-white border-b border-[rgba(91,164,217,0.06)]">{item.poItem.itemNameSnapshot}</td>
                          <td className="px-2 py-[6px] text-[12px] text-muted-brand border-b border-[rgba(91,164,217,0.06)]">{item.poItem.unitSnapshot ?? '-'}</td>
                          <td className="px-2 py-[6px] text-[12px] text-[#66bb6a] font-semibold border-b border-[rgba(91,164,217,0.06)] text-right">{Number(item.quantity).toLocaleString()}</td>
                          <td className="px-2 py-[6px] text-[12px] text-muted-brand border-b border-[rgba(91,164,217,0.06)]">{item.inspectionNote ?? '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 상태 이력 */}
        <div className="bg-card rounded-[12px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)] mt-4">
          <h2 className="text-[15px] font-semibold m-0 mb-4">상태 이력</h2>
          <div className="flex flex-col gap-2">
            {po.history.map((h, i) => (
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

      {/* 취소 모달 */}
      <Modal open={showCancelModal} onClose={() => { setShowCancelModal(false); setCancelReason('') }} title="발주 취소">
            <div className="mb-2 text-[13px] text-muted-brand">취소 사유 (선택)</div>
            <textarea
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              rows={3}
              placeholder="취소 사유를 입력하세요 (선택)."
              className="w-full px-3 py-[9px] border border-[rgba(91,164,217,0.3)] rounded-md text-sm bg-brand text-white box-border"
            />
            <div className="flex gap-2 justify-end mt-4">
              <button onClick={() => { setShowCancelModal(false); setCancelReason('') }} className="px-4 py-2 bg-white/[0.08] text-muted-brand border border-[rgba(91,164,217,0.2)] rounded-md cursor-pointer text-[13px]">닫기</button>
              <button onClick={handleCancel} disabled={actionLoading} className="px-4 py-2 bg-[rgba(183,28,28,0.15)] text-[#ef5350] border border-[rgba(183,28,28,0.3)] rounded-md cursor-pointer text-[13px]">취소 확정</button>
            </div>
      </Modal>

      {/* 입고 처리 모달 */}
      <Modal open={showReceiveModal} onClose={() => setShowReceiveModal(false)} title="입고 처리" width={680}>
            <div className="overflow-y-auto flex-1">
              <table className="w-full border-collapse mb-4">
                <thead>
                  <tr>
                    {['품목명', '단위', '발주수량', '기입고', '잔량', '이번입고수량', '검수메모'].map(h => (
                      <th key={h} className="text-left px-2 py-[8px] text-[11px] text-muted-brand border-b border-[rgba(91,164,217,0.2)]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {receiveItems.map((item, idx) => {
                    const remaining = item.orderedQuantity - item.receivedQuantity
                    return (
                      <tr key={item.poItemId}>
                        <td className="px-2 py-[8px] text-[12px] text-white border-b border-[rgba(91,164,217,0.06)]">{item.itemName}</td>
                        <td className="px-2 py-[8px] text-[12px] text-muted-brand border-b border-[rgba(91,164,217,0.06)]">{item.unit ?? '-'}</td>
                        <td className="px-2 py-[8px] text-[12px] text-white text-right border-b border-[rgba(91,164,217,0.06)]">{item.orderedQuantity.toLocaleString()}</td>
                        <td className="px-2 py-[8px] text-[12px] text-muted-brand text-right border-b border-[rgba(91,164,217,0.06)]">{item.receivedQuantity.toLocaleString()}</td>
                        <td className="px-2 py-[8px] text-[12px] text-[#66bb6a] text-right border-b border-[rgba(91,164,217,0.06)] font-semibold">{remaining.toLocaleString()}</td>
                        <td className="px-2 py-[8px] border-b border-[rgba(91,164,217,0.06)]">
                          <input
                            type="number"
                            min={0}
                            max={remaining}
                            step="any"
                            value={item.quantity}
                            onChange={e => {
                              const updated = [...receiveItems]
                              updated[idx] = { ...updated[idx], quantity: e.target.value }
                              setReceiveItems(updated)
                            }}
                            className="w-[80px] px-2 py-[5px] border border-[rgba(91,164,217,0.3)] rounded text-[12px] bg-brand text-white text-right"
                          />
                        </td>
                        <td className="px-2 py-[8px] border-b border-[rgba(91,164,217,0.06)]">
                          <input
                            type="text"
                            value={item.inspectionNote}
                            onChange={e => {
                              const updated = [...receiveItems]
                              updated[idx] = { ...updated[idx], inspectionNote: e.target.value }
                              setReceiveItems(updated)
                            }}
                            placeholder="선택"
                            className="w-full px-2 py-[5px] border border-[rgba(91,164,217,0.3)] rounded text-[12px] bg-brand text-white"
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              <div className="flex flex-col gap-[6px]">
                <label className="text-[12px] text-muted-brand">메모 (선택)</label>
                <textarea
                  value={receiveMemo}
                  onChange={e => setReceiveMemo(e.target.value)}
                  rows={2}
                  placeholder="입고 메모를 입력하세요."
                  className="px-3 py-[9px] border border-[rgba(91,164,217,0.3)] rounded-md text-sm bg-brand text-white resize-none"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-4 pt-4 border-t border-[rgba(91,164,217,0.12)]">
              <button onClick={() => setShowReceiveModal(false)} className="px-4 py-2 bg-white/[0.08] text-muted-brand border border-[rgba(91,164,217,0.2)] rounded-md cursor-pointer text-[13px]">닫기</button>
              <button onClick={handleReceive} disabled={actionLoading} className="px-[18px] py-2 bg-[#2e7d32] text-white border-0 rounded-md cursor-pointer text-[13px] font-semibold">입고 확정</button>
            </div>
      </Modal>
    </div>
  )
}

function InfoField({ label, value, span }: { label: string; value: string; span?: boolean }) {
  return (
    <div className={span ? 'col-span-3' : undefined}>
      <div className="text-[11px] text-muted-brand mb-1 uppercase tracking-[0.5px]">{label}</div>
      <div className="text-sm text-white">{value}</div>
    </div>
  )
}
