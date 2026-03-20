'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  getStoredDeviceToken,
  setDeviceToken,
  getStoredDeviceName,
  generateBrowserFingerprint,
} from '@/lib/utils/device-token'

function VerifyContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const phone = searchParams.get('phone') ?? ''

  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resendCooldown, setResendCooldown] = useState(60)

  useEffect(() => {
    if (resendCooldown > 0) {
      const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000)
      return () => clearTimeout(t)
    }
  }, [resendCooldown])

  const handleVerify = async () => {
    if (code.length !== 6) {
      setError('6자리 인증번호를 입력하세요.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code, purpose: 'LOGIN' }),
      })
      const data = await res.json()

      if (!data.success) {
        setError(data.message)
        return
      }

      const { needsDeviceRegister } = data.data

      if (needsDeviceRegister) {
        // 기기 등록 필요
        router.push('/device/register')
        return
      }

      // 기기 등록됨: 현재 기기 토큰 검증
      const storedToken = getStoredDeviceToken()
      if (storedToken) {
        const validateRes = await fetch('/api/device/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceToken: storedToken }),
        })
        const validateData = await validateRes.json()

        if (validateData.data?.valid) {
          router.push('/attendance')
          return
        }
      }

      // 등록된 기기 없음 → 기기 변경 요청 또는 재등록
      router.push('/device/register')
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendCooldown > 0) return
    try {
      await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, purpose: 'LOGIN' }),
      })
      setResendCooldown(60)
      setError('')
    } catch {
      setError('재발송 실패. 다시 시도해주세요.')
    }
  }

  const formatPhone = (p: string) =>
    p.length === 11 ? `${p.slice(0, 3)}-${p.slice(3, 7)}-${p.slice(7)}` : p

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <button onClick={() => router.back()} style={styles.back}>
          ← 뒤로
        </button>

        <h1 style={styles.title}>인증번호 입력</h1>
        <p style={styles.subtitle}>
          <strong>{formatPhone(phone)}</strong>으로 발송된
          <br />6자리 인증번호를 입력하세요
        </p>

        <input
          type="tel"
          inputMode="numeric"
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
          onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
          style={styles.codeInput}
          maxLength={6}
          autoFocus
        />

        {error && <p style={styles.error}>{error}</p>}

        <button
          onClick={handleVerify}
          disabled={loading || code.length !== 6}
          style={{
            ...styles.button,
            opacity: loading || code.length !== 6 ? 0.6 : 1,
          }}
        >
          {loading ? '확인 중...' : '확인'}
        </button>

        <button
          onClick={handleResend}
          disabled={resendCooldown > 0}
          style={{
            ...styles.resendButton,
            opacity: resendCooldown > 0 ? 0.5 : 1,
          }}
        >
          {resendCooldown > 0 ? `재발송 (${resendCooldown}초)` : '인증번호 재발송'}
        </button>
      </div>
    </div>
  )
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', marginTop: 80 }}>로딩 중...</div>}>
      <VerifyContent />
    </Suspense>
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
  back: {
    background: 'none',
    border: 'none',
    color: '#666',
    fontSize: '14px',
    cursor: 'pointer',
    padding: '0 0 16px',
    display: 'block',
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
    lineHeight: 1.6,
  },
  codeInput: {
    width: '100%',
    padding: '16px',
    fontSize: '32px',
    textAlign: 'center',
    letterSpacing: '12px',
    border: '2px solid #e0e0e0',
    borderRadius: '10px',
    outline: 'none',
    boxSizing: 'border-box',
    marginBottom: '16px',
  },
  error: {
    color: '#e53935',
    fontSize: '13px',
    margin: '0 0 16px',
    textAlign: 'center',
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
    marginBottom: '12px',
  },
  resendButton: {
    width: '100%',
    padding: '12px',
    fontSize: '14px',
    background: 'none',
    color: '#666',
    border: '1px solid #e0e0e0',
    borderRadius: '10px',
    cursor: 'pointer',
  },
}
