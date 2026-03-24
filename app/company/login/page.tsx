'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CompanyLoginPage() {
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
      if (data.portal === '/company') {
        router.push('/company')
      } else {
        setError('업체 관리자 계정이 아닙니다.')
      }
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f4c75]">
      <div className="bg-card rounded-xl px-10 py-12 w-full max-w-[400px] shadow-[0_8px_40px_rgba(0,0,0,0.3)]">
        <h1 className="text-[22px] font-bold m-0 mb-1.5 text-center">업체 관리자 로그인</h1>
        <p className="text-[13px] text-muted-brand text-center m-0 mb-8">해한 현장 출퇴근 관리 시스템</p>

        <div className="mb-4">
          <label className="block text-[13px] font-semibold text-muted-brand mb-1.5">이메일</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-base w-full"
            placeholder="admin@example.com"
          />
        </div>
        <div className="mb-4">
          <label className="block text-[13px] font-semibold text-muted-brand mb-1.5">비밀번호</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            className="input-base w-full"
          />
        </div>

        {error && <p className="text-[#e53935] text-[13px] mb-3">{error}</p>}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full py-3.5 text-base font-bold bg-[#0f4c75] text-white border-none rounded-lg cursor-pointer"
          style={{ opacity: loading ? 0.6 : 1 }}
        >
          {loading ? '로그인 중...' : '로그인'}
        </button>
      </div>
    </div>
  )
}
