'use client'

import { useState, useEffect, useCallback } from 'react'
import { Modal } from '@/components/admin/ui'

interface JoinRequest {
  id: string
  status: string
  joinMethod: string
  requestedAt: string
  reviewedAt: string | null
  rejectReason: string | null
  note: string | null
  worker: { id: string; name: string; phone: string; jobTitle: string }
  site: { id: string; name: string; address: string }
}

const STATUS_LABEL: Record<string, string> = { PENDING: '대기', APPROVED: '승인', REJECTED: '반려' }
const STATUS_COLOR: Record<string, string> = { PENDING: '#ff9800', APPROVED: '#2e7d32', REJECTED: '#c62828' }

export default function SiteJoinRequestsPage() {
  const [filter, setFilter] = useState('PENDING')
  const [data, setData] = useState<JoinRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [processing, setProcessing] = useState('')
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setMsg('')
    const res = await fetch(`/api/admin/site-join-requests?status=${filter}`)
    const d = await res.json()
    setData(d.data ?? [])
    setLoading(false)
  }, [filter])

  useEffect(() => { load() }, [load])

  async function approve(id: string) {
    setProcessing(id)
    const res = await fetch(`/api/admin/site-join-requests/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const d = await res.json()
    setMsg(d.message ?? '')
    setProcessing('')
    load()
  }

  async function reject(id: string) {
    if (!rejectReason.trim()) { setMsg('반려 사유를 입력하세요.'); return }
    setProcessing(id)
    const res = await fetch(`/api/admin/site-join-requests/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rejectReason }),
    })
    const d = await res.json()
    setMsg(d.message ?? '')
    setProcessing('')
    setRejectId(null)
    setRejectReason('')
    load()
  }

  return (
    <div className="px-6 py-8 max-w-[1000px] mx-auto">
      <h1 className="text-[22px] font-bold mb-6 text-white">현장 참여 신청 관리</h1>

      <div className="flex flex-col sm:flex-row gap-2 mb-5">
        {['PENDING', 'APPROVED', 'REJECTED'].map(st => (
          <button key={st} onClick={() => setFilter(st)} className={[
            'px-[18px] py-2 rounded-[20px] text-sm cursor-pointer',
            filter === st
              ? 'bg-accent text-white border border-[#1976d2] font-bold'
              : 'bg-white border border-brand text-muted-brand',
          ].join(' ')}>
            {STATUS_LABEL[st]}
          </button>
        ))}
      </div>

      {msg && (
        <div className="bg-green-light border border-[#a5d6a7] rounded-lg px-4 py-3 mb-4 text-[#2e7d32] text-[14px]">{msg}</div>
      )}

      <Modal open={!!rejectId} onClose={() => { setRejectId(null); setRejectReason('') }} title="반려 사유 입력">
        <textarea
          className="w-full px-[10px] py-[10px] border border-[rgba(91,164,217,0.3)] rounded-lg text-[14px] mb-4 box-border resize-y"
          value={rejectReason}
          onChange={e => setRejectReason(e.target.value)}
          placeholder="반려 사유를 입력하세요."
          rows={4}
        />
        <div className="flex gap-2 justify-end">
          <button className="px-4 py-2 bg-[#eee] border-0 rounded-lg text-[14px] cursor-pointer" onClick={() => { setRejectId(null); setRejectReason('') }}>취소</button>
          <button className="px-4 py-2 bg-[#c62828] text-white border-0 rounded-lg text-[14px] cursor-pointer font-bold" onClick={() => rejectId && reject(rejectId)} disabled={!!rejectId && processing === rejectId}>
            {rejectId && processing === rejectId ? '처리 중...' : '반려'}
          </button>
        </div>
      </Modal>

      {loading ? (
        <div className="text-center py-[60px] text-muted-brand text-[15px]">로딩 중...</div>
      ) : data.length === 0 ? (
        <div className="text-center py-[60px] text-muted-brand text-[15px]">{STATUS_LABEL[filter]} 상태의 신청이 없습니다.</div>
      ) : (
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full border-collapse text-[14px]">
            <thead>
              <tr>
                {['근로자', '전화번호', '현장', '상태', '신청일', ''].map(h => (
                  <th key={h} className="bg-[#1E3350] px-[14px] py-3 text-left font-bold text-muted-brand border-b-2 border-[rgba(91,164,217,0.2)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map(r => (
                <tr key={r.id} className="border-b border-brand">
                  <td className="px-[14px] py-3 align-middle">
                    {r.worker.name}
                    <div className="text-[11px] text-muted-brand mt-[2px]">{r.worker.jobTitle}</div>
                  </td>
                  <td className="px-[14px] py-3 align-middle">{r.worker.phone}</td>
                  <td className="px-[14px] py-3 align-middle">
                    {r.site.name}
                    <div className="text-[11px] text-muted-brand mt-[2px]">{r.site.address}</div>
                  </td>
                  <td className="px-[14px] py-3 align-middle">
                    <span className="inline-block text-white text-[11px] font-bold px-2 py-[3px] rounded-[12px]" style={{ background: STATUS_COLOR[r.status] }}>
                      {STATUS_LABEL[r.status]}
                    </span>
                    {r.rejectReason && <div className="text-[11px] text-[#c62828] mt-1 max-w-[160px]">{r.rejectReason}</div>}
                  </td>
                  <td className="px-[14px] py-3 align-middle">{new Date(r.requestedAt).toLocaleDateString()}</td>
                  <td className="px-[14px] py-3 align-middle">
                    {r.status === 'PENDING' && (
                      <div className="flex gap-[6px]">
                        <button className="px-3 py-[6px] bg-[#2e7d32] text-white border-0 rounded-md text-[12px] cursor-pointer font-semibold" onClick={() => approve(r.id)} disabled={processing === r.id}>승인</button>
                        <button className="px-3 py-[6px] bg-[#c62828] text-white border-0 rounded-md text-[12px] cursor-pointer font-semibold" onClick={() => { setRejectId(r.id); setRejectReason('') }}>반려</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
