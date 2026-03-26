import LaborSidebar from './LaborSidebar'

export default function LaborLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <LaborSidebar />
      <main className="ml-[220px] min-h-screen bg-[#F5F7FA]">
        {/* 상단 헤더 고정 */}
        <header className="sticky top-0 z-10 bg-white border-b border-[#E5E7EB]">
          <div className="h-1 bg-[#F97316]" />
          <div className="h-[48px] flex items-center px-5">
            <span className="text-[14px] font-bold text-[#0F172A]">노무관리 시스템</span>
          </div>
        </header>
        {children}
      </main>
    </div>
  )
}
