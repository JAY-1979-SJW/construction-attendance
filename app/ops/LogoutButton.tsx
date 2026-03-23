'use client'

import { useRouter } from 'next/navigation'

export default function OpsLogoutButton() {
  const router = useRouter()

  const handleLogout = async () => {
    await fetch('/api/admin/auth/logout', { method: 'POST' })
    router.push('/admin/login')
  }

  return (
    <button onClick={handleLogout} style={styles.btn}>
      로그아웃
    </button>
  )
}

const styles: Record<string, React.CSSProperties> = {
  btn: {
    margin: '0 16px',
    padding: '9px 0',
    background: 'rgba(255,255,255,0.15)',
    color: 'white',
    border: '1px solid rgba(255,255,255,0.25)',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    width: 'calc(100% - 32px)',
  },
}
