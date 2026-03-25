'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/ops',            label: '대시보드',    exact: true },
  { href: '/ops/sites',      label: '내 담당 현장', exact: false },
  { href: '/ops/workers',    label: '작업자 현황', exact: false },
  { href: '/ops/attendance', label: '출퇴근 현황', exact: false },
  { href: '/ops/worklogs',   label: '작업일보',    exact: false },
  { href: '/ops/notices',    label: '공지/일정',   exact: false },
]

interface Props {
  userName: string
  roleLabel: string
  isReadOnly: boolean
}

export default function OpsTopNav({ userName, roleLabel, isReadOnly }: Props) {
  const pathname = usePathname()
  const router = useRouter()

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href)

  const handleLogout = async () => {
    await fetch('/api/admin/auth/logout', { method: 'POST' })
    router.push('/admin/login')
  }

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-[#E5E7EB] shadow-sm">
      {/* 상단 바: 로고 + 사용자정보 + 로그아웃 */}
      <div className="flex items-center justify-between h-12 px-5 border-b border-[#F3F4F6]">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-bold text-[#111827]">현장출근관리</span>
          <span className="text-[11px] text-[#9CA3AF]">· {roleLabel}</span>
          {isReadOnly && (
            <span className="px-2 py-[2px] bg-[#FEF3C7] border border-[#FDE68A] rounded text-[11px] text-[#92400E]">
              읽기 전용
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[13px] text-[#6B7280]">{userName}</span>
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 bg-[#F3F4F6] border border-[#E5E7EB] text-[#374151] text-[12px] rounded-md cursor-pointer hover:bg-[#E5E7EB] transition-colors"
          >
            로그아웃
          </button>
        </div>
      </div>

      {/* 메뉴 바: 항상 가로로 노출 */}
      <nav className="flex overflow-x-auto scrollbar-none">
        {NAV_ITEMS.map(({ href, label, exact }) => (
          <Link
            key={href}
            href={href}
            className={`flex-shrink-0 px-5 py-3 text-[13px] font-medium no-underline border-b-2 transition-colors ${
              isActive(href, exact)
                ? 'border-[#F97316] text-[#F97316]'
                : 'border-transparent text-[#6B7280] hover:text-[#111827] hover:border-[#D1D5DB]'
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>
    </header>
  )
}
