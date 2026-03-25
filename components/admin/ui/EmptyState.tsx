import React from 'react'

interface EmptyStateProps {
  title?: string
  description?: string
  action?: React.ReactNode
  icon?: React.ReactNode
}

export function EmptyState({
  title = '데이터가 없습니다.',
  description,
  action,
  icon,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon ? (
        <div className="text-[#D1D5DB] mb-3">{icon}</div>
      ) : (
        <div className="text-[#D1D5DB] mb-3">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      )}
      <div className="text-[14px] font-semibold text-[#374151] mb-1">{title}</div>
      {description && (
        <p className="text-[13px] text-[#9CA3AF] mb-4 max-w-xs leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
