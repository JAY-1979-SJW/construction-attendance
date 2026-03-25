'use client'

import Link from 'next/link'
import ReviewAdminLayout from '../../ReviewAdminLayout'
import { MOCK_SITES } from '../../mock-data'

export default function ReviewSitesPage() {
  return (
    <ReviewAdminLayout>
      <div className="p-5 md:p-7 bg-[#F5F7FA] min-h-screen">

        {/* 헤더 */}
        <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-[22px] font-bold text-[#0F172A] m-0 mb-1">현장 관리</h1>
            <p className="text-[13px] text-[#6B7280] m-0">등록된 현장 {MOCK_SITES.length}개</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/review/admin/dashboard" className="text-[13px] text-[#6B7280] no-underline hover:text-[#F97316]">← 대시보드</Link>
            <button className="text-[13px] font-semibold text-white bg-[#F97316] hover:bg-[#EA580C] rounded-[8px] px-4 py-2 border-0 cursor-pointer transition-colors">
              + 현장 등록
            </button>
          </div>
        </div>

        {/* 현장 카드 목록 */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {MOCK_SITES.map(site => (
            <div key={site.id}
              className={`bg-white rounded-[12px] border overflow-hidden hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)] transition-all ${
                site.isActive ? 'border-[#E5E7EB]' : 'border-[#E5E7EB] opacity-60'
              }`}
            >
              <div className="px-5 pt-4 pb-3 border-b border-[#F3F4F6]">
                <div className="flex items-start justify-between mb-1">
                  <span className="text-[15px] font-semibold text-[#111827]">{site.name}</span>
                  <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    site.isActive
                      ? 'bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]'
                      : 'bg-[#F9FAFB] text-[#9CA3AF] border border-[#E5E7EB]'
                  }`}>
                    {site.isActive ? '운영중' : '종료'}
                  </span>
                </div>
                <p className="text-[12px] text-[#6B7280] m-0 leading-snug">{site.address}</p>
              </div>
              <div className="px-5 py-3">
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="text-center">
                    <div className="text-[20px] font-bold text-[#0F172A] tabular-nums">{site.todayCount}</div>
                    <div className="text-[10px] text-[#9CA3AF]">오늘 출근</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[20px] font-bold text-[#0F172A] tabular-nums">{site.workerCount}</div>
                    <div className="text-[10px] text-[#9CA3AF]">등록 인원</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[20px] font-bold text-[#0F172A] tabular-nums">{site.allowedRadius}</div>
                    <div className="text-[10px] text-[#9CA3AF]">반경(m)</div>
                  </div>
                </div>
                <div className="text-[11px] text-[#9CA3AF]">개설: {site.openedAt}</div>
              </div>
              <div className="px-5 py-3 border-t border-[#F3F4F6] flex gap-2">
                <button className="flex-1 text-[12px] font-semibold text-[#374151] bg-[#F9FAFB] border border-[#E5E7EB] rounded-[7px] py-1.5 cursor-pointer hover:border-[#D1D5DB]">
                  상세 보기
                </button>
                <Link href="/review/admin/attendance"
                  className="flex-1 no-underline text-center text-[12px] font-semibold text-[#F97316] bg-[#FFF7ED] border border-[#FDBA74] rounded-[7px] py-1.5 hover:bg-[#FFEDD5]">
                  출근현황
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* 현장 요약 표 */}
        <div className="mt-6 bg-white rounded-[12px] border border-[#E5E7EB] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#F3F4F6]">
            <span className="text-[14px] font-semibold text-[#111827]">현장 목록</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#F9FAFB]">
                  {['현장명', '주소', '오늘 출근', '등록 인원', '허용반경', '개설일', '상태'].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider whitespace-nowrap border-b border-[#F3F4F6]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MOCK_SITES.map(site => (
                  <tr key={site.id} className="hover:bg-[#FAFAFA] transition-colors border-b border-[#F9FAFB] last:border-b-0">
                    <td className="px-4 py-3 text-[13px] font-medium text-[#111827] whitespace-nowrap">{site.name}</td>
                    <td className="px-4 py-3 text-[13px] text-[#6B7280]">{site.address}</td>
                    <td className="px-4 py-3 text-[13px] font-semibold text-[#16A34A] tabular-nums">{site.todayCount}명</td>
                    <td className="px-4 py-3 text-[13px] text-[#374151] tabular-nums">{site.workerCount}명</td>
                    <td className="px-4 py-3 text-[13px] text-[#374151] tabular-nums">{site.allowedRadius}m</td>
                    <td className="px-4 py-3 text-[12px] text-[#9CA3AF] tabular-nums">{site.openedAt}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        site.isActive
                          ? 'bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]'
                          : 'bg-[#F9FAFB] text-[#9CA3AF] border border-[#E5E7EB]'
                      }`}>
                        {site.isActive ? '운영중' : '종료'}
                      </span>
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
