'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface MaterialRequest {
  id: string
  requestNo: string
  title: string
  status: string
  requestedBy: string
  createdAt: string
  deliveryRequestedAt: string | null
  site: { id: string; name: string } | null
  _count: { items: number }
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
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export default function MaterialRequestsPage() {
  const router = useRouter()
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

  const handleLogout = () => {
    fetch('/api/admin/auth/logout', { method: 'POST' }).then(() => router.push('/admin/login'))
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="p-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold m-0 mb-1">자재청구 목록</h1>
            <p className="text-sm text-muted-brand m-0">현장별 자재청구서를 관리합니다.</p>
          </div>
          <button onClick={() => router.push('/admin/materials/requests/new')} className="px-5 py-[10px] bg-[#F47920] text-white border-0 rounded-md cursor-pointer text-sm font-semibold">
            + 청구서 작성
          </button>
        </div>

        {/* 필터 */}
        <div className="flex gap-3 items-center mb-4">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border border-[rgba(91,164,217,0.3)] rounded-md text-sm bg-card text-white">
            <option value="">전체 상태</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <span className="text-muted-brand text-sm">총 {total}건</span>
        </div>

        <div className="bg-white rounded-[12px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          {loading ? (
            <div className="text-center py-12 text-muted-brand">로딩 중...</div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12 text-muted-brand">등록된 청구서가 없습니다.</div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {['청구번호', '제목', '현장', '상태', '항목수', '요청일', '납품요청일', ''].map(h => (
                    <th key={h} className="text-left px-3 py-[10px] text-[12px] text-muted-brand border-b-2 border-[rgba(91,164,217,0.2)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {requests.map(r => (
                  <tr key={r.id}>
                    <td className="px-3 py-3 text-sm border-b border-[rgba(91,164,217,0.1)]">
                      <span className="text-[12px] text-muted-brand">{r.requestNo}</span>
                    </td>
                    <td className="px-3 py-3 text-sm border-b border-[rgba(91,164,217,0.1)]">{r.title}</td>
                    <td className="px-3 py-3 text-sm border-b border-[rgba(91,164,217,0.1)]">{r.site?.name ?? '-'}</td>
                    <td className="px-3 py-3 text-sm border-b border-[rgba(91,164,217,0.1)]">
                      <span style={{
                        padding: '2px 8px', borderRadius: '12px', fontSize: '12px',
                        background: STATUS_COLOR[r.status] + '22',
                        color: STATUS_COLOR[r.status],
                        border: `1px solid ${STATUS_COLOR[r.status]}66`,
                      }}>
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm border-b border-[rgba(91,164,217,0.1)] text-center">{r._count.items}</td>
                    <td className="px-3 py-3 text-sm border-b border-[rgba(91,164,217,0.1)]">{fmtDate(r.createdAt)}</td>
                    <td className="px-3 py-3 text-sm border-b border-[rgba(91,164,217,0.1)]">{r.deliveryRequestedAt ? fmtDate(r.deliveryRequestedAt) : '-'}</td>
                    <td className="px-3 py-3 text-sm border-b border-[rgba(91,164,217,0.1)]">
                      <Link href={`/admin/materials/requests/${r.id}`} className="px-[10px] py-1 bg-[rgba(91,164,217,0.12)] text-[#5BA4D9] border border-[#90caf9] rounded cursor-pointer text-[12px] font-semibold no-underline inline-block">보기</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
