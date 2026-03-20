'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { getStoredDeviceToken } from '@/lib/utils/device-token'

interface SiteInfo {
  id: string
  name: string
  address: string
  latitude: number
  longitude: number
  allowedRadius: number
}

type Mode = 'loading' | 'check-in' | 'move' | 'check-out' | 'completed' | 'already-done' | 'error'

export default function QrPage({ params }: { params: Promise<{ qrToken: string }> }) {
  const { qrToken } = use(params)
  const router = useRouter()
  const [site, setSite] = useState<SiteInfo | null>(null)
  const [mode, setMode] = useState<Mode>('loading')
  const [message, setMessage] = useState('')
  const [processing, setProcessing] = useState(false)
  const [distance, setDistance] = useState<number | null>(null)
  const [completedLabel, setCompletedLabel] = useState('')

  // 이동 모드 전용: 현재 근무 중인 현장명
  const [currentSiteName, setCurrentSiteName] = useState('')

  useEffect(() => {
    const init = async () => {
      try {
        // 1. 로그인 확인
        const meRes = await fetch('/api/auth/me')
        const me = await meRes.json()
        if (!me.success) {
          router.push(`/login`)
          return
        }

        // 2. QR → 현장 조회
        const siteRes = await fetch(`/api/sites/by-qr/${qrToken}`)
        const siteData = await siteRes.json()
        if (!siteData.success) {
          setMode('error')
          setMessage(siteData.message ?? '유효하지 않은 QR코드입니다.')
          return
        }
        const scannedSite: SiteInfo = siteData.data
        setSite(scannedSite)

        // 3. 오늘 기록 확인
        const todayRes = await fetch('/api/attendance/today')
        const todayData = await todayRes.json()
        const today = todayData.data

        if (today?.checkOutAt) {
          // 퇴근 완료
          setMode('already-done')
        } else if (today?.checkInAt && today?.status === 'WORKING') {
          // 열린 세션 있음 → 현재 현장 vs 스캔 현장 비교
          const currentSiteId: string = today.currentSiteId
          if (currentSiteId && scannedSite.id !== currentSiteId) {
            // 다른 현장 → 이동 모드
            setCurrentSiteName(today.currentSiteName ?? today.siteName)
            setMode('move')
          } else {
            // 같은 현장 → 퇴근 모드
            setMode('check-out')
          }
        } else if (today?.checkInAt) {
          // 세션 있지만 WORKING이 아님 (MISSING_CHECKOUT 등)
          setMode('already-done')
        } else {
          // 오늘 세션 없음 → 출근 모드
          setMode('check-in')
        }
      } catch {
        setMode('error')
        setMessage('오류가 발생했습니다.')
      }
    }
    init()
  }, [qrToken, router])

  const getGpsPosition = (): Promise<GeolocationPosition> =>
    new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
      })
    )

  const getDeviceToken = (): string | null => {
    const token = getStoredDeviceToken()
    if (!token) router.push('/device/register')
    return token
  }

  const handleCheckIn = async () => {
    const deviceToken = getDeviceToken()
    if (!deviceToken) return

    setProcessing(true)
    setMessage('')
    try {
      const pos = await getGpsPosition()
      const { latitude, longitude } = pos.coords
      const res = await fetch('/api/attendance/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrToken, latitude, longitude, deviceToken }),
      })
      const data = await res.json()
      if (data.success) {
        setDistance(data.data.distance)
        setCompletedLabel('출근이 완료되었습니다.')
        setMode('completed')
      } else {
        setMessage(data.message)
      }
    } catch (err: unknown) {
      setMessage(err instanceof GeolocationPositionError
        ? '위치 정보를 가져올 수 없습니다. 위치 권한을 허용해주세요.'
        : '처리 중 오류가 발생했습니다.')
    } finally {
      setProcessing(false)
    }
  }

  const handleMove = async () => {
    const deviceToken = getDeviceToken()
    if (!deviceToken) return

    setProcessing(true)
    setMessage('')
    try {
      const pos = await getGpsPosition()
      const { latitude, longitude } = pos.coords
      const res = await fetch('/api/attendance/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrToken, latitude, longitude, deviceToken }),
      })
      const data = await res.json()
      if (data.success) {
        setDistance(data.data?.distance ?? null)
        setCompletedLabel(`${site?.name ?? ''} 현장으로 이동 완료되었습니다.`)
        setMode('completed')
      } else {
        setMessage(data.message)
      }
    } catch (err: unknown) {
      setMessage(err instanceof GeolocationPositionError
        ? '위치 정보를 가져올 수 없습니다. 위치 권한을 허용해주세요.'
        : '처리 중 오류가 발생했습니다.')
    } finally {
      setProcessing(false)
    }
  }

  const handleCheckOut = async () => {
    const deviceToken = getDeviceToken()
    if (!deviceToken) return

    setProcessing(true)
    setMessage('')
    try {
      const pos = await getGpsPosition()
      const { latitude, longitude } = pos.coords
      const res = await fetch('/api/attendance/check-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrToken, latitude, longitude, deviceToken }),
      })
      const data = await res.json()
      if (data.success) {
        setDistance(data.data.distance)
        setCompletedLabel('퇴근이 완료되었습니다.')
        setMode('completed')
      } else {
        setMessage(data.message)
      }
    } catch (err: unknown) {
      setMessage(err instanceof GeolocationPositionError
        ? '위치 정보를 가져올 수 없습니다. 위치 권한을 허용해주세요.'
        : '처리 중 오류가 발생했습니다.')
    } finally {
      setProcessing(false)
    }
  }

  if (mode === 'loading') {
    return (
      <div style={centerStyle}>
        <p>잠시만 기다려주세요...</p>
      </div>
    )
  }

  if (mode === 'error') {
    return (
      <div style={centerStyle}>
        <div style={errorCard}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <p style={{ fontWeight: 700, marginBottom: '8px' }}>오류</p>
          <p style={{ color: '#666', fontSize: '14px' }}>{message}</p>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      {/* 현장 정보 */}
      {site && (
        <div style={styles.siteCard}>
          <div style={styles.siteLabel}>스캔한 현장</div>
          <div style={styles.siteName}>{site.name}</div>
          <div style={styles.siteAddress}>{site.address}</div>
        </div>
      )}

      {/* 메인 액션 */}
      <div style={styles.actionCard}>
        {mode === 'check-in' && (
          <>
            <div style={styles.actionIcon}>🏗️</div>
            <div style={styles.actionTitle}>출근 처리</div>
            <div style={styles.actionDesc}>현재 위치를 확인 후 출근 처리합니다.</div>
            {message && <div style={styles.errorMsg}>{message}</div>}
            <button
              onClick={handleCheckIn}
              disabled={processing}
              style={{ ...styles.checkInBtn, opacity: processing ? 0.6 : 1 }}
            >
              {processing ? '처리 중...' : '출근하기'}
            </button>
          </>
        )}

        {mode === 'move' && (
          <>
            <div style={styles.actionIcon}>🚶</div>
            <div style={styles.actionTitle}>현장 이동</div>
            <div style={styles.statusInfo}>
              <div style={styles.statusRow}>
                <span style={styles.statusLabel}>현재 근무 현장</span>
                <span style={styles.statusValue}>{currentSiteName}</span>
              </div>
              <div style={styles.statusArrow}>↓ 이동</div>
              <div style={styles.statusRow}>
                <span style={styles.statusLabel}>이동할 현장</span>
                <span style={{ ...styles.statusValue, color: '#1565c0' }}>{site?.name}</span>
              </div>
            </div>
            <div style={styles.actionDesc}>이동 처리 후 근무 현장이 변경됩니다.</div>
            {message && <div style={styles.errorMsg}>{message}</div>}
            <button
              onClick={handleMove}
              disabled={processing}
              style={{ ...styles.moveBtn, opacity: processing ? 0.6 : 1 }}
            >
              {processing ? '처리 중...' : '현장 이동'}
            </button>
          </>
        )}

        {mode === 'check-out' && (
          <>
            <div style={styles.actionIcon}>🏠</div>
            <div style={styles.actionTitle}>퇴근 처리</div>
            <div style={styles.actionDesc}>현재 위치를 확인 후 퇴근 처리합니다.</div>
            {message && <div style={styles.errorMsg}>{message}</div>}
            <button
              onClick={handleCheckOut}
              disabled={processing}
              style={{ ...styles.checkOutBtn, opacity: processing ? 0.6 : 1 }}
            >
              {processing ? '처리 중...' : '퇴근하기'}
            </button>
          </>
        )}

        {mode === 'completed' && (
          <>
            <div style={styles.actionIcon}>✅</div>
            <div style={{ ...styles.actionTitle, color: '#2e7d32' }}>{completedLabel}</div>
            {distance != null && (
              <div style={styles.actionDesc}>현장까지 거리: {distance}m</div>
            )}
            <button onClick={() => router.push('/attendance')} style={styles.homeBtn}>
              내 출퇴근 현황 보기
            </button>
          </>
        )}

        {mode === 'already-done' && (
          <>
            <div style={styles.actionIcon}>✔️</div>
            <div style={styles.actionTitle}>오늘 출퇴근 완료</div>
            <div style={styles.actionDesc}>이미 오늘 출퇴근이 완료되었습니다.</div>
            <button onClick={() => router.push('/attendance')} style={styles.homeBtn}>
              내 출퇴근 현황 보기
            </button>
          </>
        )}
      </div>

      {/* 예외 신청 */}
      {(mode === 'check-in' || mode === 'check-out' || mode === 'move') && (
        <button
          onClick={() => router.push(`/attendance?exception=1&siteId=${site?.id}`)}
          style={styles.exceptionBtn}
        >
          GPS 오류 또는 예외 신청
        </button>
      )}
    </div>
  )
}

const centerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: '100vh',
}

const errorCard: React.CSSProperties = {
  background: 'white',
  borderRadius: '16px',
  padding: '40px 32px',
  textAlign: 'center',
  maxWidth: '360px',
  width: '90%',
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: '480px', margin: '0 auto', padding: '20px', minHeight: '100vh' },
  siteCard: {
    background: 'white',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '16px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  },
  siteLabel: { fontSize: '12px', color: '#999', marginBottom: '6px' },
  siteName: { fontSize: '20px', fontWeight: 700, color: '#1a1a2e', marginBottom: '4px' },
  siteAddress: { fontSize: '13px', color: '#888' },
  actionCard: {
    background: 'white',
    borderRadius: '16px',
    padding: '40px 32px',
    textAlign: 'center',
    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
    marginBottom: '16px',
  },
  actionIcon: { fontSize: '56px', marginBottom: '16px' },
  actionTitle: { fontSize: '22px', fontWeight: 700, color: '#1a1a2e', marginBottom: '8px' },
  actionDesc: { fontSize: '14px', color: '#666', marginBottom: '24px' },
  statusInfo: {
    background: '#f8f9fa',
    borderRadius: '10px',
    padding: '16px',
    marginBottom: '20px',
    textAlign: 'left',
  },
  statusRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' },
  statusLabel: { fontSize: '12px', color: '#999', flexShrink: 0 },
  statusValue: { fontSize: '14px', fontWeight: 600, color: '#1a1a2e', textAlign: 'right' as const },
  statusArrow: { textAlign: 'center' as const, color: '#bbb', fontSize: '18px', margin: '8px 0' },
  errorMsg: {
    color: '#e53935',
    fontSize: '13px',
    background: '#fff5f5',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '16px',
    textAlign: 'left' as const,
  },
  checkInBtn: {
    width: '100%',
    padding: '18px',
    fontSize: '20px',
    fontWeight: 700,
    background: '#2e7d32',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
  },
  moveBtn: {
    width: '100%',
    padding: '18px',
    fontSize: '20px',
    fontWeight: 700,
    background: '#e65100',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
  },
  checkOutBtn: {
    width: '100%',
    padding: '18px',
    fontSize: '20px',
    fontWeight: 700,
    background: '#1565c0',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
  },
  homeBtn: {
    width: '100%',
    padding: '16px',
    fontSize: '16px',
    fontWeight: 600,
    background: '#f5f5f5',
    color: '#333',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
  },
  exceptionBtn: {
    width: '100%',
    padding: '12px',
    fontSize: '13px',
    background: 'none',
    border: '1px solid #e0e0e0',
    borderRadius: '10px',
    cursor: 'pointer',
    color: '#888',
  },
}
