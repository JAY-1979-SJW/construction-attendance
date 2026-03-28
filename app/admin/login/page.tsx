'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AuthPageShell } from '@/components/auth/AuthPageShell'
import { AuthCard, AuthBrand, AuthTitle, AuthInput, AuthPrimaryBtn, AuthError, AuthFooter } from '@/components/auth/AuthCard'

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [saveId, setSaveId] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('admin_saved_email')
    if (saved) { setEmail(saved); setSaveId(true) }
  }, [])

  const handleLogin = async () => {
    if (loading) return
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
        setError(data.message ?? '이메일 또는 비밀번호를 확인해주세요.')
        return
      }
      if (saveId) localStorage.setItem('admin_saved_email', email)
      else localStorage.removeItem('admin_saved_email')
      router.push(data.portal ?? '/admin')
    } catch {
      setError('로그인 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthPageShell>
      <AuthCard>
        <AuthBrand />
        <AuthTitle
          title="관리자 로그인"
          description="관리자 계정으로 로그인 후 전체 운영 현황을 관리합니다."
        />

        <AuthError message={error} />

        <AuthInput
          id="admin-email"
          label="이메일"
          type="email"
          autoComplete="email"
          placeholder="admin@company.com"
          value={email}
          onChange={setEmail}
        />
        <div className="mb-4">
          <AuthInput
            id="admin-password"
            label="비밀번호"
            type="password"
            autoComplete="current-password"
            placeholder="비밀번호 입력"
            value={password}
            onChange={setPassword}
          />
        </div>

        <label className="flex items-center gap-2 mb-6 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={saveId}
            onChange={(e) => setSaveId(e.target.checked)}
            className="w-4 h-4 accent-[#F97316] cursor-pointer"
          />
          <span className="text-[13px] text-[#6B7280]">아이디 저장</span>
        </label>

        <AuthPrimaryBtn onClick={handleLogin} disabled={loading}>
          {loading ? '로그인 중...' : '로그인'}
        </AuthPrimaryBtn>

        <AuthFooter links={[
          { label: '업체관리자 가입 신청', href: '/register/company-admin' },
          { label: '근로자 로그인으로 이동', href: '/login' },
          { label: '메인으로 돌아가기', href: '/' },
        ]} />
      </AuthCard>
    </AuthPageShell>
  )
}
