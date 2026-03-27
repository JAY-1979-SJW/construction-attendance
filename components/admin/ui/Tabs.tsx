/**
 * Tabs — 탭 바 (상단 border-bottom 스타일)
 *
 * 기준 수치 (ui-spec):
 *   font      : 13px (TAB_FONT)
 *   py        : 10px (TAB_PY)
 *   px        : 16px (TAB_PX)
 *   active    : text-[#F97316], border-b-[#F97316], font-semibold
 *   inactive  : text-[#6B7280], border-transparent
 *   container : bg-white, rounded-t-[12px], border-b
 */
export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: T; label: string; badge?: number }[]
  active: T
  onChange: (key: T) => void
}) {
  return (
    <div className="flex border-b border-[#E5E7EB] mb-0 flex-wrap gap-[2px] bg-white rounded-t-[12px] px-2 pt-1">
      {tabs.map(t => (
        <button
          key={t.key}
          className={`px-4 py-[10px] border-none border-b-2 bg-transparent cursor-pointer text-[13px] -mb-px transition-colors ${
            active === t.key
              ? 'text-[#F97316] border-b-[#F97316] font-semibold border-solid'
              : 'text-[#6B7280] border-transparent hover:text-[#374151]'
          }`}
          onClick={() => onChange(t.key)}
        >
          {t.label}
          {t.badge != null && t.badge > 0 && (
            <span className="ml-1.5 bg-[#DC2626] text-white rounded-full px-[6px] text-[11px] min-w-[18px] text-center inline-block">
              {t.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
