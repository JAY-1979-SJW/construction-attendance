import React from 'react'

export function PageHeader({
  title,
  description,
  badge,
  actions,
}: {
  title: string
  description?: string
  badge?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-5 gap-3">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-[20px] font-bold text-title-brand m-0">{title}</h1>
          {badge}
        </div>
        {description && (
          <p className="text-[12px] text-muted2-brand mt-1 leading-relaxed m-0">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-wrap">{actions}</div>
      )}
    </div>
  )
}

export function PageBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-semibold text-muted-brand bg-footer border border-brand rounded-full px-2.5 py-1 tabular-nums">
      {children}
    </span>
  )
}
