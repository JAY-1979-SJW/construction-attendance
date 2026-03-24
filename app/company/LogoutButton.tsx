'use client'

import { useRouter } from 'next/navigation'

export default function LogoutButton() {
  const router = useRouter()

  const handleLogout = async () => {
    await fetch('/api/company/auth/logout', { method: 'POST' })
    router.push('/company/login')
  }

  return (
    <button
      onClick={handleLogout}
      className="mx-4 py-[9px] bg-white/15 text-white border border-white/25 rounded-md cursor-pointer text-[13px] w-[calc(100%-32px)]"
    >
      로그아웃
    </button>
  )
}
