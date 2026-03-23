'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>관리자 로그인</h1>
        <p style={styles.subtitle}>해한 현장 출퇴근 관리 시스템</p>

        <div style={styles.inputGroup}>
          <label style={styles.label}>이메일</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={styles.input} placeholder="admin@example.com" />
        </div>
        <div style={styles.inputGroup}>
          <label style={styles.label}>비밀번호</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} style={styles.input} />
        </div>

        {error && <p style={styles.error}>{error}</p>}

        <button onClick={handleLogin} disabled={loading} style={{ ...styles.button, opacity: loading ? 0.6 : 1 }}>
          {loading ? '로그인 중...' : '로그인'}
        </button>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1B2838' },
  card: { background: '#243144', borderRadius: '12px', padding: '48px 40px', width: '100%', maxWidth: '400px', boxShadow: '0 8px 40px rgba(0,0,0,0.3)' },
  title: { fontSize: '22px', fontWeight: 700, margin: '0 0 6px', textAlign: 'center' },
  subtitle: { fontSize: '13px', color: '#A0AEC0', textAlign: 'center', margin: '0 0 32px' },
  inputGroup: { marginBottom: '16px' },
  label: { display: 'block', fontSize: '13px', fontWeight: 600, color: '#A0AEC0', marginBottom: '6px' },
  input: { width: '100%', padding: '12px 14px', fontSize: '15px', border: '1px solid rgba(91,164,217,0.3)', borderRadius: '8px', outline: 'none', boxSizing: 'border-box' as const },
  error: { color: '#e53935', fontSize: '13px', marginBottom: '12px' },
  button: { width: '100%', padding: '14px', fontSize: '16px', fontWeight: 700, background: '#F47920', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' },
}
