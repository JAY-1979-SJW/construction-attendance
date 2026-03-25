'use client'

import { useState } from 'react'
import Link from 'next/link'
import ReviewAdminLayout from '../../ReviewAdminLayout'
import { MOCK_APPROVALS } from '../../mock-data'

const TYPE_BADGE: Record<string, string> = {
  '기기 변경': 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]',
  '신규 등록': 'bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]',
  '예외 승인': 'bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]',
}

export default function ReviewApprovalsPage() {
  const [selected, setSelected] = useState<string[]>([])

  const toggle = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const fmtDt = (iso: string) =>
    new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <ReviewAdminLayout>
      <div className="p-5 md:p-7 bg-[#F5F7FA] min-h-screen">

        {/* 헤더 */}
        <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-[22px] font-bold text-[#0F172A] m-0 mb-1">승인 대기</h1>
            <p className="text-[13px] text-[#6B7280] m-0">기기 변경 · 신규 등록 · 예외 승인 처리</p>
          </div>
          <Link href="/review/admin/dashboard" className="text-[13px] text-[#6B7280] no-underline hover:text-[#F97316]">← 대시보드</Link>
        </div>

        {/* 요약 KPI */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: '기기 변경 요청', count: MOCK_APPROVALS.filter(a => a.type === '기기 변경').length, accent: '#2563EB' },
            { label: '신규 등록 요청', count: MOCK_APPROVALS.filter(a => a.type === '신규 등록').length, accent: '#16A34A' },
            { label: '예외 승인 요청', count: MOCK_APPROVALS.filter(a => a.type === '예외 승인').length, accent: '#D97706' },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-[12px] border border-[#E5E7EB] px-5 py-4"
              style={{ borderTopWidth: 3, borderTopColor: c.accent }}>
              <div className="text-[11px] font-semibold text-[#6B7280] mb-2 uppercase tracking-wide">{c.label}</div>
              <div className="flex items-baseline gap-1">
                <span className="text-[28px] font-bold text-[#0F172A] leading-none tabular-nums">{c.count}</span>
                <span className="text-[13px] text-[#6B7280]">건</span>
              </div>
            </div>
          ))}
        </div>

        {/* 일괄 처리 바 */}
        {selected.length > 0 && (
          <div className="flex items-center gap-3 mb-4 px-4 py-2.5 bg-[#FFF7ED] border border-[#FDE68A] rounded-[10px]">
            <span className="text-[13px] text-[#92400E] font-semibold">선택 {selected.length}건</span>
            <button className="text-[12px] font-semibold text-white bg-[#059669] hover:bg-[#047857] rounded-[6px] px-4 py-1.5 border-0 cursor-pointer transition-colors">
              일괄 승인
            </button>
            <button className="text-[12px] font-semibold text-white bg-[#DC2626] hover:bg-[#B91C1C] rounded-[6px] px-4 py-1.5 border-0 cursor-pointer transition-colors">
              일괄 거부
            </button>
            <button
              onClick={() => setSelected([])}
              className="ml-auto text-[12px] text-[#92400E] bg-none border-none cursor-pointer underline"
            >
              선택 해제
            </button>
          </div>
        )}

        {/* 테이블 */}
        <div className="bg-white rounded-[12px] border border-[#E5E7EB] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#F3F4F6]">
            <span className="text-[14px] font-semibold text-[#111827]">처리 대기 목록</span>
            <span className="text-[12px] text-[#9CA3AF]">{MOCK_APPROVALS.length}건</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#F3F4F6]">
                  <th className="px-4 py-2.5 w-10 border-b border-[#E5E7EB]">
                    <input type="checkbox" className="cursor-pointer" onChange={e => setSelected(e.target.checked ? MOCK_APPROVALS.map(a => a.id) : [])} />
                  </th>
                  {['근로자', '연락처', '현장', '유형', '기기', '요청일시', '처리'].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-[11px] font-bold text-[#4B5563] uppercase tracking-wider whitespace-nowrap border-b border-[#E5E7EB]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MOCK_APPROVALS.map(a => (
                  <tr key={a.id} className={`hover:bg-[#FAFAFA] transition-colors border-b border-[#F9FAFB] last:border-b-0 ${selected.includes(a.id) ? 'bg-[#EFF6FF]/40' : ''}`}>
                    <td className="px-4 py-3 text-center">
                      <input type="checkbox" checked={selected.includes(a.id)} onChange={() => toggle(a.id)} className="cursor-pointer" />
                    </td>
                    <td className="px-4 py-3 text-[13px] font-medium text-[#111827] whitespace-nowrap">{a.workerName}</td>
                    <td className="px-4 py-3 text-[13px] text-[#6B7280] whitespace-nowrap tabular-nums">{a.phone}</td>
                    <td className="px-4 py-3 text-[13px] text-[#6B7280] whitespace-nowrap">{a.siteName}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${TYPE_BADGE[a.type] ?? 'bg-[#F9FAFB] text-[#6B7280] border border-[#E5E7EB]'}`}>
                        {a.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[#6B7280] whitespace-nowrap">{a.deviceModel}</td>
                    <td className="px-4 py-3 text-[12px] text-[#374151] whitespace-nowrap tabular-nums">{fmtDt(a.requestedAt)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <button className="text-[11px] font-semibold text-white bg-[#16A34A] rounded-[6px] px-2.5 py-1 border-0 cursor-pointer hover:bg-[#15803D]">승인</button>
                        <button className="text-[11px] font-semibold text-[#DC2626] bg-white border border-[#FECACA] rounded-[6px] px-2.5 py-1 cursor-pointer hover:bg-[#FEF2F2]">거부</button>
                      </div>
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
