import Link from 'next/link'
import LogoutButton from './LogoutButton'
import BusinessFooter from '@/components/BusinessFooter'

const NAV_ITEMS = [
  { href: '/company', label: '대시보드' },
  { href: '/company/profile', label: '내 회사 정보' },
  { href: '/company/managers', label: '관리자 관리' },
  { href: '/company/workers', label: '근로자 관리' },
  { href: '/company/attendance', label: '출퇴근 현황' },
  { href: '/company/approvals', label: '승인 대기' },
  { href: '/company/worklogs', label: '작업일보' },
  { href: '/company/notices', label: '공지/일정' },
  { href: '/company/devices', label: '기기 승인' },
  { href: '/company/payroll', label: '공수/급여' },
  { href: '/company/insurance', label: '4대보험' },
  { href: '/company/documents', label: '노임서류' },
]

export default function CompanyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen font-sans">
      <nav className="w-[200px] min-w-[200px] shrink-0 bg-card border-r border-brand text-body-brand flex flex-col py-6 h-screen overflow-y-auto">
        <div className="text-base font-bold text-fore-brand px-5 pb-1 mb-0.5">해한 출퇴근</div>
        <div className="text-[11px] text-muted2-brand px-5 pb-4 border-b border-brand mb-2">업체 관리</div>
        {NAV_ITEMS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className="block px-5 py-2.5 text-body-brand no-underline text-sm hover:bg-accent-light hover:text-accent"
          >
            {label}
          </Link>
        ))}
        <div className="flex-1" />
        <LogoutButton />
      </nav>
      <main className="flex-1 flex flex-col overflow-hidden bg-[#f5f6f8]">
        {/* 상단 헤더 — shrink-0으로 고정, 스크롤 대상 아님 */}
        <header className="shrink-0 z-10 bg-card border-b border-brand">
          <div className="h-1 bg-brand-accent" />
          <div className="h-[48px] flex items-center px-5">
            <span className="text-[14px] font-bold text-title-brand">업체 관리 포털</span>
          </div>
        </header>
        {/* 콘텐츠 독립 스크롤 */}
        <div className="flex-1 overflow-auto">
          {children}
          <BusinessFooter />
        </div>
      </main>
    </div>
  )
}
