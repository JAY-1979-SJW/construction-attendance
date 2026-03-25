'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/review/admin/dashboard',   label: '대시보드',    icon: '📊' },
  { href: '/review/admin/attendance',  label: '출근현황',    icon: '📋' },
  { href: '/review/admin/workers',     label: '근로자 관리', icon: '👷' },
  { href: '/review/admin/sites',       label: '현장 관리',   icon: '🏗️' },
  { href: '/review/admin/approvals',   label: '승인 대기',   icon: '✅' },
]

export default function ReviewAdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const pathname = usePathname()

  return (
    <div className="flex min-h-screen bg-[#1B2838] font-sans">

      {/* 사이드바 */}
      <aside
        className={`fixed top-0 left-0 h-full z-40 flex flex-col transition-all duration-300 ${
          sidebarOpen ? 'w-[240px]' : 'w-0 overflow-hidden'
        } bg-[#141E2A] border-r border-[rgba(91,164,217,0.08)]`}
      >
        {/* 로고 */}
        <div className="flex items-center gap-2 px-5 py-4 border-b border-[rgba(91,164,217,0.08)]">
          <div className="w-7 h-7 bg-[#FFF7ED] rounded-[7px] flex items-center justify-center shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9 22V12h6v10" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-[13px] font-bold text-white">해한<span className="text-[#F47920]">Ai</span> 출퇴근</span>
        </div>

        {/* 검토용 배지 — 약화 */}
        <div className="mx-4 mt-3 mb-2 px-3 py-1 border border-[#2D3A4A] rounded-[6px]">
          <span className="text-[10px] text-[#4a5568]">검토용 · Mock Data</span>
        </div>

        {/* 네비게이션 */}
        <nav className="flex-1 px-3 py-2">
          {NAV.map(item => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-[8px] mb-0.5 no-underline text-[13px] transition-colors ${
                  active
                    ? 'bg-[#F47920]/15 text-[#F47920] font-semibold'
                    : 'text-[#A0AEC0] hover:bg-white/5 hover:text-white'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* 하단 */}
        <div className="px-4 py-3 border-t border-[rgba(91,164,217,0.08)]">
          <div className="text-[11px] text-[#4a5568] text-center">검토용 · 운영 데이터 없음</div>
        </div>
      </aside>

      {/* 모바일 오버레이 */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 메인 콘텐츠 */}
      <div
        className="flex-1 min-h-screen flex flex-col transition-all duration-300"
        style={{ marginLeft: sidebarOpen ? 240 : 0 }}
      >
        {/* 상단 바 */}
        <div className="sticky top-0 z-20 flex items-center h-11 px-4 bg-[#071020]/90 backdrop-blur border-b border-[rgba(91,164,217,0.08)] shrink-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex flex-col gap-[5px] p-2 rounded-md hover:bg-white/10 transition-colors"
            aria-label="메뉴 토글"
          >
            <span className={`block w-5 h-[2px] bg-white/80 transition-all duration-200 origin-center ${sidebarOpen ? 'rotate-45 translate-y-[7px]' : ''}`} />
            <span className={`block w-5 h-[2px] bg-white/80 transition-all duration-200 ${sidebarOpen ? 'opacity-0 scale-x-0' : ''}`} />
            <span className={`block w-5 h-[2px] bg-white/80 transition-all duration-200 origin-center ${sidebarOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} />
          </button>
          <span className="ml-3 text-[13px] text-[#5a6a80] font-medium select-none">
            해한<span className="text-[#F47920]">Ai</span> 출퇴근관리
          </span>
          <span className="ml-auto text-[11px] text-[#F47920] bg-[#F47920]/10 border border-[#F47920]/30 px-2 py-0.5 rounded-full font-semibold">
            검토용 화면
          </span>
        </div>

        <div className="flex-1">
          {children}
        </div>
      </div>
    </div>
  )
}
