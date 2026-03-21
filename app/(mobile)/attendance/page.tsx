'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface TodayStatus {
  id: string
  siteName: string
  siteAddress: string
  workDate: string
  checkInAt: string | null
  checkOutAt: string | null
  status: 'WORKING' | 'COMPLETED' | 'EXCEPTION'
  checkInDistance: number | null
  checkOutDistance: number | null
}

interface WorkerInfo {
  name: string
  company: string
  jobTitle: string
}

interface PendingPresence {
  id: string
  timeBucket: 'AM' | 'PM'
  checkDate: string
  siteName: string
  siteAddress: string
  scheduledAt: string
  expiresAt: string | null
  radiusMeters: number
}

type PresenceResult =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'completed'; distanceMeters: number; allowedRadiusMeters: number }
  | { state: 'out_of_geofence'; distanceMeters: number; allowedRadiusMeters: number }
  | { state: 'expired' }
  | { state: 'gps_denied' }
  | { state: 'error'; message: string }

const STATUS_LABEL: Record<string, string> = {
  WORKING: '근무 중', COMPLETED: '퇴근 완료', EXCEPTION: '예외 처리',
}
const STATUS_COLOR: Record<string, string> = {
  WORKING: '#2e7d32', COMPLETED: '#1565c0', EXCEPTION: '#e65100',
}

