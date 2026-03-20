'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? '해한 현장 출퇴근'

export default function LoginPage() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSendOtp = async () => {
    const cleaned = phone.replace(/[^0-9]/g, '')
    if (!/^010\d{8}$/.test(cleaned)) {
      setError('010으로 시작하는 11자리 숫자를 입력하세요.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleaned, purpose: 'LOGIN' }),
      })
      const data = await res.json()

      if (!data.success) {
        setError(data.message)
        return
      }

      // 인증번호 입력 페이지로 이동
      router.push(`/login/verify?phone=${encodeURIComponent(cleaned)}`)
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const formatPhone = (value: string) => {
    const num = value.replace(/[^0-9]/g, '').slice(0, 11)
    if (num.length < 4) return num
    if (num.length < 8) return `${num.slice(0, 3)}-${num.slice(3)}`
    return `${num.slice(0, 3)}-${num.slice(3, 7)}-${num.slice(7)}`
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>{APP_NAME}</h1>
        <p style={styles.subtitle}>휴대폰 번호로 로그인하세요</p>

        <div style={styles.inputGroup}>
          <label style={styles.label}>휴대폰 번호</label>
          <input
            type="tel"
            inputMode="numeric"
            placeholder="010-0000-0000"
            value={formatPhone(phone)}
            onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
            style={styles.input}
            maxLength={13}
          />
        </div>

        {error && <p style={styles.error}>{error}</p>}

        <button
          onClick={handleSendOtp}
          disabled={loading}
          style={{ ...styles.button, opacity: loading ? 0.6 : 1 }}
        >
          {loading ? '발송 중...' : '인증번호 받기'}
        </button>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    background: '#f0f4f8',
  },
  card: {
    background: 'white',
    borderRadius: '16px',
    padding: '40px 32px',
    width: '100%',
    maxWidth: '400px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
  },
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#1a1a2e',
    margin: '0 0 8px',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: '14px',
    color: '#666',
    textAlign: 'center',
    margin: '0 0 32px',
  },
  inputGroup: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: 600,
    color: '#333',
    marginBottom: '8px',
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    fontSize: '18px',
    border: '2px solid #e0e0e0',
    borderRadius: '10px',
    outline: 'none',
    boxSizing: 'border-box',
    letterSpacing: '2px',
  },
  error: {
    color: '#e53935',
    fontSize: '13px',
    margin: '0 0 16px',
  },
  button: {
    width: '100%',
    padding: '16px',
    fontSize: '18px',
    fontWeight: 700,
    background: '#1976d2',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    marginTop: '8px',
  },
}
