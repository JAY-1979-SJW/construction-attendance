'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import AdminSidebar from './AdminSidebar'

export default function AdminLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // 모바일에서 기본값 닫힘
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSidebarOpen(window.innerWidth >= 1024)
    }
  }, [])

  // 페이지 이동 시 모바일은 닫기
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false)
    }
  }, [pathname])

  if (pathname === '/admin/login') return <>{children}</>

  return (
    <div className="flex min-h-screen bg-brand">
      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* 모바일 오버레이 */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 z-30 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        className="flex-1 min-h-screen flex flex-col transition-all duration-300"
        style={{ marginLeft: sidebarOpen ? 240 : 0 }}
      >
        {/* 상단 햄버거 바 */}
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
        </div>

        <div className="flex-1">
          {children}
        </div>
      </div>
    </div>
  )
}
