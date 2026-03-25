import Link from 'next/link'

interface KpiCardProps {
  label: string
  value: number | string
  unit?: string
  sub?: string
  accentColor?: string
  href?: string
}

export function KpiCard({ label, value, unit, sub, accentColor = '#E5E7EB', href }: KpiCardProps) {
  const inner = (
    <div
      className="bg-white rounded-[12px] border border-[#E5E7EB] px-4 py-4 hover:shadow-[0_2px_12px_rgba(0,0,0,0.08)] transition-all"
      style={{ borderTopWidth: 3, borderTopColor: accentColor }}
    >
      <div className="text-[11px] font-semibold text-[#6B7280] mb-2 tracking-wide uppercase">{label}</div>
      <div className="flex items-baseline gap-1 mb-1">
        <span className="text-[32px] font-bold text-[#0F172A] leading-none tabular-nums">{value}</span>
        {unit && <span className="text-[12px] font-medium text-[#9CA3AF]">{unit}</span>}
      </div>
      {sub && <div className="text-[11px] text-[#D1D5DB]">{sub}</div>}
    </div>
  )
  if (href) return <Link href={href} className="no-underline block">{inner}</Link>
  return inner
}
