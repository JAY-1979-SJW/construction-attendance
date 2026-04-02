import LaborSidebar from './LaborSidebar'

export default function LaborLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen bg-surface">
      <LaborSidebar />
      <main className="ml-[220px] h-screen flex flex-col overflow-hidden bg-brand">
        {/* 상단 헤더 — shrink-0으로 고정, 스크롤 대상 아님 */}
        <header className="shrink-0 z-10 bg-card border-b border-brand">
          <div className="h-1 bg-brand-accent" />
          <div className="h-[48px] flex items-center px-5">
            <span className="text-[14px] font-bold text-title-brand">노무관리 시스템</span>
          </div>
        </header>
        {/* 콘텐츠 독립 스크롤 */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
