'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
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
    <div className="flex min-h-screen" style={{ background: '#F5F7FA' }}>
      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* 모바일 오버레이 */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 메인 영역 */}
      <div
        className="flex-1 min-h-screen flex flex-col transition-all duration-300"
        style={{ marginLeft: sidebarOpen ? 240 : 0 }}
      >
        {/* TopBar — 네이비 구조 요소 */}
        <div
          className="sticky top-0 z-20 flex items-center h-11 px-4 shrink-0 border-b"
          style={{
            background: '#071020',
            borderBottomColor: 'rgba(255,255,255,0.06)',
          }}
        >
          {/* 햄버거 */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex flex-col gap-[5px] p-2 rounded-md hover:bg-white/10 transition-colors"
            aria-label="메뉴 토글"
          >
            <span
              className={`block w-5 h-[2px] bg-white/70 transition-all duration-200 origin-center ${
                sidebarOpen ? 'rotate-45 translate-y-[7px]' : ''
              }`}
            />
            <span
              className={`block w-5 h-[2px] bg-white/70 transition-all duration-200 ${
                sidebarOpen ? 'opacity-0 scale-x-0' : ''
              }`}
            />
            <span
              className={`block w-5 h-[2px] bg-white/70 transition-all duration-200 origin-center ${
                sidebarOpen ? '-rotate-45 -translate-y-[7px]' : ''
              }`}
            />
          </button>

          {/* 브랜드 */}
          <span className="ml-3 text-[13px] font-semibold select-none" style={{ color: 'rgba(255,255,255,0.5)' }}>
            해한<span style={{ color: '#F97316' }}>Ai</span>
          </span>
        </div>

        {/* 콘텐츠 — 라이트 배경 */}
        <div className="flex-1" style={{ background: '#F5F7FA' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
