'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  generateBrowserFingerprint,
  getStoredDeviceToken,
  setDeviceToken,
  detectDeviceName,
} from '@/lib/utils/device-token'

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? '해한 현장 출퇴근'
const STORED_PHONE_KEY = 'ca_stored_phone'

type Phase = 'input' | 'pending' | 'rejected'

export default function LoginPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('input')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 앱 재진입 시 저장된 번호로 자동 상태 확인
  useEffect(() => {
    const storedPhone = localStorage.getItem(STORED_PHONE_KEY)
    if (storedPhone) {
      setPhone(storedPhone)
      autoCheck(storedPhone)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const getOrCreateDeviceToken = async (): Promise<{ token: string; name: string }> => {
    let token = getStoredDeviceToken()
    if (!token) {
      const fp = await generateBrowserFingerprint()
      token = `dt_${fp.slice(0, 32)}`
      setDeviceToken(token)
    }
    return { token, name: detectDeviceName() }
  }

  const callLoginApi = async (cleanedPhone: string): Promise<void> => {
    const { token, name } = await getOrCreateDeviceToken()

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: cleanedPhone, deviceToken: token, deviceName: name }),
    })
    const data = await res.json()

    if (data.status === 'DEVICE_APPROVED') {
      router.push('/attendance')
      return
    }

    if (data.status === 'DEVICE_PENDING') {
      localStorage.setItem(STORED_PHONE_KEY, cleanedPhone)
      setPhase('pending')
      setError('')
      return
    }

    if (data.status === 'DEVICE_REJECTED') {
      localStorage.removeItem(STORED_PHONE_KEY)
      setPhase('rejected')
      return
    }

    // NOT_REGISTERED, INACTIVE, 기타 오류
    localStorage.removeItem(STORED_PHONE_KEY)
    setError(data.message ?? '오류가 발생했습니다.')
    setPhase('input')
  }

  const autoCheck = async (storedPhone: string) => {
    try {
      await callLoginApi(storedPhone)
    } catch {
      // 자동 확인 실패 시 입력 화면 유지
    }
  }

  const handleLogin = async () => {
    const cleaned = phone.replace(/[^0-9]/g, '')
    if (!/^010\d{8}$/.test(cleaned)) {
      setError('010으로 시작하는 11자리 숫자를 입력하세요.')
      return
    }

    setLoading(true)
    setError('')
    try {
      await callLoginApi(cleaned)
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleRefreshStatus = async () => {
    const cleaned = phone.replace(/[^0-9]/g, '')
    setLoading(true)
    try {
      await callLoginApi(cleaned)
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

  // ── 승인 대기 화면 ──────────────────────────────────────────
  if (phase === 'pending') {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.icon}>⏳</div>
          <h1 style={styles.title}>승인 대기 중</h1>
          <p style={styles.body}>
            기기 등록 요청이 접수되었습니다.
            <br />
            관리자 승인 후 출퇴근이 가능합니다.
          </p>
          <p style={styles.phoneLabel}>{formatPhone(phone)}</p>
          <button
            onClick={handleRefreshStatus}
            disabled={loading}
            style={{ ...styles.button, opacity: loading ? 0.6 : 1 }}
          >
            {loading ? '확인 중...' : '승인 여부 확인'}
          </button>
          <button
            onClick={() => {
              localStorage.removeItem(STORED_PHONE_KEY)
              setPhase('input')
              setPhone('')
              setError('')
            }}
            style={styles.secondaryButton}
          >
            다른 번호로 시도
          </button>
        </div>
      </div>
    )
  }

  // ── 반려 화면 ────────────────────────────────────────────────
  if (phase === 'rejected') {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.icon}>✗</div>
          <h1 style={styles.title}>기기 등록 반려</h1>
          <p style={styles.body}>
            기기 등록 요청이 반려되었습니다.
            <br />
            관리자에게 문의하세요.
          </p>
          <button
            onClick={() => {
              setPhase('input')
              setPhone('')
              setError('')
            }}
            style={{ ...styles.button, marginTop: '24px' }}
          >
            확인
          </button>
        </div>
      </div>
    )
  }

  // ── 번호 입력 화면 (기본) ────────────────────────────────────
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={{ textAlign: 'center', marginBottom: '4px' }}>
          <Image src="/logo/logo_dark_1x.png" alt="해한Ai Engineering" width={220} height={44} style={{ height: '52px', width: 'auto', margin: '0 auto', display: 'block' }} priority />
          <div style={{ fontSize: '12px', color: '#5a6a7e', marginTop: '8px' }}>현장 출퇴근 관리 시스템</div>
        </div>
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '20px 0' }} />
        <h1 style={{ ...styles.title, fontSize: '18px', marginBottom: '4px' }}>로그인</h1>
        <p style={styles.subtitle}>휴대폰 번호를 입력하세요</p>

        <div style={styles.inputGroup}>
          <label style={styles.label}>휴대폰 번호</label>
          <input
            type="tel"
            inputMode="numeric"
            placeholder="010-0000-0000"
            value={formatPhone(phone)}
            onChange={(e) => {
              setPhone(e.target.value.replace(/[^0-9]/g, ''))
              setError('')
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            style={styles.input}
            maxLength={13}
          />
        </div>

        {error && <p style={styles.error}>{error}</p>}

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{ ...styles.button, opacity: loading ? 0.6 : 1 }}
        >
          {loading ? '확인 중...' : '로그인'}
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
    background: 'linear-gradient(135deg, #0F1724 0%, #1B2838 60%, #141E2A 100%)',
  },
  card: {
    background: '#243144',
    borderRadius: '16px',
    padding: '40px 32px',
    width: '100%',
    maxWidth: '400px',
    boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderTop: '3px solid #F47920',
  },
  icon: {
    fontSize: '48px',
    textAlign: 'center',
    marginBottom: '16px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#ffffff',
    margin: '0 0 8px',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: '14px',
    color: '#A0AEC0',
    textAlign: 'center',
    margin: '0 0 32px',
  },
  body: {
    fontSize: '14px',
    color: '#A0AEC0',
    textAlign: 'center',
    lineHeight: 1.7,
    margin: '0 0 12px',
  },
  phoneLabel: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#ffffff',
    textAlign: 'center',
    margin: '0 0 24px',
    letterSpacing: '1px',
  },
  inputGroup: { marginBottom: '16px' },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: 600,
    color: '#A0AEC0',
    marginBottom: '8px',
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    fontSize: '18px',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '10px',
    outline: 'none',
    boxSizing: 'border-box',
    letterSpacing: '2px',
    background: 'rgba(255,255,255,0.06)',
    color: '#ffffff',
  },
  error: {
    color: '#f56565',
    fontSize: '13px',
    margin: '0 0 16px',
  },
  button: {
    display: 'block',
    width: '100%',
    padding: '16px',
    fontSize: '18px',
    fontWeight: 700,
    background: '#F47920',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    marginTop: '8px',
  },
  secondaryButton: {
    display: 'block',
    width: '100%',
    padding: '12px',
    fontSize: '14px',
    background: 'none',
    color: '#A0AEC0',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '10px',
    cursor: 'pointer',
    marginTop: '10px',
  },
}
