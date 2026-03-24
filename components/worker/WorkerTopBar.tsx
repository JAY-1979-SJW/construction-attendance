'use client'

import Image from 'next/image'

/**
 * WorkerTopBar
 *
 * 홈페이지(haehan-ai.kr)의 헤더와 동일한 스타일.
 * - 상단 3px 오렌지 라인
 * - 로고 중앙 배치
 * - position fixed (z-index 50)
 * - 높이: 3px + 53px = 56px
 */
export default function WorkerTopBar() {
  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      {/* 상단 3px 오렌지 라인 */}
      <div className="h-[3px] w-full bg-[#F47920]" />
      {/* 로고 바 */}
      <div className="h-[53px] bg-brand-deeper border-b border-[rgba(91,164,217,0.15)] flex items-center justify-center shadow-[0_2px_16px_rgba(0,0,0,0.35)]">
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
