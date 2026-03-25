'use client'

import { useState } from 'react'
import Link from 'next/link'
import ReviewAdminLayout from '../../ReviewAdminLayout'
import { MOCK_WORKERS } from '../../mock-data'

export default function ReviewWorkersPage() {
  const [search, setSearch] = useState('')

  const filtered = search
    ? MOCK_WORKERS.filter(w => w.name.includes(search) || w.company.includes(search) || w.site.includes(search))
    : MOCK_WORKERS

  return (
    <ReviewAdminLayout>
      <div className="p-5 md:p-7 bg-[#F5F7FA] min-h-screen">

        {/* 헤더 */}
        <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-[22px] font-bold text-[#0F172A] m-0 mb-1">근로자 관리</h1>
            <p className="text-[13px] text-[#6B7280] m-0">등록 근로자 {MOCK_WORKERS.length}명</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/review/admin/dashboard" className="text-[13px] text-[#6B7280] no-underline hover:text-[#F97316]">← 대시보드</Link>
            <button className="text-[13px] font-semibold text-white bg-[#F97316] hover:bg-[#EA580C] rounded-[8px] px-4 py-2 border-0 cursor-pointer transition-colors">
              + 근로자 등록
            </button>
          </div>
        </div>

        {/* 검색 */}
        <div className="mb-5 flex gap-2">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="이름, 소속, 현장 검색..."
            className="w-full max-w-xs h-10 px-4 text-[13px] text-[#111827] bg-white border border-[#E5E7EB] rounded-[8px] outline-none focus:border-[#F97316] placeholder:text-[#9CA3AF]"
          />
          <div className="text-[12px] text-[#9CA3AF] flex items-center">{filtered.length}명</div>
        </div>

        {/* 테이블 */}
        <div className="bg-white rounded-[12px] border border-[#E5E7EB] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#F9FAFB]">
                  {['이름', '연락처', '직종', '근로형태', '소속', '현장', '등록일', '상태', ''].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider whitespace-nowrap border-b border-[#F3F4F6]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(w => (
                  <tr key={w.id} className="hover:bg-[#FAFAFA] transition-colors border-b border-[#F9FAFB] last:border-b-0">
                    <td className="px-4 py-3 text-[13px] font-medium text-[#111827] whitespace-nowrap">{w.name}</td>
                    <td className="px-4 py-3 text-[13px] text-[#6B7280] whitespace-nowrap tabular-nums">{w.phone}</td>
                    <td className="px-4 py-3 text-[13px] text-[#374151] whitespace-nowrap">{w.jobTitle}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-[#F9FAFB] text-[#6B7280] border border-[#E5E7EB]">
                        {w.employmentType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[#6B7280] whitespace-nowrap">{w.company}</td>
                    <td className="px-4 py-3 text-[13px] text-[#6B7280] whitespace-nowrap">{w.site}</td>
                    <td className="px-4 py-3 text-[12px] text-[#9CA3AF] whitespace-nowrap tabular-nums">{w.createdAt}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        w.isActive
                          ? 'bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]'
                          : 'bg-[#F9FAFB] text-[#9CA3AF] border border-[#E5E7EB]'
                      }`}>
                        {w.isActive ? '재직중' : '퇴사'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button className="text-[11px] text-[#6B7280] border border-[#E5E7EB] rounded-[6px] px-2.5 py-1 cursor-pointer hover:border-[#D1D5DB] bg-white">
                        상세
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ReviewAdminLayout>
  )
}
