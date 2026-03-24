'use client'

import { usePathname } from 'next/navigation'
import AdminSidebar from './AdminSidebar'

export default function AdminLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // 로그인 페이지는 레이아웃 없이 그대로 렌더링
  if (pathname === '/admin/login') return <>{children}</>

  return (
    <div className="flex min-h-screen bg-brand">
      <AdminSidebar />
      <div className="lg:ml-[240px] flex-1 min-h-screen pt-12 lg:pt-0">
        {children}
      </div>
    </div>
  )
}
