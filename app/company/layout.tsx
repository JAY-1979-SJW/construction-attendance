import Link from 'next/link'
import LogoutButton from './LogoutButton'

const NAV_ITEMS = [
  { href: '/company', label: '대시보드' },
  { href: '/company/workers', label: '근로자 관리' },
  { href: '/company/attendance', label: '출퇴근 현황' },
  { href: '/company/devices', label: '기기 승인' },
  { href: '/company/payroll', label: '공수/급여' },
  { href: '/company/insurance', label: '4대보험' },
  { href: '/company/documents', label: '노임서류' },
]

export default function CompanyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={styles.layout}>
      <nav style={styles.sidebar}>
        <div style={styles.sidebarTitle}>해한 출퇴근</div>
        <div style={styles.sidebarSubtitle}>업체 관리</div>
        {NAV_ITEMS.map(({ href, label }) => (
          <Link key={href} href={href} style={styles.navItem}>
            {label}
          </Link>
        ))}
        <div style={styles.spacer} />
        <LogoutButton />
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
    background: '#0f4c75',
    color: 'white',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px 0',
  },
  sidebarTitle: { fontSize: '16px', fontWeight: 700, color: 'white', padding: '0 20px 4px', marginBottom: '2px' },
  sidebarSubtitle: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.6)',
    padding: '0 20px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.15)',
    marginBottom: '8px',
  },
  navItem: {
    display: 'block',
    padding: '10px 20px',
    color: 'rgba(255,255,255,0.85)',
    textDecoration: 'none',
    fontSize: '14px',
  },
  spacer: { flex: 1 },
  main: { flex: 1, background: '#f5f6f8', overflow: 'auto' },
}
