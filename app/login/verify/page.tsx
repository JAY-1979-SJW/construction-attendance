'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// OTP 인증 방식 폐기 — 관리자 승인형으로 전환됨
export default function VerifyPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/login')
  }, [router])
  return null
}
