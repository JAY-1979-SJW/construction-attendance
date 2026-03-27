import React from 'react'

/* ─── 공통 스타일 상수 ──────────────────────────────────────── */
const INPUT_CLS =
  'w-full h-10 px-3 text-[13px] text-[#111827] bg-white border border-[#E5E7EB] rounded-[8px] outline-none placeholder:text-[#9CA3AF] focus:border-[#F97316] focus:ring-2 focus:ring-[rgba(249,115,22,0.12)] transition-colors disabled:bg-[#F9FAFB] disabled:text-[#9CA3AF] disabled:cursor-not-allowed'

const SELECT_CLS =
  'w-full h-10 px-3 text-[13px] text-[#111827] bg-white border border-[#E5E7EB] rounded-[8px] outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[rgba(249,115,22,0.12)] transition-colors disabled:bg-[#F9FAFB] disabled:text-[#9CA3AF] disabled:cursor-not-allowed cursor-pointer appearance-none'

const TEXTAREA_CLS =
  'w-full px-3 py-2.5 text-[13px] text-[#111827] bg-white border border-[#E5E7EB] rounded-[8px] outline-none placeholder:text-[#9CA3AF] focus:border-[#F97316] focus:ring-2 focus:ring-[rgba(249,115,22,0.12)] transition-colors resize-none disabled:bg-[#F9FAFB] disabled:text-[#9CA3AF]'

/* ─── FormField (label + helper + error 래퍼) ─────────────── */
export function FormField({
  label,
  required,
  helper,
  error,
  children,
  className,
}: {
  label?: string
  required?: boolean
  helper?: string
  error?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`mb-4 last:mb-0 ${className ?? ''}`}>
      {label && (
        <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">
          {label}
          {required && <span className="text-[#EF4444] ml-0.5">*</span>}
        </label>
      )}
      {children}
      {helper && !error && (
        <p className="text-[11px] text-[#9CA3AF] mt-1 m-0">{helper}</p>
      )}
      {error && (
        <p className="text-[11px] text-[#EF4444] mt-1 m-0">{error}</p>
      )}
    </div>
  )
}

/* ─── FormInput ───────────────────────────────────────────── */
export function FormInput({
  label,
  required,
  helper,
  error,
  className,
  ...props
}: {
  label?: string
  required?: boolean
  helper?: string
  error?: string
  className?: string
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className'>) {
  return (
    <FormField label={label} required={required} helper={helper} error={error} className={className}>
      <input
        {...props}
        className={`${INPUT_CLS} ${error ? 'border-[#EF4444] focus:border-[#EF4444] focus:ring-[rgba(239,68,68,0.12)]' : ''}`}
      />
    </FormField>
  )
}

/* ─── FormSelect ──────────────────────────────────────────── */
export function FormSelect({
  label,
  required,
  helper,
  error,
  options,
  placeholder,
  className,
  ...props
}: {
  label?: string
  required?: boolean
  helper?: string
  error?: string
  options: { value: string; label: string }[]
  placeholder?: string
  className?: string
} & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'className'>) {
  return (
    <FormField label={label} required={required} helper={helper} error={error} className={className}>
      <select
        {...props}
        className={`${SELECT_CLS} ${error ? 'border-[#EF4444]' : ''}`}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </FormField>
  )
}

/* ─── FormTextarea ────────────────────────────────────────── */
export function FormTextarea({
  label,
  required,
  helper,
  error,
  className,
  rows = 3,
  ...props
}: {
  label?: string
  required?: boolean
  helper?: string
  error?: string
  className?: string
  rows?: number
} & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'className' | 'rows'>) {
  return (
    <FormField label={label} required={required} helper={helper} error={error} className={className}>
      <textarea
        {...props}
        rows={rows}
        className={`${TEXTAREA_CLS} ${error ? 'border-[#EF4444]' : ''}`}
      />
    </FormField>
  )
}

/* ─── FormGrid (2열 레이아웃) ─────────────────────────────── */
export function FormGrid({ children, cols = 2, className }: {
  children: React.ReactNode
  cols?: 2 | 3
  className?: string
}) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-${cols} gap-x-4 gap-y-0 ${className ?? ''}`}>
      {children}
    </div>
  )
}

/* ─── ModalFooter (저장/취소 통일) ────────────────────────── */
export function ModalFooter({ children, className }: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`flex items-center justify-end gap-2 pt-4 mt-4 border-t border-[#F3F4F6] ${className ?? ''}`}>
      {children}
    </div>
  )
}
