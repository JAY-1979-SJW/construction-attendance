'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  generateBrowserFingerprint,
  getStoredDeviceToken,
  setDeviceToken,
  detectDeviceName,
} from '@/lib/utils/device-token'
import { generateToken } from '@/lib/utils/random'

export default function DeviceRegisterPage() {
  const router = useRouter()
  const [deviceName, setDeviceName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setDeviceName(detectDeviceName())
  }, [])

  const handleRegister = async () => {
    setLoading(true)
    setError('')

    try {
      // 브라우저 fingerprint 기반 device token 생성
      const fingerprint = await generateBrowserFingerprint()
      const deviceToken = `dt_${fingerprint.slice(0, 32)}`

      const res = await fetch('/api/device/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceToken, deviceName }),
      })
      const data = await res.json()

      if (!data.success) {
        setError(data.message)
        return
      }

      setDeviceToken(deviceToken)
      router.push('/attendance')
    } catch {
      setError('기기 등록에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>기기 등록</h1>
        <p style={styles.subtitle}>
          이 기기를 본인 기기로 등록합니다.
          <br />
          이후 이 기기에서만 출퇴근이 가능합니다.
        </p>

        <div style={styles.inputGroup}>
          <label style={styles.label}>기기 이름</label>
          <input
            type="text"
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
            style={styles.input}
            placeholder="내 휴대폰"
          />
        </div>

        {error && <p style={styles.error}>{error}</p>}

        <button
          onClick={handleRegister}
          disabled={loading}
          style={{ ...styles.button, opacity: loading ? 0.6 : 1 }}
        >
          {loading ? '등록 중...' : '이 기기로 등록하기'}
        </button>

        <div style={styles.notice}>
          <strong>주의:</strong> 기기 분실 또는 변경 시 현장 관리자에게 기기 변경 요청을 해야 합니다.
        </div>
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
    background: '#1B2838',
  },
  card: {
    background: '#243144',
    borderRadius: '16px',
    padding: '40px 32px',
    width: '100%',
    maxWidth: '400px',
    boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
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
    lineHeight: 1.6,
  },
  inputGroup: { marginBottom: '20px' },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: 600,
    color: '#CBD5E0',
    marginBottom: '8px',
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    fontSize: '16px',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '10px',
    outline: 'none',
    boxSizing: 'border-box',
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
    background: '#2e7d32',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    marginBottom: '20px',
  },
  notice: {
    fontSize: '12px',
    color: '#A0AEC0',
    background: '#fff8e1',
    borderRadius: '8px',
    padding: '12px',
    lineHeight: 1.6,
  },
}
