'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Site {
  id: string
  name: string
  address: string | null
  status: string
  workerCount: number
  companyName: string | null
}

const STATUS_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  ACTIVE:   { label: '운영중', bg: '#d1fae5', color: '#065f46' },
  PLANNED:  { label: '준비중', bg: '#dbeafe', color: '#1e40af' },
  CLOSED:   { label: '종료',   bg: '#f3f4f6', color: '#6b7280' },
  ARCHIVED: { label: '보관',   bg: '#f3f4f6', color: '#9ca3af' },
}

export default function OpsSiteList() {
  const [sites, setSites] = useState<Site[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ pageSize: '50' })
    if (search) params.set('search', search)
    fetch(`/api/admin/sites?${params}`)
      .then(r => r.json())
      .then(data => {
        setSites(data?.items ?? [])
        setTotal(data?.total ?? 0)
      })
      .finally(() => setLoading(false))
  }, [search])

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-5">
        <h1 className="text-[22px] font-bold text-[#111827] m-0">내 담당 현장</h1>
        <span className="text-[14px] text-[#6b7280] bg-[#f3f4f6] px-[10px] py-[2px] rounded-xl">{total}개</span>
      </div>

      <div className="mb-4">
        <input
          className="px-3 py-2 border border-[rgba(91,164,217,0.3)] rounded-md text-[14px] w-[240px] outline-none"
          placeholder="현장명 검색"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="text-[#6b7280]">로딩 중...</p>
      ) : sites.length === 0 ? (
        <div className="text-center py-[60px] px-5 bg-white rounded-lg text-[#6b7280] border border-[#e5e7eb]">
          <p>배정된 현장이 없습니다.</p>
          <p className="text-[13px] mt-2 text-[#9ca3af]">관리자에게 현장 배정을 요청하세요.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-[#e5e7eb] overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#f9fafb]">
                <th className="px-4 py-3 text-left text-[12px] font-semibold text-[#6b7280] border-b border-[#e5e7eb]">현장명</th>
                <th className="px-4 py-3 text-left text-[12px] font-semibold text-[#6b7280] border-b border-[#e5e7eb]">주소</th>
                <th className="px-4 py-3 text-left text-[12px] font-semibold text-[#6b7280] border-b border-[#e5e7eb]">상태</th>
                <th className="px-4 py-3 text-left text-[12px] font-semibold text-[#6b7280] border-b border-[#e5e7eb]">작업자 수</th>
                <th className="px-4 py-3 text-left text-[12px] font-semibold text-[#6b7280] border-b border-[#e5e7eb]"></th>
              </tr>
            </thead>
            <tbody>
              {sites.map(site => {
                const s = STATUS_LABELS[site.status] ?? { label: site.status, bg: '#f3f4f6', color: '#6b7280' }
                return (
                  <tr key={site.id} className="border-b border-[#f3f4f6]">
                    <td className="px-4 py-[14px] text-[14px] text-[#1f2937]">
                      <span className="font-semibold">{site.name}</span>
                    </td>
                    <td className="px-4 py-[14px] text-[13px] text-[#6b7280]">
                      {site.address ?? '—'}
                    </td>
                    <td className="px-4 py-[14px] text-[14px] text-[#1f2937]">
                      <span
                        className="text-[11px] px-2 py-[3px] rounded font-medium"
                        style={{ background: s.bg, color: s.color }}
                      >
                        {s.label}
                      </span>
                    </td>
                    <td className="px-4 py-[14px] text-[14px] text-[#1f2937] text-center">{site.workerCount ?? '—'}</td>
                    <td className="px-4 py-[14px] text-[14px] text-[#1f2937]">
                      <Link
                        href={`/ops/sites/${site.id}`}
                        className="px-3 py-[5px] bg-[#eff6ff] text-[#1d4ed8] rounded-[5px] no-underline text-[13px] font-medium"
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
