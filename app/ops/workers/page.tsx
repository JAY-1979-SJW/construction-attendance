'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Worker {
  id: string
  name: string
  jobTitle: string
  employmentType: string
  accountStatus: string
  activeSites?: { id: string; name: string }[]
}

const EMPLOYMENT_TYPE_LABEL: Record<string, string> = {
  DAILY_CONSTRUCTION: '일용직',
  REGULAR: '정규직',
  BUSINESS_33: '사업소득(3.3%)',
  OTHER: '기타',
}

const ACCOUNT_STATUS_MAP: Record<string, { label: string; bg: string; color: string }> = {
  PENDING:  { label: '승인 대기', bg: '#fef3c7', color: '#92400e' },
  APPROVED: { label: '활성',     bg: '#d1fae5', color: '#065f46' },
  REJECTED: { label: '반려',     bg: '#fee2e2', color: '#991b1b' },
  SUSPENDED:{ label: '중지',     bg: '#f3f4f6', color: '#6b7280' },
}

export default function OpsWorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const load = (s = search) => {
    setLoading(true)
    const params = new URLSearchParams({ pageSize: '100' })
    if (s) params.set('search', s)
    fetch(`/api/admin/workers?${params}`)
      .then(r => r.json())
      .then(d => {
        setWorkers(d.items ?? d.data?.items ?? [])
        setTotal(d.total ?? d.data?.total ?? 0)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    load(search)
  }

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-5">
        <h1 className="text-[22px] font-bold text-[#111827] m-0">작업자 현황</h1>
        <span className="text-[14px] text-[#6b7280] bg-[#f3f4f6] px-[10px] py-[2px] rounded-xl">{total}명</span>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="이름으로 검색"
          className="px-3 py-2 border border-[rgba(91,164,217,0.3)] rounded-md text-[13px] w-[220px] outline-none"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-[#F97316] text-white border-none rounded-md cursor-pointer text-[13px]"
        >
          검색
        </button>
      </form>

      {loading ? (
        <p className="text-[#6b7280]">로딩 중...</p>
      ) : workers.length === 0 ? (
        <div className="text-center py-[60px] px-5 bg-white rounded-lg text-[#6b7280] border border-[#e5e7eb]">
          <p>배정된 작업자가 없습니다.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-[#e5e7eb] overflow-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead className="bg-[#f9fafb]">
              <tr>
                {['이름', '직종', '고용형태', '배정 현장', '상태', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[12px] font-semibold text-[#6b7280] border-b border-[#e5e7eb] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {workers.map(w => {
                const st = ACCOUNT_STATUS_MAP[w.accountStatus] ?? { label: w.accountStatus, bg: '#f3f4f6', color: '#6b7280' }
                return (
                  <tr key={w.id} className="border-b border-[#f3f4f6] hover:bg-[rgba(91,164,217,0.04)]">
                    <td className="px-4 py-[13px] font-semibold text-[#1f2937]">{w.name}</td>
                    <td className="px-4 py-[13px] text-[#374151]">{w.jobTitle || '—'}</td>
                    <td className="px-4 py-[13px] text-[#374151]">{EMPLOYMENT_TYPE_LABEL[w.employmentType] ?? w.employmentType}</td>
                    <td className="px-4 py-[13px] text-[#374151]">
                      {w.activeSites && w.activeSites.length > 0
                        ? w.activeSites.map(s => s.name).join(', ')
                        : '—'}
                    </td>
                    <td className="px-4 py-[13px]">
                      <span
                        className="text-[11px] px-2 py-[3px] rounded font-medium"
                        style={{ background: st.bg, color: st.color }}
                      >
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-[13px]">
                      <Link
                        href={`/admin/workers/${w.id}`}
                        className="px-3 py-[5px] bg-[#eff6ff] text-[#1d4ed8] rounded-[5px] no-underline text-[12px] font-medium"
                      >
                        상세 보기
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
