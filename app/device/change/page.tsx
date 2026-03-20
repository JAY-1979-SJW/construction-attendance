'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { generateBrowserFingerprint, detectDeviceName } from '@/lib/utils/device-token'

export default function DeviceChangePage() {
  const router = useRouter()
  const [deviceName, setDeviceName] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    setDeviceName(detectDeviceName())
  }, [])

  const handleSubmit = async () => {
    if (!reason.trim() || reason.length < 5) {
      setError('변경 사유를 5자 이상 입력하세요.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const fingerprint = await generateBrowserFingerprint()
      const newDeviceToken = `dt_${fingerprint.slice(0, 32)}`

      const res = await fetch('/api/device/change-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newDeviceToken, newDeviceName: deviceName, reason }),
      })
      const data = await res.json()

      if (!data.success) {
        setError(data.message)
        return
      }

      setSubmitted(true)
    } catch {
      setError('요청 처리 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={{ fontSize: '48px', textAlign: 'center', marginBottom: '16px' }}>📨</div>
          <h1 style={{ ...styles.title, marginBottom: '12px' }}>요청 접수 완료</h1>
          <p style={{ textAlign: 'center', color: '#555', fontSize: '14px', lineHeight: 1.6 }}>
            기기 변경 요청이 관리자에게 전달되었습니다.
            <br />
            승인 후 새 기기에서 출퇴근 가능합니다.
          </p>
          <button onClick={() => router.push('/attendance')} style={{ ...styles.button, marginTop: '24px' }}>
            확인
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <button onClick={() => router.back()} style={styles.back}>← 뒤로</button>
        <h1 style={styles.title}>기기 변경 요청</h1>
        <p style={styles.subtitle}>관리자 승인 후 새 기기로 출퇴근할 수 있습니다.</p>

        <div style={styles.inputGroup}>
          <label style={styles.label}>새 기기 이름</label>
          <input
            type="text"
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
            style={styles.input}
          />
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>변경 사유</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="기기 분실, 기기 교체 등 변경 사유를 입력하세요."
            style={{ ...styles.input, height: '100px', resize: 'vertical' as const }}
          />
        </div>

        {error && <p style={styles.error}>{error}</p>}

        <button onClick={handleSubmit} disabled={loading} style={{ ...styles.button, opacity: loading ? 0.6 : 1 }}>
          {loading ? '요청 중...' : '변경 요청하기'}
        </button>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', background: '#f0f4f8' },
  card: { background: 'white', borderRadius: '16px', padding: '40px 32px', width: '100%', maxWidth: '400px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' },
  back: { background: 'none', border: 'none', color: '#666', fontSize: '14px', cursor: 'pointer', padding: '0 0 16px', display: 'block' },
  title: { fontSize: '22px', fontWeight: 700, color: '#1a1a2e', margin: '0 0 8px', textAlign: 'center' },
  subtitle: { fontSize: '13px', color: '#666', textAlign: 'center', margin: '0 0 28px', lineHeight: 1.5 },
  inputGroup: { marginBottom: '16px' },
  label: { display: 'block', fontSize: '14px', fontWeight: 600, color: '#333', marginBottom: '8px' },
  input: { width: '100%', padding: '12px 14px', fontSize: '15px', border: '2px solid #e0e0e0', borderRadius: '8px', outline: 'none', boxSizing: 'border-box' as const },
  error: { color: '#e53935', fontSize: '13px', margin: '0 0 12px' },
  button: { width: '100%', padding: '16px', fontSize: '17px', fontWeight: 700, background: '#1976d2', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer' },
}
