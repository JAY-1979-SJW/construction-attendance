'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MobileCardList, MobileCard, MobileCardField, MobileCardFields, MobileCardActions } from '@/components/admin/ui'

interface PurchaseOrder {
  id: string
  orderNo: string
  status: string
  issuedAt: string | null
  createdAt: string
  deliveryRequestedDate: string | null
  materialRequest: { id: string; requestNo: string; title: string }
  site: { id: string; name: string } | null
  _count: { items: number }
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
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export default function PurchaseOrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const pageSize = 20

  const load = () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    if (statusFilter) params.set('status', statusFilter)
    fetch(`/api/admin/materials/purchase-orders?${params}`)
      .then(r => r.json())
      .then(d => {
        if (!d.success) { router.push('/admin/login'); return }
        setOrders(d.data.orders)
        setTotal(d.data.total)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { setPage(1) }, [statusFilter])
  useEffect(() => { load() }, [page, statusFilter]) // eslint-disable-line

  const handleLogout = () => {
    fetch('/api/admin/auth/logout', { method: 'POST' }).then(() => router.push('/admin/login'))
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="p-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold m-0 mb-1">발주 관리</h1>
            <p className="text-sm text-muted-brand m-0">승인된 자재청구서를 기준으로 발주서를 관리합니다.</p>
          </div>
        </div>

        <div className="flex gap-3 items-center mb-4">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border border-[rgba(91,164,217,0.3)] rounded-md text-sm bg-card text-white">
            <option value="">전체 상태</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <span className="text-muted-brand text-sm">총 {total}건</span>
        </div>

        <div className="bg-card rounded-[12px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          {loading ? (
            <div className="text-center py-12 text-muted-brand">로딩 중...</div>
          ) : (
            <MobileCardList
              items={orders}
              emptyMessage="발주서가 없습니다."
              keyExtractor={(o) => o.id}
              renderCard={(o) => (
                <MobileCard
                  title={o.materialRequest.title}
                  subtitle={`${o.orderNo} · ${o.site?.name ?? '-'}`}
                  badge={
                    <span style={{
                      padding: '2px 8px', borderRadius: '12px', fontSize: '12px',
                      background: STATUS_COLOR[o.status] + '22',
                      color: STATUS_COLOR[o.status],
                      border: `1px solid ${STATUS_COLOR[o.status]}66`,
                    }}>
                      {STATUS_LABEL[o.status] ?? o.status}
                    </span>
                  }
                >
                  <MobileCardFields>
                    <MobileCardField label="청구번호" value={o.materialRequest.requestNo} />
                    <MobileCardField label="항목수" value={`${o._count.items}건`} />
                    <MobileCardField label="발행일" value={o.issuedAt ? fmtDate(o.issuedAt) : '-'} />
                    <MobileCardField label="납품요청일" value={o.deliveryRequestedDate ? fmtDate(o.deliveryRequestedDate) : '-'} />
                  </MobileCardFields>
                  <MobileCardActions>
                    <Link href={`/admin/materials/purchase-orders/${o.id}`} className="px-[10px] py-1 bg-[rgba(91,164,217,0.12)] text-secondary-brand border border-[#90caf9] rounded text-[12px] font-semibold no-underline inline-block">보기</Link>
                  </MobileCardActions>
                </MobileCard>
              )}
              renderTable={() => (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        {['발주번호', '청구서', '현장', '상태', '항목수', '발행일', '납품요청일', ''].map(h => (
                          <th key={h} className="text-left px-3 py-[10px] text-[12px] text-muted-brand border-b-2 border-[rgba(91,164,217,0.2)]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map(o => (
                        <tr key={o.id}>
                          <td className="px-3 py-3 text-sm border-b border-[rgba(91,164,217,0.1)]"><span className="text-[12px] text-muted-brand">{o.orderNo}</span></td>
                          <td className="px-3 py-3 text-sm border-b border-[rgba(91,164,217,0.1)]">
                            <div className="text-[13px]">{o.materialRequest.title}</div>
                            <div className="text-[11px] text-muted-brand">{o.materialRequest.requestNo}</div>
                          </td>
                          <td className="px-3 py-3 text-sm border-b border-[rgba(91,164,217,0.1)]">{o.site?.name ?? '-'}</td>
                          <td className="px-3 py-3 text-sm border-b border-[rgba(91,164,217,0.1)]">
                            <span style={{
                              padding: '2px 8px', borderRadius: '12px', fontSize: '12px',
                              background: STATUS_COLOR[o.status] + '22',
                              color: STATUS_COLOR[o.status],
                              border: `1px solid ${STATUS_COLOR[o.status]}66`,
                            }}>
                              {STATUS_LABEL[o.status] ?? o.status}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-sm border-b border-[rgba(91,164,217,0.1)] text-center">{o._count.items}</td>
                          <td className="px-3 py-3 text-sm border-b border-[rgba(91,164,217,0.1)]">{o.issuedAt ? fmtDate(o.issuedAt) : '-'}</td>
                          <td className="px-3 py-3 text-sm border-b border-[rgba(91,164,217,0.1)]">{o.deliveryRequestedDate ? fmtDate(o.deliveryRequestedDate) : '-'}</td>
                          <td className="px-3 py-3 text-sm border-b border-[rgba(91,164,217,0.1)]">
                            <Link href={`/admin/materials/purchase-orders/${o.id}`} className="px-[10px] py-1 bg-[rgba(91,164,217,0.12)] text-secondary-brand border border-[#90caf9] rounded text-[12px] font-semibold no-underline inline-block">보기</Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            />
          )}

          {totalPages > 1 && (
            <div className="flex gap-2 justify-center mt-5">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-[14px] py-[6px] border border-[rgba(91,164,217,0.3)] rounded bg-card cursor-pointer text-[13px] text-white">이전</button>
              <span className="text-muted-brand leading-8 text-[13px]">{page}/{totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-[14px] py-[6px] border border-[rgba(91,164,217,0.3)] rounded bg-card cursor-pointer text-[13px] text-white">다음</button>
            </div>
          )}
        </div>
    </div>
  )
}
