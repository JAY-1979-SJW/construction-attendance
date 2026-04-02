'use client'

import { usePathname, useRouter } from 'next/navigation'

/**
 * WorkerBottomNav
 *
 * 근로자 화면 하단 고정 내비게이션 — 최대 5개 항목.
 * 출퇴근 | 작업일보 | 서류 | 내 정보 | 요청
 *
 * 권한 설계 원칙:
 *  - 이 네비게이션 외 메뉴 없음 (관리자 메모, 리스크 점수, 계약형태 검토 이력 노출 금지)
 *  - "요청" 탭은 제한형 요청서만 제공 (자유 문의 없음)
 */

interface NavItem {
  label: string
  icon: string
  href: string
  match: string[]
}

const NAV_ITEMS: NavItem[] = [
  { label: '출퇴근',    icon: '🕐', href: '/attendance',              match: ['/attendance'] },
  { label: '공수/급여', icon: '💰', href: '/wage',                    match: ['/wage'] },
  { label: '서류',      icon: '📑', href: '/my/onboarding',           match: ['/my/onboarding', '/my/documents'] },
  { label: '작업일보',  icon: '📋', href: '/daily-report',            match: ['/daily-report'] },
  { label: '내 정보',   icon: '👤', href: '/my/status',               match: ['/my/status', '/my/requests', '/my/sites', '/my/material-requests'] },
]

export default function WorkerBottomNav() {
  const pathname  = usePathname()
  const router    = useRouter()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-brand flex h-16 z-[100] shadow-[0_-2px_8px_rgba(0,0,0,0.08)] safe-bottom">
      {NAV_ITEMS.map((item) => {
        const isActive = item.match.some((m) => pathname === m || pathname.startsWith(m + '/'))
        return (
          <button
            key={item.href}
            onClick={() => router.push(item.href)}
            className="flex-1 flex flex-col items-center justify-center gap-[3px] border-none bg-transparent cursor-pointer py-2 transition-colors duration-[150ms]"
            style={{
              color:      isActive ? '#F97316' : '#5a6a7e',
              borderTop:  isActive ? '2px solid #F97316' : '2px solid transparent',
            }}
          >
            <span className="text-[20px] leading-none">{item.icon}</span>
            <span
              className="text-[10px] tracking-[0.3px]"
              style={{ fontWeight: isActive ? 700 : 400 }}
            >
              {item.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
