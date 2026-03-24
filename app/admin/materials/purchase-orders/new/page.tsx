'use client'

import { useState, useEffect, use, Suspense } from 'react'
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
      <div style={{ display: 'flex', minHeight: '100vh', background: '#1B2838', alignItems: 'center', justifyContent: 'center', color: '#A0AEC0' }}>
        청구서 ID가 필요합니다.
      </div>
    )
  }

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <Link href="/admin/materials/purchase-orders" style={S.backBtn}>← 목록</Link>
          <div>
            <h1 style={S.pageTitle}>발주서 작성</h1>
            {requestInfo && (
              <p style={S.pageDesc}>
                청구서: {requestInfo.requestNo} — {requestInfo.title}
              </p>
            )}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px', color: '#A0AEC0' }}>로딩 중...</div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* 기본 정보 */}
            <div style={S.card}>
              <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px', color: 'white' }}>발주 정보</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={S.formGroup}>
                  <label style={S.label}>납품 요청일</label>
                  <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} style={S.input} />
                </div>
                <div style={{ ...S.formGroup, gridColumn: '1 / -1' }}>
                  <label style={S.label}>메모</label>
                  <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={2}
                    style={{ ...S.input, resize: 'vertical' }} placeholder="발주 관련 메모 (선택)" />
                </div>
              </div>
            </div>

            {/* 품목 선택 */}
            <div style={{ ...S.card, marginTop: '16px' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px', color: 'white' }}>
                발주 품목 선택
                <span style={{ fontSize: '12px', color: '#A0AEC0', fontWeight: 400, marginLeft: '8px' }}>
                  잔량 0 항목은 선택 불가
                </span>
              </div>
              <table style={S.table}>
                <thead>
                  <tr>
                    {['선택', '품목명', '규격', '단위', '요청수량', '기발주', '잔량', '발주수량', '상태'].map(h => (
                      <th key={h} style={S.th}>{h}</th>
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
                        <td style={{ ...S.td, textAlign: 'center' as const }}>
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
                        <td style={S.td}>
                          <div style={{ fontWeight: 500 }}>{item.itemName}</div>
                          {item.isUrgent && <span style={{ fontSize: '10px', color: '#ef5350' }}>긴급</span>}
                        </td>
                        <td style={{ ...S.td, fontSize: '12px', color: '#A0AEC0' }}>{item.spec ?? '-'}</td>
                        <td style={S.td}>{item.unit ?? '-'}</td>
                        <td style={{ ...S.td, textAlign: 'right' as const }}>{Number(item.requestedQty).toLocaleString()}</td>
                        <td style={{ ...S.td, textAlign: 'right' as const, color: '#A0AEC0' }}>{Number(item.orderedQty).toLocaleString()}</td>
                        <td style={{ ...S.td, textAlign: 'right' as const, color: remaining <= 0 ? '#607d8b' : '#66bb6a', fontWeight: 600 }}>
                          {Number(item.remainingQty).toLocaleString()}
                        </td>
                        <td style={S.td}>
                          <input
                            type="number" min="0.01" step="0.01"
                            value={sel?.qty ?? ''}
                            disabled={isDisabled || !sel?.checked}
                            onChange={e => setSelected(prev => ({
                              ...prev,
                              [item.id]: { ...prev[item.id], qty: e.target.value },
                            }))}
                            style={{
                              ...S.qtyInput,
                              borderColor: isOver ? '#ef5350' : 'rgba(91,164,217,0.3)',
                            }}
                          />
                          {isOver && <div style={{ fontSize: '10px', color: '#ef5350', marginTop: '2px' }}>잔량 초과</div>}
                        </td>
                        <td style={S.td}>
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

            {error && <div style={S.errorMsg}>{error}</div>}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <Link href="/admin/materials/purchase-orders" style={S.cancelBtn}>취소</Link>
              <button type="submit" disabled={submitting} style={S.primaryBtn}>
                {submitting ? '생성 중...' : '발주서 생성'}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  )
}

export default function NewPurchaseOrderPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', minHeight: '100vh', background: '#1B2838', alignItems: 'center', justifyContent: 'center', color: '#A0AEC0' }}>로딩 중...</div>}>
      <NewPurchaseOrderInner />
    </Suspense>
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
  th: { textAlign: 'left', padding: '8px 12px', fontSize: '11px', color: '#A0AEC0', borderBottom: '2px solid rgba(91,164,217,0.2)' },
  td: { padding: '10px 12px', fontSize: '13px', borderBottom: '1px solid rgba(91,164,217,0.08)', color: 'white' },
  qtyInput: { width: '80px', padding: '5px 8px', borderRadius: '4px', background: '#1B2838', color: 'white', fontSize: '13px', border: '1px solid rgba(91,164,217,0.3)' },
  errorMsg: { marginTop: '12px', padding: '10px 14px', background: 'rgba(183,28,28,0.15)', border: '1px solid rgba(183,28,28,0.4)', borderRadius: '6px', color: '#ef5350', fontSize: '13px' },
  primaryBtn: { padding: '10px 24px', background: '#F47920', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 },
  cancelBtn: { padding: '10px 20px', background: 'rgba(255,255,255,0.08)', color: '#A0AEC0', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' },
}
