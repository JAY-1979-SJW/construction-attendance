import React from 'react'

// PageShell — 페이지 기본 패딩 래퍼 (header prop 전달 시 sticky 헤더 자동 적용)
export function PageShell({ children, header, className }: {
  children: React.ReactNode
  header?: React.ReactNode
  className?: string
}) {
  if (header) {
    return (
      <div className="bg-brand">
        <div className="sticky top-0 z-10 bg-brand px-5 md:px-6 pt-5 md:pt-6 pb-3">
          {header}
        </div>
        <div className={`px-5 md:px-6 pb-5 md:pb-6 ${className ?? ''}`}>
          {children}
        </div>
      </div>
    )
  }
  return (
    <div className={`p-5 md:p-6 bg-brand ${className ?? ''}`}>
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
      className={`bg-card rounded-[12px] border border-brand ${
        padding ? 'p-5' : ''
      } ${className ?? ''}`}
    >
      {children}
    </div>
  )
}

// SectionDivider — 섹션 간 여백 구분선
export function SectionDivider() {
  return <div className="border-t border-brand my-5" />
}
