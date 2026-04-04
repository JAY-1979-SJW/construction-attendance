/**
 * 대량 처리 툴바 공통 컨테이너.
 * count === 0 이면 렌더링하지 않음.
 * action 버튼은 children으로 전달.
 */
export function BulkToolbar({
  count,
  onClear,
  disabled,
  children,
}: {
  count: number
  onClear: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  if (count === 0) return null
  return (
    <div className="flex items-center gap-3 bg-card border border-brand rounded-[12px] px-4 py-2.5 flex-wrap">
      <span className="text-[13px] font-semibold text-body-brand">{count}건 선택됨</span>
      {children}
      <button
        onClick={onClear}
        disabled={disabled}
        className="px-3 py-1.5 text-[12px] font-semibold text-muted-brand border border-brand rounded-[8px] bg-transparent cursor-pointer hover:bg-surface disabled:opacity-50"
      >
        선택 해제
      </button>
    </div>
  )
}