export default function AttendancePage() {
  const router = useRouter()
  const [worker, setWorker]           = useState<WorkerInfo | null>(null)
  const [today, setToday]             = useState<TodayStatus | null>(null)
  const [loading, setLoading]         = useState(true)
  const [isPreview, setIsPreview]     = useState(false)
  const [pending, setPending]         = useState<PendingPresence | null>(null)
  const [presenceResult, setPresenceResult] = useState<PresenceResult>({ state: 'idle' })
  const [countdown, setCountdown]     = useState<string | null>(null)

  // ── 초기 데이터 로딩 ─────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then((r) => r.json()),
      fetch('/api/attendance/today').then((r) => r.json()),
    ]).then(([meData, todayData]) => {
      if (!meData.success) {
        setIsPreview(true)
        setWorker({ name: '홍길동 (미리보기)', company: '해한건설', jobTitle: '철근공' })
        setToday(null)
        setLoading(false)
        return
      }
      setWorker(meData.data)
      setToday(todayData.data)
      setLoading(false)
    })
  }, [router])

  // ── 체류확인 PENDING 조회 ─────────────────────────────────────
  const fetchPending = useCallback(() => {
    if (isPreview) return
    fetch('/api/attendance/presence/my-pending')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setPending(data.data.item)
      })
      .catch(() => {})
  }, [isPreview])

  useEffect(() => {
    if (!loading && !isPreview) {
      fetchPending()
      const id = setInterval(fetchPending, 30_000)
      return () => clearInterval(id)
    }
  }, [loading, isPreview, fetchPending])

  // ── 카운트다운 타이머 ─────────────────────────────────────────
  useEffect(() => {
    if (!pending?.expiresAt) { setCountdown(null); return }
    const tick = () => {
      const diff = new Date(pending.expiresAt!).getTime() - Date.now()
      if (diff <= 0) {
        setCountdown('만료됨')
        setPending(null)
        return
      }
      const m = Math.floor(diff / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setCountdown(`${m}:${String(s).padStart(2, '0')}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [pending])

  // ── 체류확인 응답 처리 ────────────────────────────────────────
  const handlePresenceRespond = async () => {
    if (!pending) return
    setPresenceResult({ state: 'loading' })

    let pos: GeolocationPosition
    try {
      pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true, timeout: 10000,
        })
      )
    } catch {
      setPresenceResult({ state: 'gps_denied' })
      return
    }

    const { latitude, longitude, accuracy } = pos.coords
    try {
      const res  = await fetch('/api/attendance/presence/respond', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ presenceCheckId: pending.id, latitude, longitude, accuracy }),
      })
      const data = await res.json()

      if (!res.ok) {
        const code = data.message ?? ''
        if (code.includes('EXPIRED')) { setPresenceResult({ state: 'expired' }); return }
        setPresenceResult({ state: 'error', message: data.message })
        return
      }

      if (data.data.status === 'COMPLETED') {
        setPresenceResult({ state: 'completed', distanceMeters: data.data.distanceMeters, allowedRadiusMeters: data.data.allowedRadiusMeters })
      } else {
        setPresenceResult({ state: 'out_of_geofence', distanceMeters: data.data.distanceMeters, allowedRadiusMeters: data.data.allowedRadiusMeters })
      }
      setPending(null)
    } catch {
      setPresenceResult({ state: 'error', message: '네트워크 오류가 발생했습니다.' })
    }
  }

  const formatTime = (iso: string | null) => {
    if (!iso) return '--:--'
    return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <p>불러오는 중...</p>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      {/* 미리보기 배너 */}
      {isPreview && (
        <div style={styles.previewBanner}>
          <span>👀 미리보기 모드 — 실제 사용하려면</span>
          <button onClick={() => router.push('/login')} style={styles.previewLoginBtn}>로그인하기</button>
        </div>
      )}

      {/* 헤더 */}
      <div style={styles.header}>
        <div>
          <div style={styles.workerName}>{worker?.name}</div>
          <div style={styles.workerInfo}>{worker?.company} · {worker?.jobTitle}</div>
        </div>
        <button
          onClick={() => isPreview ? router.push('/login') : fetch('/api/auth/logout', { method: 'POST' }).then(() => router.push('/login'))}
          style={styles.logoutBtn}
        >
          {isPreview ? '로그인' : '로그아웃'}
        </button>
      </div>

      {/* ── 체류확인 카드 (PENDING 있을 때 우선 노출) ── */}
      {!isPreview && (pending || presenceResult.state !== 'idle') && (
        <PresenceCard
          pending={pending}
          result={presenceResult}
          countdown={countdown}
          onRespond={handlePresenceRespond}
          onDismiss={() => setPresenceResult({ state: 'idle' })}
        />
      )}

      {/* 오늘 현황 */}
      <div style={styles.card}>
        <div style={styles.dateLabel}>오늘의 출퇴근</div>
        {today ? (
          <>
            <div style={{ ...styles.statusBadge, background: STATUS_COLOR[today.status] }}>
              {STATUS_LABEL[today.status]}
            </div>
            <div style={styles.siteName}>{today.siteName}</div>
            <div style={styles.siteAddress}>{today.siteAddress}</div>
            <div style={styles.timeRow}>
              <div style={styles.timeBox}>
                <div style={styles.timeLabel}>출근</div>
                <div style={styles.timeValue}>{formatTime(today.checkInAt)}</div>
                {today.checkInDistance != null && <div style={styles.distanceLabel}>{today.checkInDistance}m</div>}
              </div>
              <div style={styles.timeDivider}>→</div>
              <div style={styles.timeBox}>
                <div style={styles.timeLabel}>퇴근</div>
                <div style={styles.timeValue}>{formatTime(today.checkOutAt)}</div>
                {today.checkOutDistance != null && <div style={styles.distanceLabel}>{today.checkOutDistance}m</div>}
              </div>
            </div>
          </>
        ) : (
          <div style={styles.noRecord}>
            <p>오늘 출근 기록이 없습니다.</p>
            <p style={{ fontSize: '13px', color: '#888' }}>현장 QR코드를 스캔하여 출근하세요.</p>
          </div>
        )}
      </div>

      {/* 안내 */}
      <div style={styles.guideCard}>
        <div style={styles.guideTitle}>출퇴근 방법</div>
        <div style={styles.guideStep}>1. 현장에 부착된 QR코드를 스캔하세요</div>
        <div style={styles.guideStep}>2. 위치 권한을 허용하세요</div>
        <div style={styles.guideStep}>3. 출근 / 퇴근 버튼을 누르세요</div>
      </div>

      {!isPreview && (
        <button onClick={() => router.push('/device/change')} style={styles.changeDeviceBtn}>
          기기 변경 요청
        </button>
      )}
    </div>
  )
}

/* ── PresenceCard 컴포넌트 ─────────────────────────────────── */
function PresenceCard({
  pending, result, countdown, onRespond, onDismiss,
}: {
  pending: PendingPresence | null
  result: PresenceResult
  countdown: string | null
  onRespond: () => void
  onDismiss: () => void
}) {
  // 결과 화면
  if (result.state === 'completed') {
    return (
      <div style={pc.card}>
        <div style={pc.iconRow}>✅</div>
        <div style={{ ...pc.title, color: '#2e7d32' }}>현장 체류 확인 완료</div>
        <div style={pc.desc}>현장 기준 {result.distanceMeters}m · 허용 {result.allowedRadiusMeters}m</div>
        <button onClick={onDismiss} style={pc.secondaryBtn}>닫기</button>
      </div>
    )
  }
  if (result.state === 'out_of_geofence') {
    return (
      <div style={{ ...pc.card, borderColor: '#e53935' }}>
        <div style={pc.iconRow}>📍</div>
        <div style={{ ...pc.title, color: '#c62828' }}>현장 반경 밖</div>
        <div style={pc.desc}>현장 기준 {result.distanceMeters}m · 허용 {result.allowedRadiusMeters}m</div>
        <div style={pc.warn}>현장 근처에서 관리자에게 문의하세요.</div>
        <button onClick={onDismiss} style={pc.secondaryBtn}>닫기</button>
      </div>
    )
  }
  if (result.state === 'expired') {
    return (
      <div style={{ ...pc.card, borderColor: '#bbb' }}>
        <div style={pc.iconRow}>⏱️</div>
        <div style={{ ...pc.title, color: '#888' }}>응답 시간 종료</div>
        <div style={pc.desc}>체류 확인 응답 가능 시간이 지났습니다.</div>
        <button onClick={onDismiss} style={pc.secondaryBtn}>닫기</button>
      </div>
    )
  }
  if (result.state === 'gps_denied') {
    return (
      <div style={{ ...pc.card, borderColor: '#e65100' }}>
        <div style={pc.iconRow}>📵</div>
        <div style={{ ...pc.title, color: '#e65100' }}>위치 권한 필요</div>
        <div style={pc.desc}>브라우저 위치 권한을 허용 후 다시 시도해 주세요.</div>
        <button onClick={onRespond} style={pc.primaryBtn}>다시 시도</button>
      </div>
    )
  }
  if (result.state === 'error') {
    return (
      <div style={{ ...pc.card, borderColor: '#e53935' }}>
        <div style={pc.iconRow}>⚠️</div>
        <div style={{ ...pc.title, color: '#c62828' }}>오류 발생</div>
        <div style={pc.desc}>{result.message}</div>
        <button onClick={onDismiss} style={pc.secondaryBtn}>닫기</button>
      </div>
    )
  }

  // PENDING 요청 화면
  if (!pending) return null

  const isLoading = result.state === 'loading'
  return (
    <div style={pc.card}>
      <div style={pc.badge}>{pending.timeBucket === 'AM' ? '오전 체류 확인' : '오후 체류 확인'}</div>
      <div style={pc.title}>현장 체류 확인 요청</div>
      <div style={pc.siteName}>{pending.siteName}</div>
      <div style={pc.desc}>관리자가 현재 현장 체류 확인을 요청했습니다.<br />아래 버튼을 눌러 현재 위치로 응답해 주세요.</div>
      {countdown && (
        <div style={{ ...pc.countdown, color: countdown === '만료됨' ? '#888' : '#e65100' }}>
          ⏱ 마감까지 {countdown}
        </div>
      )}
      <button
        onClick={onRespond}
        disabled={isLoading}
        style={{ ...pc.primaryBtn, opacity: isLoading ? 0.6 : 1 }}
      >
        {isLoading ? '위치 확인 중...' : '현재 위치로 응답'}
      </button>
    </div>
  )
}

/* ── 스타일 ──────────────────────────────────────────────────── */
const styles: Record<string, React.CSSProperties> = {
  container:       { maxWidth: '480px', margin: '0 auto', padding: '20px', minHeight: '100vh' },
  previewBanner:   { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff3e0', border: '1px solid #ffb74d', borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#e65100', gap: '8px' },
  previewLoginBtn: { padding: '6px 14px', background: '#1976d2', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 700, flexShrink: 0 },
  header:          { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingTop: '8px' },
  workerName:      { fontSize: '18px', fontWeight: 700, color: '#1a1a2e' },
  workerInfo:      { fontSize: '13px', color: '#666', marginTop: '2px' },
  logoutBtn:       { background: 'none', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer', color: '#666' },
  card:            { background: 'white', borderRadius: '16px', padding: '24px', marginBottom: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  dateLabel:       { fontSize: '13px', color: '#888', marginBottom: '12px' },
  statusBadge:     { display: 'inline-block', color: 'white', fontSize: '13px', fontWeight: 700, padding: '4px 12px', borderRadius: '20px', marginBottom: '12px' },
  siteName:        { fontSize: '18px', fontWeight: 700, color: '#1a1a2e', marginBottom: '4px' },
  siteAddress:     { fontSize: '13px', color: '#888', marginBottom: '20px' },
  timeRow:         { display: 'flex', alignItems: 'center', gap: '12px' },
  timeBox:         { flex: 1, textAlign: 'center' as const },
  timeLabel:       { fontSize: '12px', color: '#999', marginBottom: '4px' },
  timeValue:       { fontSize: '24px', fontWeight: 700, color: '#1a1a2e' },
  distanceLabel:   { fontSize: '11px', color: '#aaa', marginTop: '4px' },
  timeDivider:     { fontSize: '20px', color: '#ccc' },
  noRecord:        { textAlign: 'center' as const, padding: '20px 0', color: '#555' },
  guideCard:       { background: '#e3f2fd', borderRadius: '12px', padding: '20px', marginBottom: '16px' },
  guideTitle:      { fontSize: '14px', fontWeight: 700, color: '#1565c0', marginBottom: '12px' },
  guideStep:       { fontSize: '13px', color: '#1976d2', marginBottom: '6px' },
  changeDeviceBtn: { width: '100%', padding: '12px', fontSize: '14px', background: 'none', border: '1px solid #e0e0e0', borderRadius: '10px', cursor: 'pointer', color: '#666' },
}

const pc: Record<string, React.CSSProperties> = {
  card:         { background: 'white', border: '2px solid #1976d2', borderRadius: '16px', padding: '24px', marginBottom: '16px', boxShadow: '0 2px 12px rgba(25,118,210,0.12)' },
  badge:        { display: 'inline-block', background: '#e3f2fd', color: '#1565c0', fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '12px', marginBottom: '10px' },
  title:        { fontSize: '18px', fontWeight: 700, color: '#1a1a2e', marginBottom: '6px' },
  siteName:     { fontSize: '14px', fontWeight: 600, color: '#1976d2', marginBottom: '10px' },
  desc:         { fontSize: '13px', color: '#555', lineHeight: 1.7, marginBottom: '16px' },
  warn:         { fontSize: '12px', color: '#888', marginBottom: '16px', lineHeight: 1.6 },
  countdown:    { fontSize: '15px', fontWeight: 700, marginBottom: '14px' },
  iconRow:      { fontSize: '40px', textAlign: 'center' as const, marginBottom: '12px' },
  primaryBtn:   { width: '100%', padding: '16px', fontSize: '17px', fontWeight: 700, background: '#1976d2', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer' },
  secondaryBtn: { width: '100%', padding: '12px', fontSize: '14px', background: '#f5f5f5', color: '#555', border: 'none', borderRadius: '10px', cursor: 'pointer', marginTop: '8px' },
}
