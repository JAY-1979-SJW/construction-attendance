'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'

interface NavItem {
  href: string
  label: string
  exact?: boolean
  icon: React.ReactNode
}

const NAV_ITEMS: NavItem[] = [
  {
    href: '/labor',
    label: '노무 대시보드',
    exact: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/>
        <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/>
        <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/>
      </svg>
    ),
  },
  {
    href: '/labor/wages',
    label: '노임 관리',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
        <path d="M12 7v10M9 9.5C9 8.12 10.34 7 12 7s3 1.12 3 2.5c0 1.5-1.34 2.5-3 2.5s-3 1-3 2.5C9 15.88 10.34 17 12 17s3-1.12 3-2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: '/labor/insurance',
    label: '4대보험 관리',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L3 7v5c0 5.25 3.75 10.16 9 11.34C17.25 22.16 21 17.25 21 12V7L12 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: '/labor/documents',
    label: '근로자 서류관리',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: '/labor/sites',
    label: '현장별 노무현황',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M9 22V12h6v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: '/labor/reports',
    label: '노동부 대응자료',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="2"/>
        <path d="M9 7h6M9 11h6M9 15h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
]

const SETTINGS_ITEM: NavItem = {
  href: '/labor/settings',
  label: '설정',
  icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="2"/>
    </svg>
  ),
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(item.href + '/')

  return (
    <Link
      href={item.href}
      className="flex items-center gap-3 px-4 py-[11px] text-[13px] transition-colors relative no-underline"
      style={{
        background: active ? '#FFF7ED' : 'transparent',
        color: active ? '#F97316' : '#6B7280',
        fontWeight: active ? 600 : 400,
      }}
      onMouseEnter={(e) => {
        if (!active) {
          ;(e.currentTarget as HTMLElement).style.background = '#F9FAFB'
          ;(e.currentTarget as HTMLElement).style.color = '#374151'
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          ;(e.currentTarget as HTMLElement).style.background = 'transparent'
          ;(e.currentTarget as HTMLElement).style.color = '#6B7280'
        }
      }}
    >
      {active && (
        <span
          className="absolute left-0 top-0 bottom-0 rounded-r-full"
          style={{ width: 3, background: '#F97316' }}
        />
      )}
      <span className="w-4 h-4 flex items-center justify-center shrink-0">{item.icon}</span>
      <span>{item.label}</span>
    </Link>
  )
}

export default function LaborSidebar() {
  const pathname = usePathname()
  const router   = useRouter()

  const handleLogout = () => {
    fetch('/api/company/auth/logout', { method: 'POST' }).then(() =>
      router.push('/company/login')
    )
  }

  return (
    <aside
      className="fixed top-0 left-0 h-screen w-[220px] flex flex-col z-40"
      style={{ background: '#FFFFFF', borderRight: '1px solid #E5E7EB' }}
    >
      {/* 상단 4px 오렌지 라인 */}
      <div className="h-1 shrink-0 bg-brand-accent" />

      {/* 로고 */}
      <div
        className="h-[56px] flex items-center px-4 shrink-0"
        style={{ borderBottom: '1px solid #F3F4F6' }}
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-accent-light rounded-[8px] flex items-center justify-center shrink-0">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2L3 7v5c0 5.25 3.75 10.16 9 11.34C17.25 22.16 21 17.25 21 12V7L12 2z"
                stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              />
            </svg>
          </div>
          <span className="text-[14px] font-bold text-title-brand">
            노무관리
            <span className="text-[11px] font-normal text-muted2-brand ml-1">시스템</span>
          </span>
        </div>
      </div>

      {/* 메인 네비게이션 */}
      <nav className="flex-1 overflow-y-auto py-2" style={{ scrollbarWidth: 'thin' }}>
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
        <div className="mx-4 my-2 border-t border-brand" />
        <NavLink item={SETTINGS_ITEM} pathname={pathname} />
      </nav>

      {/* 로그아웃 */}
      <div className="px-3 py-3 shrink-0" style={{ borderTop: '1px solid #E5E7EB' }}>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 text-[12px] py-2 px-3 rounded-[8px] transition-colors text-left text-muted2-brand"
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLElement).style.background = '#FFF1F2'
            ;(e.currentTarget as HTMLElement).style.color = '#B91C1C'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLElement).style.color = '#9CA3AF'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            />
          </svg>
          <span>로그아웃</span>
        </button>
      </div>
    </aside>
  )
}
