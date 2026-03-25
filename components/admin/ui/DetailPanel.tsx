'use client'

import React from 'react'

interface DetailPanelProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
  actions?: React.ReactNode
  width?: number
}

// DetailPanel — 우측 슬라이드 상세 패널
// 구조: 4px 오렌지 라인 / 제목+닫기 / 스크롤 본문 / 액션 버튼
export function DetailPanel({
  open,
  onClose,
  title,
  subtitle,
  children,
  actions,
  width = 420,
}: DetailPanelProps) {
  if (!open) return null

  return (
    <>
      {/* 배경 오버레이 */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />

      {/* 패널 */}
      <div
        className="fixed top-0 right-0 h-screen bg-white z-50 flex flex-col shadow-xl"
        style={{ width }}
      >
        {/* 4px 오렌지 상단 라인 */}
        <div className="h-1 bg-[#F97316] shrink-0" />

        {/* 헤더 */}
        <div
          className="flex items-start justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid #E5E7EB' }}
        >
          <div>
            <h2 className="text-[15px] font-bold text-[#0F172A] m-0 leading-snug">{title}</h2>
            {subtitle && (
              <p className="text-[12px] text-[#9CA3AF] mt-0.5 m-0">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#374151] transition-colors shrink-0 ml-3 mt-0.5"
            aria-label="닫기"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {children}
        </div>

        {/* 액션 영역 */}
        {actions && (
          <div
            className="px-5 py-4 flex items-center justify-end gap-2 shrink-0"
            style={{ borderTop: '1px solid #E5E7EB' }}
          >
            {actions}
          </div>
        )}
      </div>
    </>
  )
}
