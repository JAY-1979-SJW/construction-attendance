'use client'

import { useState } from 'react'
import Link from 'next/link'
import ReviewAdminLayout from '../../ReviewAdminLayout'
import { MOCK_ATTENDANCE } from '../../mock-data'

const STATUS_LABEL: Record<string, string> = {
  WORKING: '근무중', COMPLETED: '퇴근', MISSING_CHECKOUT: '미퇴근', EXCEPTION: '예외',
}
const STATUS_BADGE: Record<string, string> = {
  WORKING:          'bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]',
  COMPLETED:        'bg-[#F9FAFB] text-[#6B7280] border border-[#E5E7EB]',
  MISSING_CHECKOUT: 'bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]',
  EXCEPTION:        'bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]',
}

const fmtTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-'

export default function ReviewAttendancePage() {
  const [statusFilter, setStatusFilter] = useState('')

  const items = statusFilter
    ? MOCK_ATTENDANCE.filter(r => r.status === statusFilter)
    : [...MOCK_ATTENDANCE].sort((a, b) => {
        const order: Record<string, number> = { MISSING_CHECKOUT: 0, EXCEPTION: 1, WORKING: 2, COMPLETED: 3 }
        return (order[a.status] ?? 9) - (order[b.status] ?? 9)
      })

  return (
    <ReviewAdminLayout>
      <div className="p-5 md:p-7 bg-[#F5F7FA] min-h-screen">

        {/* 헤더 */}
        <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-[22px] font-bold text-[#0F172A] m-0 mb-1">출근현황</h1>
            <p className="text-[13px] text-[#6B7280] m-0">2026-03-25 기준 · 전체 {MOCK_ATTENDANCE.length}건</p>
          </div>
          <Link href="/review/admin/dashboard" className="text-[13px] text-[#6B7280] no-underline hover:text-[#F97316]">← 대시보드</Link>
        </div>

        {/* 필터 */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <span className="text-[12px] text-[#6B7280] font-semibold">상태 필터:</span>
          {[
            { value: '',                 label: '전체' },
            { value: 'MISSING_CHECKOUT', label: '미퇴근' },
            { value: 'EXCEPTION',        label: '예외' },
            { value: 'WORKING',          label: '근무중' },
            { value: 'COMPLETED',        label: '퇴근' },
          ].map(f => (
            <button key={f.value} onClick={() => setStatusFilter(f.value)}
              className={`text-[12px] px-3 py-1.5 rounded-[7px] border cursor-pointer transition-colors ${
                statusFilter === f.value
                  ? 'bg-[#F97316] text-white border-[#F97316]'
                  : 'bg-white text-[#6B7280] border-[#E5E7EB] hover:border-[#D1D5DB]'
              }`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* 테이블 */}
        <div className="bg-white rounded-[12px] border border-[#E5E7EB] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#F3F4F6]">
            <span className="text-[14px] font-semibold text-[#111827]">출퇴근 목록</span>
            <span className="text-[12px] text-[#9CA3AF]">{items.length}건</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#F9FAFB]">
                  {['이름', '소속', '현장', '출근', '퇴근', '상태', '비고'].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider whitespace-nowrap border-b border-[#F3F4F6]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map(r => (
                  <tr key={r.id}
                    className={`hover:bg-[#FAFAFA] transition-colors border-b border-[#F9FAFB] last:border-b-0 ${r.status === 'MISSING_CHECKOUT' || r.status === 'EXCEPTION' ? 'bg-[#FFFBEB]/30' : ''}`}>
                    <td className="px-4 py-3 text-[13px] font-medium text-[#111827] whitespace-nowrap">{r.workerName}</td>
                    <td className="px-4 py-3 text-[13px] text-[#6B7280] whitespace-nowrap">{r.company}</td>
                    <td className="px-4 py-3 text-[13px] text-[#6B7280] whitespace-nowrap">{r.siteName}</td>
                    <td className="px-4 py-3 text-[13px] text-[#374151] whitespace-nowrap tabular-nums">{fmtTime(r.checkInAt)}</td>
                    <td className="px-4 py-3 text-[13px] text-[#374151] whitespace-nowrap tabular-nums">{fmtTime(r.checkOutAt)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[r.status] ?? 'bg-[#F9FAFB] text-[#6B7280] border border-[#E5E7EB]'}`}>
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {(r.status === 'MISSING_CHECKOUT' || r.status === 'EXCEPTION') && (
                        <button className="text-[11px] text-[#F97316] border border-[#FDBA74] rounded-[6px] px-2 py-0.5 hover:bg-[#FFF7ED] transition-colors cursor-pointer bg-transparent">
                          처리
                        </button>
                      )}
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
