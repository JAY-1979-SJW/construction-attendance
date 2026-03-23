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
    <div style={styles.layout}>
      <nav style={styles.sidebar}>
        <div style={styles.sidebarTitle}>현장출근관리</div>
        <div style={styles.sidebarSubtitle}>{roleLabel}</div>
        {isReadOnly && (
          <div style={styles.readOnlyBadge}>읽기 전용 모드</div>
        )}
        {NAV_ITEMS.map(({ href, label }) => (
          <Link key={href} href={href} style={styles.navItem}>
            {label}
          </Link>
        ))}
        <div style={styles.spacer} />
        <div style={styles.userInfo}>{session.name}</div>
        <OpsLogoutButton />
      </nav>
      <main style={styles.main}>{children}</main>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  layout: { display: 'flex', minHeight: '100vh', fontFamily: 'sans-serif' },
  sidebar: {
    width: '200px',
    minWidth: '200px',
    background: '#1e3a5f',
    color: 'white',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px 0',
  },
  sidebarTitle: { fontSize: '16px', fontWeight: 700, color: 'white', padding: '0 20px 4px', marginBottom: '2px' },
  sidebarSubtitle: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.6)',
    padding: '0 20px 10px',
    borderBottom: '1px solid rgba(255,255,255,0.15)',
    marginBottom: '8px',
  },
  readOnlyBadge: {
    margin: '0 16px 10px',
    padding: '4px 8px',
    background: 'rgba(251,191,36,0.2)',
    border: '1px solid rgba(251,191,36,0.4)',
    borderRadius: '4px',
    fontSize: '11px',
    color: '#fbbf24',
    textAlign: 'center',
  },
  navItem: {
    display: 'block',
    padding: '10px 20px',
    color: 'rgba(255,255,255,0.85)',
    textDecoration: 'none',
    fontSize: '14px',
  },
  spacer: { flex: 1 },
  userInfo: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.5)',
    padding: '0 20px 8px',
    textAlign: 'center',
  },
  main: { flex: 1, background: '#f5f6f8', overflow: 'auto' },
}
