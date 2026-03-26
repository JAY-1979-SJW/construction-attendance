import React from 'react'

// PageShell — 페이지 기본 패딩 래퍼
export function PageShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`p-5 md:p-6 bg-[#F5F7FA] ${className ?? ''}`}>
      {children}
    </div>
  )
}

// SectionCard — 카드 컨테이너 (bg-white, 12px 라운드, 1px 보더)
export function SectionCard({
  children,
  className,
  padding = true,
}: {
  children: React.ReactNode
  className?: string
  padding?: boolean
}) {
  return (
    <div
      className={`bg-white rounded-[12px] border border-[#E5E7EB] ${
        padding ? 'p-5' : ''
      } ${className ?? ''}`}
    >
      {children}
    </div>
  )
}

// SectionDivider — 섹션 간 여백 구분선
export function SectionDivider() {
  return <div className="border-t border-[#F3F4F6] my-5" />
}
