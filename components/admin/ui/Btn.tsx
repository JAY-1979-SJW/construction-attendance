type BtnVariant = 'primary' | 'orange' | 'secondary' | 'danger' | 'success' | 'ghost'
type BtnSize = 'xs' | 'sm' | 'md'

interface BtnProps {
  children: React.ReactNode
  onClick?: () => void
  variant?: BtnVariant
  size?: BtnSize
  disabled?: boolean
  className?: string
  type?: 'button' | 'submit' | 'reset'
}

export function Btn({
  children,
  onClick,
  variant = 'secondary',
  size = 'md',
  disabled,
  className,
  type = 'button',
}: BtnProps) {
  const base =
    'inline-flex items-center justify-center gap-1.5 font-semibold cursor-pointer border-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

  const sizes: Record<BtnSize, string> = {
    xs: 'text-[11px] px-2.5 py-[5px] rounded-[5px]',
    sm: 'text-[12px] px-3 py-1.5 rounded-[7px]',
    md: 'text-[13px] px-3.5 py-[7px] rounded-[8px]',
  }

  // primary = navy, orange = CTA, secondary = white ghost
  const variants: Record<BtnVariant, string> = {
    primary:   'bg-[#F5F7FA] text-[#374151] border border-[#E5E7EB] hover:bg-[#E5E7EB]',
    orange:    'bg-[#F97316] text-white hover:bg-[#EA580C]',
    secondary: 'bg-white text-[#374151] border border-[#E5E7EB] hover:bg-[#F9FAFB] hover:border-[#D1D5DB]',
    danger:    'bg-[#B91C1C] text-white hover:bg-[#991B1B]',
    success:   'bg-[#059669] text-white hover:bg-[#047857]',
    ghost:     'bg-transparent text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#374151] border border-transparent',
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className ?? ''}`}
    >
      {children}
    </button>
  )
}
