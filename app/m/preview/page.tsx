'use client'

import { useState } from 'react'
import Link from 'next/link'

const SCREENS = [
  { src: '/guide/01-_admin.png', label: '대시보드' },
  { src: '/guide/06-_admin_attendance.png', label: '출퇴근 관리' },
  { src: '/guide/02-_admin_sites.png', label: '현장 관리' },
  { src: '/guide/07-_admin_work-confirmations.png', label: '공수 확인' },
  { src: '/guide/12-_admin_contracts.png', label: '근로계약서' },
  { src: '/guide/08-_admin_wage.png', label: '노임 관리' },
]

export default function PreviewPage() {
  const [view, setView] = useState<string | null>(null)

  return (
    <div className="px-5 py-6 pb-10">
      <Link href="/m" className="text-[13px] text-gray-400 no-underline mb-4 block">← 메인</Link>
      <h1 className="text-[22px] font-bold text-gray-900 mb-1">화면 미리보기</h1>
      <p className="text-[14px] text-gray-500 mb-6">관리자 포털 실제 화면을 확인하세요</p>

      <div className="space-y-2">
        {SCREENS.map(s => (
          <button key={s.label} onClick={() => setView(s.src)}
            className="flex items-center gap-3 w-full bg-white rounded-xl px-4 py-3.5 border border-gray-100 text-left cursor-pointer active:bg-gray-50">
            <span className="text-[18px] shrink-0">📸</span>
            <span className="text-[14px] font-semibold text-gray-900 flex-1">{s.label}</span>
            <span className="text-gray-300 shrink-0">›</span>
          </button>
        ))}
      </div>

      {/* 이미지 뷰어 — 팝업 (짧은 미리보기용으로만) */}
      {view && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-3" onClick={() => setView(null)}>
          <div className="bg-white rounded-2xl overflow-hidden w-full max-h-[85vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="text-[14px] font-bold text-gray-900">{SCREENS.find(s => s.src === view)?.label}</span>
              <button onClick={() => setView(null)} className="text-gray-400 text-[18px] bg-transparent border-none cursor-pointer p-1">✕</button>
            </div>
            <div className="overflow-auto max-h-[75vh]">
              <img src={view} alt="" className="w-full h-auto block" />
            </div>
          </div>
        </div>
      )}

      <div className="mt-6">
        <Link href="/m/register" className="block w-full py-[14px] bg-orange-500 text-white rounded-2xl no-underline text-[15px] font-bold text-center active:bg-orange-600">무료 시작하기</Link>
      </div>
    </div>
  )
}
