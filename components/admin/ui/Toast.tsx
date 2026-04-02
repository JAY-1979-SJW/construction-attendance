/**
 * Toast / Alert — 인라인 알림
 *
 * 기준 수치 (safety-docs 기준표):
 *   text-size : 12px
 *   padding   : p-2.5
 *   radius    : rounded-[8px]
 *   margin    : mb-3
 */
export function Toast({
  message,
  variant = 'success',
}: {
  message: string
  variant?: 'success' | 'error' | 'warning' | 'info'
}) {
  const cls: Record<string, string> = {
    success: 'bg-[#D1FAE5] text-status-approved',
    error:   'bg-red-light text-status-missing',
    warning: 'bg-yellow-light text-status-pending',
    info:    'bg-blue-light text-[#1E40AF]',
  }
  return (
    <div className={`mb-3 p-2.5 text-[12px] rounded-[8px] ${cls[variant]}`}>
      {message}
    </div>
  )
}

/**
 * MetaRow — 상세 패널용 key-value 행
 *
 * 기준 수치:
 *   label 폭 : 72px 고정
 *   text-size : 13px
 *   gap       : gap-3
 */
export function MetaRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-muted2-brand text-[13px] w-[72px] shrink-0">{label}</span>
      <span className="text-fore-brand text-[13px] min-w-0 break-words">{children}</span>
    </div>
  )
}
