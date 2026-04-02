'use client'

import Image from 'next/image'

/**
 * WorkerTopBar
 *
 * 홈페이지(haehan-ai.kr)의 헤더와 동일한 스타일.
 * - 상단 4px 오렌지 라인
 * - 로고 중앙 배치
 * - position fixed (z-index 50)
 * - 높이: 4px + 53px = 57px
 */
export default function WorkerTopBar() {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 safe-top">
      {/* 상단 4px 오렌지 라인 */}
      <div className="h-1 w-full bg-brand-accent" />
      {/* 로고 바 */}
      <div className="h-[53px] bg-card border-b border-brand flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
        <Image
          src="/logo/logo_main.png"
          alt="해한Ai Engineering"
          width={130}
          height={40}
          style={{ height: '36px', width: 'auto' }}
          priority
        />
      </div>
    </div>
  )
}
