'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AuthPageShell } from '@/components/auth/AuthPageShell'
import { AuthCard, AuthBrand, AuthTitle, AuthInput, AuthPrimaryBtn, AuthError, AuthFooter } from '@/components/auth/AuthCard'

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
        <div className="mb-6">
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

        <AuthPrimaryBtn onClick={handleLogin} disabled={loading}>
          {loading ? '로그인 중...' : '로그인'}
        </AuthPrimaryBtn>

        <AuthFooter links={[
          { label: '근로자 로그인으로 이동', href: '/login' },
          { label: '메인으로 돌아가기', href: '/' },
        ]} />
      </AuthCard>
    </AuthPageShell>
  )
}
