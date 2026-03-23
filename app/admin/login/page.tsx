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
    <div style={styles.container}>
      <div style={styles.card}>
        {/* 브랜드 로고 */}
        <div style={styles.logoWrap}>
          <Image src="/logo/logo_main.png" alt="해한Ai Engineering" width={240} height={180} style={{ width: '200px', height: 'auto', margin: '0 auto 12px', display: 'block', borderRadius: '16px' }} priority />
          <div style={styles.logoSub}>관리자 포털</div>
        </div>

        <div style={styles.divider} />

        <div style={styles.inputGroup}>
          <label style={styles.label}>이메일</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={styles.input} placeholder="admin@example.com" />
        </div>
        <div style={styles.inputGroup}>
          <label style={styles.label}>비밀번호</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} style={styles.input} />
        </div>

        {error && <div style={styles.errorBox}>{error}</div>}

        <button onClick={handleLogin} disabled={loading} style={{ ...styles.button, opacity: loading ? 0.6 : 1 }}>
          {loading ? '로그인 중...' : '로그인'}
        </button>

        <p style={styles.hint}>근로자 로그인은 <a href="/login" style={{ color: '#5BA4D9', textDecoration: 'none' }}>여기</a>에서</p>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container:  { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg, #0d1b2a 0%, #1B2838 60%, #141E2A 100%)' },
  card:       { background: '#243144', borderRadius: '20px', padding: '44px 40px', width: '100%', maxWidth: '420px', boxShadow: '0 8px 40px rgba(0,0,0,0.4)', border: '1px solid rgba(91,164,217,0.15)', borderTop: '3px solid #F47920' },
  logoWrap:   { textAlign: 'center' as const, marginBottom: '28px' },
  logoIcon:   { fontSize: '36px', marginBottom: '12px' },
  logoText:   { fontSize: '22px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.5px', marginBottom: '6px' },
  logoSub:    { fontSize: '13px', color: '#A0AEC0', background: 'rgba(255,255,255,0.06)', display: 'inline-block', padding: '3px 12px', borderRadius: '20px' },
  divider:    { height: '1px', background: 'rgba(255,255,255,0.08)', margin: '0 0 24px' },
  inputGroup: { marginBottom: '16px' },
  label:      { display: 'block', fontSize: '13px', fontWeight: 600, color: '#A0AEC0', marginBottom: '6px' },
  input:      { width: '100%', padding: '13px 16px', fontSize: '15px', border: '1px solid rgba(91,164,217,0.25)', borderRadius: '10px', outline: 'none', boxSizing: 'border-box' as const, background: 'rgba(255,255,255,0.06)', color: '#ffffff' },
  errorBox:   { background: 'rgba(229,57,53,0.12)', border: '1px solid rgba(229,57,53,0.35)', borderRadius: '10px', padding: '10px 14px', color: '#ef9a9a', fontSize: '13px', marginBottom: '14px' },
  error:      { color: '#ef9a9a', fontSize: '13px', marginBottom: '12px' },
  button:     { width: '100%', padding: '15px', fontSize: '16px', fontWeight: 700, background: '#F47920', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', boxShadow: '0 4px 14px rgba(244,121,32,0.35)', marginTop: '4px' },
  hint:       { textAlign: 'center' as const, fontSize: '13px', color: '#718096', marginTop: '20px', marginBottom: 0 },
}
