'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.message)
        return
      }
      // 역할에 따라 포털 분기
      router.push(data.portal ?? '/admin')
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[linear-gradient(160deg,#0d1b2a_0%,#1B2838_60%,#141E2A_100%)]">
      <div className="bg-[#243144] rounded-[20px] px-10 py-11 w-full max-w-[420px] shadow-[0_8px_40px_rgba(0,0,0,0.4)] border border-[rgba(91,164,217,0.15)] border-t-[3px] border-t-[#F47920]">
        {/* 브랜드 로고 */}
        <div className="text-center mb-7">
          <Image src="/logo/logo_main.png" alt="해한Ai Engineering" width={240} height={180} className="w-[200px] h-auto mx-auto mb-3 block rounded-2xl" priority />
          <div className="text-[13px] text-[#A0AEC0] bg-[rgba(255,255,255,0.06)] inline-block px-3 py-[3px] rounded-[20px]">관리자 포털</div>
        </div>

        <div className="h-px bg-[rgba(255,255,255,0.08)] mb-6" />

        <div className="mb-4">
          <label className="block text-[13px] font-semibold text-[#A0AEC0] mb-[6px]">이메일</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-[13px] text-[15px] border border-[rgba(91,164,217,0.25)] rounded-[10px] outline-none box-border bg-[rgba(255,255,255,0.06)] text-white" placeholder="admin@example.com" />
        </div>
        <div className="mb-4">
          <label className="block text-[13px] font-semibold text-[#A0AEC0] mb-[6px]">비밀번호</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} className="w-full px-4 py-[13px] text-[15px] border border-[rgba(91,164,217,0.25)] rounded-[10px] outline-none box-border bg-[rgba(255,255,255,0.06)] text-white" />
        </div>

        {error && (
          <div className="bg-[rgba(229,57,53,0.12)] border border-[rgba(229,57,53,0.35)] rounded-[10px] px-[14px] py-[10px] text-[#ef9a9a] text-[13px] mb-[14px]">
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full py-[15px] text-base font-bold bg-[#F47920] text-white border-none rounded-[10px] cursor-pointer shadow-[0_4px_14px_rgba(244,121,32,0.35)] mt-1 disabled:opacity-60"
        >
          {loading ? '로그인 중...' : '로그인'}
        </button>

        <p className="text-center text-[13px] text-[#718096] mt-5 mb-0">
          근로자 로그인은 <a href="/login" className="text-[#5BA4D9] no-underline">여기</a>에서
        </p>
      </div>
    </div>
  )
}
