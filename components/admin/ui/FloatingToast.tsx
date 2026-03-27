'use client'

import { useEffect, useState } from 'react'

/**
 * FloatingToast — 화면 우하단 고정 알림
 *
 * 기준 수치 (ui-spec):
 *   위치      : fixed bottom-6 right-6
 *   z-index   : 100
 *   text-size : 13px
 *   radius    : 8px (TOAST_RADIUS)
 *   padding   : px-5 py-3
 *   자동 닫힘  : 3초 (기본)
 */
export function FloatingToast({
  message,
  ok = true,
  duration = 3000,
  onDone,
}: {
  message: string
  ok?: boolean
  duration?: number
  onDone?: () => void
}) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false)
      onDone?.()
    }, duration)
    return () => clearTimeout(t)
  }, [duration, onDone])

  if (!visible) return null

  return (
    <div
      className={`fixed bottom-6 right-6 z-[100] px-5 py-3 rounded-[8px] shadow-xl text-[13px] font-semibold text-white transition-all ${
        ok ? 'bg-[#059669]' : 'bg-[#B91C1C]'
      }`}
    >
      {message}
    </div>
  )
}
