import React from 'react'

/**
 * InfoRow — 라벨/값 쌍 (상세 패널, 정보 카드용)
 *
 * 입찰공고 앱 기준:
 *  - 라벨: 12px, text-muted, min-w 72px
 *  - 값:   13px, weight 500, text-primary
 *  - 행:   flex, justify-between, py-[9px], border-bottom #F3F4F6
 */

interface InfoRowProps {
  label: string
  value: React.ReactNode
  accent?: boolean
  mono?: boolean
  noBorder?: boolean
}

export function InfoRow({ label, value, accent, mono, noBorder }: InfoRowProps) {
  return (
    <div
      className={`flex items-start justify-between gap-3 py-[9px] ${
        noBorder ? '' : 'border-b border-[#F3F4F6]'
      }`}
    >
      <span className="text-[12px] text-muted-brand shrink-0 min-w-[72px] pt-px">
        {label}
      </span>
      <span
        className={`text-[13px] font-medium text-right ${
          accent ? 'text-accent' : 'text-title-brand'
        } ${mono ? 'font-mono text-[11px]' : ''}`}
      >
        {value}
      </span>
    </div>
  )
}

/** InfoSection — info-row 그룹 래퍼 */
export function InfoSection({
  title,
  children,
  className,
}: {
  title?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      {title && (
        <div className="text-[11px] font-bold text-muted-brand uppercase tracking-wide mb-2">
          {title}
        </div>
      )}
      <div>{children}</div>
    </div>
  )
}
