'use client'

import { usePathname, useRouter } from 'next/navigation'

/**
 * WorkerBottomNav
 *
 * 근로자 화면 하단 고정 내비게이션 — 최대 5개 항목.
 * 출퇴근 | 내 문서 | 내 정보 | 공지 | 요청
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
  { label: '출퇴근',  icon: '🕐', href: '/attendance',         match: ['/attendance'] },
  { label: '내 문서', icon: '📄', href: '/my/documents',       match: ['/my/documents'] },
  { label: '내 정보', icon: '👤', href: '/my/status',          match: ['/my/status', '/my'] },
  { label: '공지',    icon: '📢', href: '/my/notices',         match: ['/my/notices'] },
  { label: '요청',    icon: '📝', href: '/my/requests',        match: ['/my/requests'] },
]

export default function WorkerBottomNav() {
  const pathname  = usePathname()
  const router    = useRouter()

  return (
    <nav
      style={{
        position:       'fixed',
        bottom:         0,
        left:           0,
        right:          0,
        background:     '#ffffff',
        borderTop:      '1px solid #e0e0e0',
        display:        'flex',
        height:         '60px',
        zIndex:         100,
        boxShadow:      '0 -2px 8px rgba(0,0,0,0.06)',
      }}
    >
      {NAV_ITEMS.map((item) => {
        const isActive = item.match.some((m) => pathname === m || pathname.startsWith(m + '/'))
        return (
          <button
            key={item.href}
            onClick={() => router.push(item.href)}
            style={{
              flex:           1,
              display:        'flex',
              flexDirection:  'column',
              alignItems:     'center',
              justifyContent: 'center',
              gap:            '2px',
              border:         'none',
              background:     'transparent',
              cursor:         'pointer',
              color:          isActive ? '#1565c0' : '#9e9e9e',
              padding:        '6px 0',
            }}
          >
            <span style={{ fontSize: '18px', lineHeight: 1 }}>{item.icon}</span>
            <span style={{ fontSize: '11px', fontWeight: isActive ? 700 : 400 }}>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
