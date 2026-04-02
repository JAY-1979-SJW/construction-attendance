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
      className="bg-card rounded-[12px] border border-brand px-4 py-4 hover:shadow-[0_2px_12px_rgba(0,0,0,0.08)] transition-all"
      style={{ borderTopWidth: 3, borderTopColor: accentColor }}
    >
      <div className="text-[11px] font-semibold text-muted-brand mb-2 tracking-wide uppercase">{label}</div>
      <div className="flex items-baseline gap-1 mb-1">
        <span className="text-[32px] font-bold text-title-brand leading-none tabular-nums">{value}</span>
        {unit && <span className="text-[12px] font-medium text-muted2-brand">{unit}</span>}
      </div>
      {sub && <div className="text-[11px] text-[#D1D5DB]">{sub}</div>}
    </div>
  )
  if (href) return <Link href={href} className="no-underline block">{inner}</Link>
  return inner
}
