import React from 'react'

/**
 * MobileCardList — 모바일에서 테이블 대신 카드형 리스트를 보여주는 래퍼
 *
 * 사용법:
 *   <MobileCardList
 *     items={data}
 *     renderCard={(item) => <MobileCard title={...}>...</MobileCard>}
 *     renderTable={() => <AdminTable>...</AdminTable>}
 *     emptyMessage="데이터가 없습니다."
 *   />
 *
 * - 모바일(sm 미만): renderCard로 카드 리스트
 * - 데스크(sm 이상): renderTable로 기존 테이블
 */

interface MobileCardListProps<T> {
  items: T[]
  renderCard: (item: T, index: number) => React.ReactNode
  renderTable: () => React.ReactNode
  emptyMessage?: string
  className?: string
  keyExtractor?: (item: T, index: number) => string
}

export function MobileCardList<T>({
  items,
  renderCard,
  renderTable,
  emptyMessage = '데이터가 없습니다.',
  className,
  keyExtractor,
}: MobileCardListProps<T>) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-muted2-brand text-[13px]">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className={className}>
      {/* 모바일: 카드 리스트 */}
      <div className="sm:hidden space-y-2">
        {items.map((item, i) => (
          <React.Fragment key={keyExtractor ? keyExtractor(item, i) : i}>
            {renderCard(item, i)}
          </React.Fragment>
        ))}
      </div>
      {/* 데스크: 테이블 */}
      <div className="hidden sm:block">
        {renderTable()}
      </div>
    </div>
  )
}

/**
 * MobileCard — 모바일 카드 리스트용 개별 카드
 */
export function MobileCard({
  title,
  subtitle,
  badge,
  meta,
  onClick,
  children,
  className: extraCls,
  style,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  badge?: React.ReactNode
  meta?: React.ReactNode
  onClick?: () => void
  children?: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <div
      onClick={onClick}
      style={style}
      className={`bg-card rounded-[12px] border border-brand p-4 ${onClick ? 'cursor-pointer hover:bg-surface active:bg-brand transition-colors' : ''} ${extraCls ?? ''}`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold text-title-brand truncate">{title}</div>
          {subtitle && <div className="text-[13px] text-muted-brand mt-0.5 truncate">{subtitle}</div>}
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
      </div>
      {meta && <div className="text-[12px] text-muted2-brand mt-1">{meta}</div>}
      {children}
    </div>
  )
}

/**
 * MobileCardField — 카드 내부 보조 필드 (라벨:값 쌍)
 */
export function MobileCardField({
  label,
  value,
  className,
}: {
  label: string
  value: React.ReactNode
  className?: string
}) {
  return (
    <div className={`flex items-center justify-between text-[12px] ${className ?? ''}`}>
      <span className="text-muted2-brand shrink-0">{label}</span>
      <span className="text-body-brand font-medium text-right ml-2 truncate min-w-0">{value}</span>
    </div>
  )
}

/**
 * MobileCardFields — 여러 필드를 세로로 배치
 */
export function MobileCardFields({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`mt-2 space-y-1 ${className ?? ''}`}>
      {children}
    </div>
  )
}

/**
 * MobileCardActions — 카드 하단 액션 버튼 영역
 */
export function MobileCardActions({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`mt-3 pt-2 border-t border-brand flex items-center gap-1.5 flex-wrap ${className ?? ''}`}>
      {children}
    </div>
  )
}
