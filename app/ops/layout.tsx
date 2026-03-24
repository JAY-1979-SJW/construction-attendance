import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { jwtVerify } from 'jose'
import { prisma } from '@/lib/db/prisma'
import OpsLogoutButton from './LogoutButton'

const ALLOWED_ROLES = ['SITE_ADMIN', 'EXTERNAL_SITE_ADMIN', 'SUPER_ADMIN', 'ADMIN']

const NAV_ITEMS = [
  { href: '/ops',           label: '대시보드' },
  { href: '/ops/sites',     label: '내 담당 현장' },
  { href: '/ops/workers',   label: '작업자 현황' },
  { href: '/ops/attendance',label: '출퇴근 현황' },
  { href: '/ops/worklogs',  label: '작업일보' },
  { href: '/ops/notices',   label: '공지/일정' },
]

async function getSession() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('admin_token')?.value
    if (!token) return null
    const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? '')
    const { payload } = await jwtVerify(token, secret)
    return payload as { sub: string; role: string; name: string; companyId?: string }
  } catch {
    return null
  }
}

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session || !ALLOWED_ROLES.includes(session.role)) {
    redirect('/admin/login')
  }

  // EXTERNAL_SITE_ADMIN: 소속 회사가 VERIFIED 상태인지 확인 (companyId 없으면 무조건 차단)
  if (session.role === 'EXTERNAL_SITE_ADMIN') {
    if (!session.companyId) {
      redirect('/company-pending-verification')
    }
    const company = await prisma.company.findUnique({
      where: { id: session.companyId },
      select: { externalVerificationStatus: true },
    })
    if (!company || company.externalVerificationStatus !== 'VERIFIED') {
      redirect('/company-pending-verification')
    }
  }

  const isReadOnly = session.role === 'EXTERNAL_SITE_ADMIN'
  const roleLabel = session.role === 'EXTERNAL_SITE_ADMIN'
    ? '지정 현장 운영형'
    : session.role === 'SITE_ADMIN'
      ? '현장 관리자'
      : '내부 운영'

  return (
    <div className="flex min-h-screen font-sans">
      <nav className="w-[200px] min-w-[200px] bg-[#1e3a5f] text-white flex flex-col py-6">
        <div className="text-base font-bold text-white px-5 pb-1 mb-0.5">현장출근관리</div>
        <div className="text-[11px] text-white/60 px-5 pb-2.5 border-b border-white/15 mb-2">
          {roleLabel}
        </div>
        {isReadOnly && (
          <div className="mx-4 mb-2.5 px-2 py-1 bg-[rgba(251,191,36,0.2)] border border-[rgba(251,191,36,0.4)] rounded text-[11px] text-[#fbbf24] text-center">
            읽기 전용 모드
          </div>
        )}
        {NAV_ITEMS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className="block px-5 py-2.5 text-white/85 no-underline text-sm"
          >
            {label}
          </Link>
        ))}
        <div className="flex-1" />
        <div className="text-[12px] text-white/50 px-5 pb-2 text-center">{session.name}</div>
        <OpsLogoutButton />
      </nav>
      <main className="flex-1 bg-[#f5f6f8] overflow-auto">{children}</main>
    </div>
  )
}
