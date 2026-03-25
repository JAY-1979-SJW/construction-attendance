export function PageHeader({
  title,
  badge,
  actions,
}: {
  title: string
  badge?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
      <div className="flex items-center gap-3">
        <h1 className="text-[20px] font-bold text-[#0F172A] m-0">{title}</h1>
        {badge}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-wrap">{actions}</div>
      )}
    </div>
  )
}

export function PageBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-semibold text-[#6B7280] bg-[#F3F4F6] border border-[#E5E7EB] rounded-full px-2.5 py-1 tabular-nums">
      {children}
    </span>
  )
}
