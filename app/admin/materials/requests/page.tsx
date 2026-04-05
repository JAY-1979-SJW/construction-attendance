'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAdminRole } from '@/lib/hooks/useAdminRole'

interface FirstItem {
  itemName: string
  spec: string | null
  requestedQty: string
  unit: string | null
  isUrgent: boolean
}

interface MaterialRequest {
  id: string
  requestNo: string
  title: string
  status: string
  requestedBy: string
  requestedByName: string | null
  createdAt: string
  deliveryRequestedAt: string | null
  site: { id: string; name: string } | null
  items: FirstItem[]
  _count: { items: number }
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
  return new Date(d).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })
}

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLOR[status] ?? '#607d8b'
  return (
    <span style={{
      padding: '2px 8px', borderRadius: '10px', fontSize: '11px', whiteSpace: 'nowrap',
      background: color + '22', color, border: `1px solid ${color}66`,
    }}>
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

export default function MaterialRequestsPage() {
  const router = useRouter()
  const role = useAdminRole()
  const canMutate = role !== null && role !== 'VIEWER'
  const [requests, setRequests] = useState<MaterialRequest[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const pageSize = 20

  const load = () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    if (statusFilter) params.set('status', statusFilter)
    fetch(`/api/admin/materials/requests?${params}`)
      .then(r => r.json())
      .then(d => {
        if (!d.success) { router.push('/admin/login'); return }
        setRequests(d.data.requests)
        setTotal(d.data.total)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { setPage(1) }, [statusFilter])
  useEffect(() => { load() }, [page, statusFilter]) // eslint-disable-line

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-[22px] font-bold m-0 mb-1">자재 신청</h1>
          <p className="text-sm text-muted-brand m-0">총 {total}건</p>
        </div>
        {canMutate && (
          <button
            onClick={() => router.push('/admin/materials/requests/new')}
            className="px-4 py-2 bg-brand-accent text-white border-0 rounded-md cursor-pointer text-sm font-semibold"
          >
            + 신청
          </button>
        )}
      </div>

      {/* 상태 필터 */}
      <div className="flex gap-2 flex-wrap mb-4">
        {['', 'SUBMITTED', 'REVIEWED', 'APPROVED', 'ORDERED', 'RECEIVED', 'REJECTED'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-[12px] border cursor-pointer transition-colors ${
              statusFilter === s
                ? 'bg-brand-accent text-white border-brand-accent'
                : 'bg-transparent text-muted-brand border-[rgba(91,164,217,0.3)]'
            }`}
          >
            {s === '' ? '전체' : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <div className="bg-card rounded-[10px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        {loading ? (
          <div className="text-center py-12 text-muted-brand text-sm">로딩 중...</div>
        ) : requests.length === 0 ? (
          <div className="text-center py-12 text-muted-brand text-sm">신청 내역이 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b-2 border-[rgba(91,164,217,0.2)]">
                  {['신청일', '현장', '신청자', '품목명', '규격', '수량', '단위', '필요일', '긴급', '상태', ''].map(h => (
                    <th key={h} className="text-left px-3 py-[9px] text-[11px] text-muted-brand font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {requests.map(r => {
                  const item = r.items[0]
                  return (
                    <tr key={r.id} className="border-b border-[rgba(91,164,217,0.08)] hover:bg-white/[0.03]">
                      <td className="px-3 py-[10px] text-[12px] text-muted-brand whitespace-nowrap">{fmtDate(r.createdAt)}</td>
                      <td className="px-3 py-[10px] text-[13px] whitespace-nowrap max-w-[120px] truncate">{r.site?.name ?? '-'}</td>
                      <td className="px-3 py-[10px] text-[12px] text-muted-brand whitespace-nowrap">{r.requestedByName ?? r.requestedBy}</td>
                      <td className="px-3 py-[10px] text-[13px] font-medium">{item?.itemName ?? r.title}</td>
                      <td className="px-3 py-[10px] text-[12px] text-muted-brand">{item?.spec ?? '-'}</td>
                      <td className="px-3 py-[10px] text-[12px] text-right">{item ? Number(item.requestedQty).toLocaleString() : '-'}</td>
                      <td className="px-3 py-[10px] text-[12px] text-muted-brand">{item?.unit ?? '-'}</td>
                      <td className="px-3 py-[10px] text-[12px] text-muted-brand whitespace-nowrap">
                        {r.deliveryRequestedAt ? fmtDate(r.deliveryRequestedAt) : '-'}
                      </td>
                      <td className="px-3 py-[10px] text-center">
                        {item?.isUrgent ? (
                          <span className="text-[11px] text-[#f9a825] font-bold">긴급</span>
                        ) : (
                          <span className="text-[11px] text-muted-brand">-</span>
                        )}
                      </td>
                      <td className="px-3 py-[10px]"><StatusBadge status={r.status} /></td>
                      <td className="px-3 py-[10px]">
                        <Link
                          href={`/admin/materials/requests/${r.id}`}
                          className="text-[12px] text-secondary-brand no-underline hover:underline whitespace-nowrap"
                        >
                          보기
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex gap-2 justify-center py-4">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 border border-[rgba(91,164,217,0.3)] rounded bg-transparent cursor-pointer text-[12px] text-white disabled:opacity-40">이전</button>
            <span className="text-muted-brand text-[12px] leading-7">{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 border border-[rgba(91,164,217,0.3)] rounded bg-transparent cursor-pointer text-[12px] text-white disabled:opacity-40">다음</button>
          </div>
        )}
      </div>
    </div>
  )
}
