'use client'

import { useRouter } from 'next/navigation'

export default function OpsLogoutButton() {
  const router = useRouter()

  const handleLogout = async () => {
    await fetch('/api/admin/auth/logout', { method: 'POST' })
    router.push('/admin/login')
  }

  return (
    <button
      onClick={handleLogout}
      className="mx-4 py-[9px] bg-[rgba(255,255,255,0.15)] text-white border border-[rgba(255,255,255,0.25)] rounded-md cursor-pointer text-[13px] w-[calc(100%-32px)]"
    >
      로그아웃
    </button>
  )
}
