'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface OrderableItem {
  id: string
  itemCode: string
  itemName: string
  spec: string | null
  unit: string | null
  requestedQty: string
  orderedQty: string
  remainingQty: string
  orderStatus: 'NONE' | 'PARTIAL' | 'FULL'
  isUrgent: boolean
}

interface RequestInfo {
  id: string
  requestNo: string
  title: string
  status: string
}

const ORDER_STATUS_LABEL: Record<string, string> = {
  NONE:    '미발주',
  PARTIAL: '부분발주',
  FULL:    '발주완료',
}
const ORDER_STATUS_COLOR: Record<string, string> = {
  NONE:    '#607d8b',
  PARTIAL: '#f9a825',
  FULL:    '#2e7d32',
}

function NewPurchaseOrderInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const materialRequestId = searchParams.get('materialRequestId') ?? ''

  const [requestInfo, setRequestInfo] = useState<RequestInfo | null>(null)
  const [orderableItems, setOrderableItems] = useState<OrderableItem[]>([])
  const [selected, setSelected] = useState<Record<string, { checked: boolean; qty: string }>>({})
  const [memo, setMemo] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!materialRequestId) return
    fetch(`/api/admin/materials/requests/${materialRequestId}/orderable-items`)
      .then(r => r.json())
      .then(d => {
        if (!d.success) return
        setRequestInfo(d.data.request)
        setOrderableItems(d.data.items)
        const initSel: Record<string, { checked: boolean; qty: string }> = {}
        d.data.items.forEach((item: OrderableItem) => {
          const remaining = parseFloat(item.remainingQty)
          initSel[item.id] = {
            checked: remaining > 0,
            qty: remaining > 0 ? String(remaining) : '0',
          }
        })
        setSelected(initSel)
      })
      .finally(() => setLoading(false))
  }, [materialRequestId])

  const handleLogout = () => {
    fetch('/api/admin/auth/logout', { method: 'POST' }).then(() => router.push('/admin/login'))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const items = orderableItems
      .filter(item => selected[item.id]?.checked)
      .map(item => ({
        materialRequestItemId: item.id,
        orderedQuantity: parseFloat(selected[item.id]?.qty ?? '0'),
      }))
      .filter(item => item.orderedQuantity > 0)

    if (items.length === 0) { setError('항목을 1개 이상 선택하세요.'); return }

    // 과발주 검증
    for (const item of items) {
      const orig = orderableItems.find(i => i.id === item.materialRequestItemId)
      if (orig && item.orderedQuantity > parseFloat(orig.remainingQty)) {
        setError(`"${orig.itemName}" 발주 수량이 잔량(${orig.remainingQty})을 초과합니다.`)
        return
      }
    }

    setSubmitting(true)
    try {
      const body: Record<string, unknown> = { materialRequestId, items }
      if (memo.trim()) body.memo = memo.trim()
      if (deliveryDate) body.deliveryRequestedDate = deliveryDate

      const res = await fetch('/api/admin/materials/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await res.json()
      if (!d.success) { setError(d.error ?? d.message ?? '생성 실패'); return }
      router.push(`/admin/materials/purchase-orders/${d.data.id}`)
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!materialRequestId) {
    return (
      <div className="p-8 text-muted-brand">
        청구서 ID가 필요합니다.
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-8 overflow-x-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/admin/materials/purchase-orders" className="text-muted-brand no-underline text-[13px] px-3 py-[6px] border border-[rgba(91,164,217,0.2)] rounded whitespace-nowrap">← 목록</Link>
          <div>
            <h1 className="text-[22px] font-bold m-0">발주서 작성</h1>
            {requestInfo && (
              <p className="text-[13px] text-muted-brand mt-1 mb-0">
                청구서: {requestInfo.requestNo} — {requestInfo.title}
              </p>
            )}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-brand">로딩 중...</div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* 기본 정보 */}
            <div className="bg-card rounded-[12px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
              <div className="text-sm font-semibold mb-4 text-white">발주 정보</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-[6px]">
                  <label className="text-[12px] text-muted-brand font-medium">납품 요청일</label>
                  <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} className="px-3 py-[9px] border border-[rgba(91,164,217,0.3)] rounded-md text-sm bg-brand text-white" />
                </div>
                <div className="flex flex-col gap-[6px] col-span-2">
                  <label className="text-[12px] text-muted-brand font-medium">메모</label>
                  <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={2}
                    className="px-3 py-[9px] border border-[rgba(91,164,217,0.3)] rounded-md text-sm bg-brand text-white resize-y" placeholder="발주 관련 메모 (선택)" />
                </div>
              </div>
            </div>

            {/* 품목 선택 */}
            <div className="bg-card rounded-[12px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)] mt-4">
              <div className="text-sm font-semibold mb-4 text-white">
                발주 품목 선택
                <span className="text-[12px] text-muted-brand font-normal ml-2">
                  잔량 0 항목은 선택 불가
                </span>
              </div>
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {['선택', '품목명', '규격', '단위', '요청수량', '기발주', '잔량', '발주수량', '상태'].map(h => (
                      <th key={h} className="text-left px-3 py-2 text-[11px] text-muted-brand border-b-2 border-[rgba(91,164,217,0.2)]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orderableItems.map(item => {
                    const remaining = parseFloat(item.remainingQty)
                    const isDisabled = remaining <= 0
                    const sel = selected[item.id]
                    const qtyNum = parseFloat(sel?.qty ?? '0')
                    const isOver = qtyNum > remaining

                    return (
                      <tr key={item.id} style={{
                        opacity: isDisabled ? 0.4 : 1,
                        background: sel?.checked && !isDisabled ? 'rgba(244,121,32,0.06)' : 'transparent',
                      }}>
                        <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.08)] text-white text-center">
                          <input
                            type="checkbox"
                            checked={!!sel?.checked && !isDisabled}
                            disabled={isDisabled}
                            onChange={e => setSelected(prev => ({
                              ...prev,
                              [item.id]: { ...prev[item.id], checked: e.target.checked },
                            }))}
                          />
                        </td>
                        <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.08)] text-white">
                          <div className="font-medium">{item.itemName}</div>
                          {item.isUrgent && <span className="text-[11px] text-[#ef5350]">긴급</span>}
                        </td>
                        <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.08)] text-white text-[12px] text-muted-brand">{item.spec ?? '-'}</td>
                        <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.08)] text-white">{item.unit ?? '-'}</td>
                        <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.08)] text-white text-right">{Number(item.requestedQty).toLocaleString()}</td>
                        <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.08)] text-white text-right text-muted-brand">{Number(item.orderedQty).toLocaleString()}</td>
                        <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.08)] text-white text-right font-semibold"
                          style={{ color: remaining <= 0 ? '#607d8b' : '#66bb6a' }}>
                          {Number(item.remainingQty).toLocaleString()}
                        </td>
                        <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.08)] text-white">
                          <input
                            type="number" min="0.01" step="0.01"
                            value={sel?.qty ?? ''}
                            disabled={isDisabled || !sel?.checked}
                            onChange={e => setSelected(prev => ({
                              ...prev,
                              [item.id]: { ...prev[item.id], qty: e.target.value },
                            }))}
                            style={{
                              width: '80px', padding: '5px 8px', borderRadius: '4px',
                              background: '#FFFFFF', color: '#111827', fontSize: '13px',
                              border: `1px solid ${isOver ? '#ef5350' : '#E5E7EB'}`,
                            }}
                          />
                          {isOver && <div className="text-[11px] text-[#ef5350] mt-[2px]">잔량 초과</div>}
                        </td>
                        <td className="px-3 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.08)] text-white">
                          <span style={{
                            padding: '2px 6px', borderRadius: '10px', fontSize: '11px',
                            background: ORDER_STATUS_COLOR[item.orderStatus] + '22',
                            color: ORDER_STATUS_COLOR[item.orderStatus],
                          }}>
                            {ORDER_STATUS_LABEL[item.orderStatus]}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {error && (
              <div className="mt-3 px-[14px] py-[10px] bg-[rgba(183,28,28,0.15)] border border-[rgba(183,28,28,0.4)] rounded-md text-[#ef5350] text-[13px]">
                {error}
              </div>
            )}

            <div className="flex gap-3 justify-end mt-5">
              <Link href="/admin/materials/purchase-orders" className="px-5 py-[10px] bg-white/[0.08] text-muted-brand border-0 rounded-md cursor-pointer text-sm no-underline inline-flex items-center">취소</Link>
              <button type="submit" disabled={submitting} className="px-6 py-[10px] bg-brand-accent text-white border-0 rounded-md cursor-pointer text-sm font-semibold">
                {submitting ? '생성 중...' : '발주서 생성'}
              </button>
            </div>
          </form>
        )}
    </div>
  )
}

export default function NewPurchaseOrderPage() {
  return (
    <Suspense fallback={<div className="p-8 text-muted-brand">로딩 중...</div>}>
      <NewPurchaseOrderInner />
    </Suspense>
  )
}
