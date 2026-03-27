'use client'

import React from 'react'

/**
 * Modal — 중앙 오버레이 모달
 *
 * 기준 수치 (safety-docs 기준표):
 *   폭            : max-w-[480px] (기본), props로 override 가능
 *   최대 높이      : max-h-[85vh]
 *   헤더 높이      : h-[52px] (topbar 리듬)
 *   본문 패딩      : p-5 (card 패딩 동일)
 *   border-radius  : 12px
 *   overlay        : bg-black/40
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  width = 480,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  width?: number
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-[12px] shadow-xl w-full max-h-[85vh] overflow-y-auto mx-4"
        style={{ maxWidth: width }}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 — h-[52px] topbar 리듬 */}
        <div className="h-[52px] flex items-center px-5 border-b border-[#E5E7EB] shrink-0">
          <h2 className="text-[15px] font-bold text-[#0F172A] m-0 flex-1">{title}</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#374151] transition-colors shrink-0 ml-3 border-none bg-transparent cursor-pointer"
            aria-label="닫기"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* 본문 — p-5 card 패딩 동일 */}
        <div className="p-5">
          {children}
        </div>
      </div>
    </div>
  )
}
