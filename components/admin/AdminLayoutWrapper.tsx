'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import AdminSidebar from './AdminSidebar'

export default function AdminLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSidebarOpen(window.innerWidth >= 1024)
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false)
    }
  }, [pathname])

  if (pathname === '/admin/login') return <>{children}</>

  return (
    <div className="flex min-h-screen bg-[#F5F7FA]">
      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* 모바일 오버레이 */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 메인 영역 */}
      <div
        className="flex-1 min-h-screen flex flex-col transition-all duration-300"
        style={{ marginLeft: sidebarOpen ? 240 : 0 }}
      >
        {/* TopBar — 메인페이지 헤더 언어 */}
        <header className="sticky top-0 z-20 shrink-0">
          {/* 4px 오렌지 상단 라인 */}
          <div className="h-1 bg-[#F97316]" />
          {/* 흰색 헤더 바 */}
          <div className="bg-white border-b border-[#F3F4F6] flex items-center h-[52px] px-4 gap-3">
            {/* 햄버거 */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="flex flex-col gap-[5px] p-2 rounded-[8px] hover:bg-[#F3F4F6] transition-colors"
              aria-label="메뉴 토글"
            >
              <span
                className={`block w-5 h-[2px] bg-[#374151] transition-all duration-200 origin-center ${
                  sidebarOpen ? 'rotate-45 translate-y-[7px]' : ''
                }`}
              />
              <span
                className={`block w-5 h-[2px] bg-[#374151] transition-all duration-200 ${
                  sidebarOpen ? 'opacity-0 scale-x-0' : ''
                }`}
              />
              <span
                className={`block w-5 h-[2px] bg-[#374151] transition-all duration-200 origin-center ${
                  sidebarOpen ? '-rotate-45 -translate-y-[7px]' : ''
                }`}
              />
            </button>

            {/* 브랜드 (사이드바 접힌 상태에서 표시) */}
            {!sidebarOpen && (
              <Link href="/admin" className="flex items-center gap-2 no-underline">
                <div className="w-7 h-7 bg-[#FFF7ED] rounded-[8px] flex items-center justify-center shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M9 22V12h6v10" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span className="text-[14px] font-bold text-[#0F172A]">
                  해한<span className="text-[#F97316]">AI</span>
                </span>
              </Link>
            )}

            {/* 관리자 포털 뱃지 */}
            <span className="ml-auto text-[11px] font-semibold text-[#F97316] border border-[#FDBA74] bg-[#FFF7ED] rounded-full px-3 py-[3px]">
              관리자 포털
            </span>
          </div>
        </header>

        {/* 콘텐츠 */}
        <div className="flex-1 bg-[#F5F7FA]">
          {children}
        </div>
      </div>
    </div>
  )
}
