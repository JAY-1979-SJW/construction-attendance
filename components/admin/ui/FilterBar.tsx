// FilterBar — 필터 영역 래퍼
export function FilterBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 mb-4 items-center flex-wrap">
      {children}
    </div>
  )
}

// FilterInput — 텍스트/날짜/숫자 입력 (h-9 고정)
export function FilterInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props
  return (
    <input
      {...rest}
      className={`h-9 px-3 border border-brand rounded-[8px] text-[13px] text-fore-brand bg-white
        focus:outline-none focus:border-accent placeholder:text-muted2-brand ${className ?? ''}`}
    />
  )
}

// FilterSelect — 드롭다운 (h-9 고정)
export function FilterSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, ...rest } = props
  return (
    <select
      {...rest}
      className={`h-9 px-3 border border-brand rounded-[8px] text-[13px] text-fore-brand bg-white
        cursor-pointer focus:outline-none focus:border-accent ${className ?? ''}`}
    />
  )
}

// FilterPill — 상태 필터 토글 버튼 (h-9 고정)
export function FilterPill({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 px-3 rounded-[8px] text-[12px] font-semibold border cursor-pointer transition-colors ${
        active
          ? 'bg-brand-accent border-accent text-white'
          : 'bg-white border-brand text-muted-brand hover:border-[#D1D5DB] hover:text-body-brand'
      }`}
    >
      {children}
    </button>
  )
}

// FilterSpacer — 좌우 구분 (필터 왼쪽, 액션 버튼 오른쪽 정렬용)
export function FilterSpacer() {
  return <div className="flex-1" />
}
