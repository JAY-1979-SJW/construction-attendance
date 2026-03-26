'use client'

import { useState, useEffect, useCallback } from 'react'

interface Registration {
  id: string
  name: string
  phone: string
  jobTitle: string
  username: string | null
  email: string | null
  accountStatus: string
  rejectReason: string | null
  reviewedAt: string | null
  createdAt: string
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: '대기', APPROVED: '승인', REJECTED: '반려', SUSPENDED: '정지',
}
const STATUS_COLOR: Record<string, string> = {
  PENDING: '#ff9800', APPROVED: '#2e7d32', REJECTED: '#c62828', SUSPENDED: '#666',
}

export default function RegistrationsPage() {
  const [filter, setFilter] = useState('PENDING')
  const [data, setData] = useState<Registration[]>([])
  const [loading, setLoading] = useState(false)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [processing, setProcessing] = useState('')
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setMsg('')
    const res = await fetch(`/api/admin/registrations?status=${filter}`)
    const d = await res.json()
    setData(d.data ?? [])
    setLoading(false)
  }, [filter])

  useEffect(() => { load() }, [load])

  async function approve(id: string) {
    setProcessing(id)
    const res = await fetch(`/api/admin/registrations/${id}/approve`, { method: 'POST' })
    const d = await res.json()
    setMsg(d.message ?? '')
    setProcessing('')
    load()
  }

  async function reject(id: string) {
    if (!rejectReason.trim()) { setMsg('반려 사유를 입력하세요.'); return }
    setProcessing(id)
    const res = await fetch(`/api/admin/registrations/${id}/reject`, {
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
    <div className="px-6 py-8 max-w-[1000px] mx-auto font-['Malgun_Gothic',sans-serif]">
      <h1 className="text-[22px] font-bold mb-6 text-white">회원가입 신청 관리</h1>

      {/* 필터 탭 */}
      <div className="flex gap-2 mb-5">
        {['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'].map(st => (
          <button
            key={st}
            className={`px-[18px] py-2 rounded-[20px] border text-sm cursor-pointer transition-colors ${
              filter === st
                ? 'bg-[#F47920] text-white border-[#1976d2] font-bold'
                : 'bg-card border-white/[0.12] text-muted-brand'
            }`}
            onClick={() => setFilter(st)}
          >
            {STATUS_LABEL[st]}
          </button>
        ))}
      </div>

      {msg && (
        <div className="bg-[#e8f5e9] border border-[#a5d6a7] rounded-lg px-4 py-3 mb-4 text-[#2e7d32] text-sm">
          {msg}
        </div>
      )}

      {/* 반려 사유 입력 모달 */}
      {rejectId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100]">
          <div className="bg-card rounded-xl p-7 w-[360px] shadow-[0_8px_32px_rgba(0,0,0,0.15)]">
            <h3 className="m-0 mb-4 text-base font-bold">반려 사유 입력</h3>
            <textarea
              className="w-full px-[10px] py-[10px] border border-[rgba(91,164,217,0.3)] rounded-lg text-sm mb-4 box-border resize-y"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="반려 사유를 입력하세요."
              rows={4}
            />
            <div className="flex gap-2 justify-end">
              <button
                className="px-4 py-2 bg-[#eee] border-none rounded-lg text-sm cursor-pointer"
                onClick={() => { setRejectId(null); setRejectReason('') }}
              >취소</button>
              <button
                className="px-4 py-2 bg-[#c62828] text-white border-none rounded-lg text-sm cursor-pointer font-bold disabled:opacity-50"
                onClick={() => reject(rejectId)}
                disabled={processing === rejectId}
              >
                {processing === rejectId ? '처리 중...' : '반려'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-[60px] text-muted-brand text-[15px]">로딩 중...</div>
      ) : data.length === 0 ? (
        <div className="text-center py-[60px] text-muted-brand text-[15px]">{STATUS_LABEL[filter]} 상태의 신청이 없습니다.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {['이름', '이메일', '직종', '가입일시', '상태', ''].map(h => (
                  <th
                    key={h}
                    className="bg-[#1E3350] px-[14px] py-3 text-left font-bold text-muted-brand border-b-2 border-[rgba(91,164,217,0.2)]"
                  >{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map(r => (
                <tr key={r.id} className="border-b border-[#f0f0f0]">
                  <td className="px-[14px] py-3 align-middle">
                    <div className="font-semibold">{r.name}</div>
                    {r.phone && <div className="text-[11px] text-muted-brand">{r.phone}</div>}
                  </td>
                  <td className="px-[14px] py-3 align-middle text-[13px]">{r.email ?? <span className="text-muted-brand">-</span>}</td>
                  <td className="px-[14px] py-3 align-middle">{r.jobTitle}</td>
                  <td className="px-[14px] py-3 align-middle text-[13px] text-muted-brand">{new Date(r.createdAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="px-[14px] py-3 align-middle">
                    <span
                      className="inline-block text-white text-[11px] font-bold px-2 py-[3px] rounded-xl"
                      style={{ background: STATUS_COLOR[r.accountStatus] }}
                    >
                      {STATUS_LABEL[r.accountStatus]}
                    </span>
                    {r.rejectReason && <div className="text-[11px] text-[#c62828] mt-1 max-w-[160px]">{r.rejectReason}</div>}
                  </td>
                  <td className="px-[14px] py-3 align-middle">
                    {r.accountStatus === 'PENDING' && (
                      <div className="flex gap-[6px]">
                        <button
                          className="px-3 py-[6px] bg-[#2e7d32] text-white border-none rounded-md text-xs cursor-pointer font-semibold disabled:opacity-50"
                          onClick={() => approve(r.id)}
                          disabled={processing === r.id}
                        >승인</button>
                        <button
                          className="px-3 py-[6px] bg-[#c62828] text-white border-none rounded-md text-xs cursor-pointer font-semibold"
                          onClick={() => { setRejectId(r.id); setRejectReason('') }}
                        >반려</button>
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
