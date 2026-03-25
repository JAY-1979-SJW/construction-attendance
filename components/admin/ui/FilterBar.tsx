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
      className={`h-9 px-3 border border-[#E5E7EB] rounded-[8px] text-[13px] text-[#111827] bg-white
        focus:outline-none focus:border-[#F97316] placeholder:text-[#9CA3AF] ${className ?? ''}`}
    />
  )
}

// FilterSelect — 드롭다운 (h-9 고정)
export function FilterSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, ...rest } = props
  return (
    <select
      {...rest}
      className={`h-9 px-3 border border-[#E5E7EB] rounded-[8px] text-[13px] text-[#111827] bg-white
        cursor-pointer focus:outline-none focus:border-[#F97316] ${className ?? ''}`}
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
          ? 'bg-[#F97316] border-[#F97316] text-white'
          : 'bg-white border-[#E5E7EB] text-[#6B7280] hover:border-[#D1D5DB] hover:text-[#374151]'
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
