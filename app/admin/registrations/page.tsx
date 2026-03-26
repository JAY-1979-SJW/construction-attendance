'use client'

import { useState, useEffect, useCallback } from 'react'

interface Registration {
  id: string
  name: string
  phone: string | null
  jobTitle: string
  username: string | null
  email: string | null
  accountStatus: string
  rejectReason: string | null
  reviewedAt: string | null
  reviewedBy: string | null
  createdAt: string
  devices: { deviceName: string; approvedAt: string | null }[]
  siteJoinRequests: { siteId: string; status: string }[]
}

interface Counts { PENDING: number; APPROVED: number; REJECTED: number; SUSPENDED: number }

const STATUS_LABEL: Record<string, string> = {
  PENDING: '대기', APPROVED: '승인', REJECTED: '반려', SUSPENDED: '정지',
}
const STATUS_COLOR: Record<string, string> = {
  PENDING: '#F97316', APPROVED: '#16a34a', REJECTED: '#dc2626', SUSPENDED: '#6B7280',
}

export default function RegistrationsPage() {
  const [filter, setFilter] = useState('PENDING')
  const [data, setData] = useState<Registration[]>([])
  const [counts, setCounts] = useState<Counts>({ PENDING: 0, APPROVED: 0, REJECTED: 0, SUSPENDED: 0 })
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [processing, setProcessing] = useState('')
  const [msg, setMsg] = useState('')
  const [selected, setSelected] = useState<Registration | null>(null)

  const loadCounts = useCallback(async () => {
    const results = await Promise.all(
      (['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'] as const).map(st =>
        fetch(`/api/admin/registrations?status=${st}&limit=0`).then(r => r.json()).then(d => [st, d.pagination?.total ?? 0] as const)
      )
    )
    setCounts(Object.fromEntries(results) as unknown as Counts)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setMsg('')
    const res = await fetch(`/api/admin/registrations?status=${filter}&limit=100`)
    const d = await res.json()
    setData(d.data ?? [])
    setLoading(false)
  }, [filter])

  useEffect(() => { loadCounts() }, [loadCounts])
  useEffect(() => { load() }, [load])

  const filtered = search.trim()
    ? data.filter(r =>
        r.name.includes(search) ||
        (r.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (r.phone ?? '').includes(search)
      )
    : data

  async function approve(id: string) {
    setProcessing(id)
    const res = await fetch(`/api/admin/registrations/${id}/approve`, { method: 'POST' })
    const d = await res.json()
    setMsg(d.message ?? '')
    setProcessing('')
    load()
    loadCounts()
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
    loadCounts()
  }

  const fmtDate = (iso: string) => new Date(iso).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="p-8">
      <h1 className="text-[20px] font-bold mb-5">회원가입 관리</h1>

      {/* ── 요약 카드 ── */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {(['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'] as const).map(st => (
          <button key={st} onClick={() => { setFilter(st); setSelected(null) }}
            className={`rounded-xl px-4 py-3 text-left border transition-colors cursor-pointer ${
              filter === st ? 'border-[#F97316] bg-[rgba(249,115,22,0.08)]' : 'border-[rgba(91,164,217,0.15)] bg-card'
            }`}>
            <div className="text-[12px] text-muted-brand mb-1">{STATUS_LABEL[st]}</div>
            <div className="text-[22px] font-bold" style={{ color: STATUS_COLOR[st] }}>{counts[st]}</div>
          </button>
        ))}
      </div>

      {/* ── 검색 ── */}
      <div className="mb-4">
        <input
          className="w-full max-w-[360px] px-3 py-[9px] border border-[rgba(91,164,217,0.3)] rounded-lg text-[13px] bg-card text-white outline-none placeholder:text-muted-brand"
          placeholder="이름, 이메일, 전화번호 검색"
          value={search} onChange={e => setSearch(e.target.value)}
        />
      </div>

      {msg && (
        <div className="bg-[rgba(22,163,74,0.1)] border border-[rgba(22,163,74,0.3)] rounded-lg px-4 py-[10px] mb-4 text-[#16a34a] text-[13px]">
          {msg}
        </div>
      )}

      {/* ── 반려 모달 ── */}
      {rejectId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100]">
          <div className="bg-card rounded-xl p-7 w-[360px] shadow-[0_8px_32px_rgba(0,0,0,0.15)]">
            <h3 className="m-0 mb-4 text-base font-bold">반려 사유</h3>
            <textarea
              className="w-full px-3 py-[10px] border border-[rgba(91,164,217,0.3)] rounded-lg text-sm mb-4 box-border resize-y bg-card text-white"
              value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              placeholder="반려 사유를 입력하세요." rows={3}
            />
            <div className="flex gap-2 justify-end">
              <button className="px-4 py-2 bg-[rgba(91,164,217,0.1)] text-muted-brand border-none rounded-lg text-sm cursor-pointer" onClick={() => { setRejectId(null); setRejectReason('') }}>취소</button>
              <button className="px-4 py-2 bg-[#dc2626] text-white border-none rounded-lg text-sm cursor-pointer font-bold disabled:opacity-50" onClick={() => reject(rejectId)} disabled={processing === rejectId}>
                {processing === rejectId ? '처리 중...' : '반려'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-5">
        {/* ── 목록 ── */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="text-center py-16 text-muted-brand">로딩 중...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-brand">{search ? '검색 결과가 없습니다.' : `${STATUS_LABEL[filter]} 상태의 신청이 없습니다.`}</div>
          ) : (
            <div className="bg-card rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.3)] overflow-hidden">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    {['이름', '이메일', '직종', '가입일시', '상태', ''].map(h => (
                      <th key={h} className="px-[14px] py-[10px] text-left text-[12px] font-bold text-muted-brand border-b-2 border-[rgba(91,164,217,0.2)] whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id} onClick={() => setSelected(r)} className={`cursor-pointer transition-colors ${selected?.id === r.id ? 'bg-[rgba(249,115,22,0.06)]' : 'hover:bg-[rgba(91,164,217,0.04)]'}`}>
                      <td className="px-[14px] py-3">
                        <div className="font-semibold text-[13px]">{r.name}</div>
                        {r.phone && <div className="text-[11px] text-muted-brand">{r.phone}</div>}
                      </td>
                      <td className="px-[14px] py-3 text-[13px]">{r.email ?? <span className="text-muted-brand">-</span>}</td>
                      <td className="px-[14px] py-3 text-[13px]">{r.jobTitle}</td>
                      <td className="px-[14px] py-3 text-[12px] text-muted-brand whitespace-nowrap">{fmtDate(r.createdAt)}</td>
                      <td className="px-[14px] py-3">
                        <span className="inline-block text-white text-[11px] font-bold px-[8px] py-[2px] rounded-xl" style={{ background: STATUS_COLOR[r.accountStatus] }}>
                          {STATUS_LABEL[r.accountStatus]}
                        </span>
                      </td>
                      <td className="px-[14px] py-3" onClick={e => e.stopPropagation()}>
                        {r.accountStatus === 'PENDING' && (
                          <div className="flex gap-[6px]">
                            <button className="px-3 py-[5px] bg-[#16a34a] text-white border-none rounded-md text-[11px] cursor-pointer font-semibold disabled:opacity-50" onClick={() => approve(r.id)} disabled={processing === r.id}>승인</button>
                            <button className="px-3 py-[5px] bg-[#dc2626] text-white border-none rounded-md text-[11px] cursor-pointer font-semibold" onClick={() => { setRejectId(r.id); setRejectReason('') }}>반려</button>
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

        {/* ── 상세 패널 ── */}
        {selected && (
          <div className="w-[280px] shrink-0">
            <div className="bg-card rounded-xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.3)] sticky top-[80px]">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-[15px] font-bold m-0">{selected.name}</h3>
                <button onClick={() => setSelected(null)} className="bg-transparent border-0 text-muted-brand text-[18px] cursor-pointer leading-none">×</button>
              </div>
              <div className="space-y-3 text-[13px]">
                <div><span className="text-muted-brand">이메일</span><div className="mt-[2px]">{selected.email ?? '-'}</div></div>
                <div><span className="text-muted-brand">전화번호</span><div className="mt-[2px]">{selected.phone ?? '-'}</div></div>
                <div><span className="text-muted-brand">직종</span><div className="mt-[2px]">{selected.jobTitle}</div></div>
                <div><span className="text-muted-brand">가입일시</span><div className="mt-[2px]">{new Date(selected.createdAt).toLocaleString('ko-KR')}</div></div>
                <div><span className="text-muted-brand">상태</span><div className="mt-[2px]"><span className="text-white text-[11px] font-bold px-[8px] py-[2px] rounded-xl inline-block" style={{ background: STATUS_COLOR[selected.accountStatus] }}>{STATUS_LABEL[selected.accountStatus]}</span></div></div>
                {selected.reviewedAt && (
                  <div><span className="text-muted-brand">검토일시</span><div className="mt-[2px]">{new Date(selected.reviewedAt).toLocaleString('ko-KR')}</div></div>
                )}
                {selected.rejectReason && (
                  <div><span className="text-muted-brand">반려 사유</span><div className="mt-[2px] text-[#dc2626]">{selected.rejectReason}</div></div>
                )}
                {selected.devices.length > 0 && (
                  <div><span className="text-muted-brand">기기</span><div className="mt-[2px]">{selected.devices[0].deviceName}</div></div>
                )}
                {selected.siteJoinRequests.length > 0 && (
                  <div><span className="text-muted-brand">현장 참여</span><div className="mt-[2px]">{selected.siteJoinRequests.length}건</div></div>
                )}
              </div>
              {selected.accountStatus === 'PENDING' && (
                <div className="flex gap-2 mt-5">
                  <button className="flex-1 py-[7px] bg-[#16a34a] text-white border-none rounded-lg text-[13px] font-bold cursor-pointer disabled:opacity-50" onClick={() => approve(selected.id)} disabled={processing === selected.id}>승인</button>
                  <button className="flex-1 py-[7px] bg-[#dc2626] text-white border-none rounded-lg text-[13px] font-bold cursor-pointer" onClick={() => { setRejectId(selected.id); setRejectReason('') }}>반려</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
