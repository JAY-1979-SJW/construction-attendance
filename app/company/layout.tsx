import Link from 'next/link'
import LogoutButton from './LogoutButton'

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
    <div className="flex min-h-screen font-sans">
      <nav className="w-[200px] min-w-[200px] bg-white border-r border-[#E5E7EB] text-[#374151] flex flex-col py-6">
        <div className="text-base font-bold text-[#111827] px-5 pb-1 mb-0.5">해한 출퇴근</div>
        <div className="text-[11px] text-[#9CA3AF] px-5 pb-4 border-b border-[#E5E7EB] mb-2">업체 관리</div>
        {NAV_ITEMS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className="block px-5 py-2.5 text-[#374151] no-underline text-sm hover:bg-[#FFF7ED] hover:text-[#F97316]"
          >
            {label}
          </Link>
        ))}
        <div className="flex-1" />
        <LogoutButton />
      </nav>
      <main className="flex-1 bg-[#f5f6f8] overflow-auto">{children}</main>
    </div>
  )
}
