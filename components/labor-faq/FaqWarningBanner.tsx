'use client'

interface Props {
  level: 'INFO' | 'WARN' | 'BLOCK'
  message: string
  detail?: string
  onDismiss?: () => void
}

const STYLES: Record<Props['level'], { wrap: string; icon: string; title: string }> = {
  INFO:  { wrap: 'bg-blue-50 border-blue-200 text-blue-800',   icon: 'ℹ️', title: '참고' },
  WARN:  { wrap: 'bg-amber-50 border-amber-300 text-amber-900', icon: '⚠️', title: '주의' },
  BLOCK: { wrap: 'bg-red-50 border-red-400 text-red-900',       icon: '🚫', title: '차단됨' },
}

export default function FaqWarningBanner({ level, message, detail, onDismiss }: Props) {
  const s = STYLES[level]
  return (
    <div className={`rounded-lg border px-4 py-3 flex items-start gap-3 ${s.wrap}`}>
      <span className="text-lg shrink-0 mt-0.5">{s.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{s.title}: {message}</p>
        {detail && <p className="text-xs mt-0.5 opacity-80">{detail}</p>}
      </div>
      {onDismiss && level !== 'BLOCK' && (
        <button
          onClick={onDismiss}
          className="text-xs opacity-50 hover:opacity-80 shrink-0"
        >
          닫기
        </button>
      )}
    </div>
  )
}
