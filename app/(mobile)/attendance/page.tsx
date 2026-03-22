'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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

interface AvailableSite {
  siteId: string
  siteName: string
  companyId: string
  companyName: string
  tradeType: string | null
  isPrimary: boolean
  allowedRadiusMeters: number
  distanceMeters: number | null
  withinRadius: boolean | null
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

type GpsCoords = { latitude: number; longitude: number; accuracy: number }

type PresenceResult =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'completed'; distanceMeters: number; allowedRadiusMeters: number }
  | { state: 'out_of_geofence'; distanceMeters: number; allowedRadiusMeters: number }
  | { state: 'review_required'; distanceMeters: number; allowedRadiusMeters: number }
  | { state: 'expired' }
  | { state: 'gps_denied' }
  | { state: 'gps_unavailable' }
  | { state: 'gps_timeout' }
  | { state: 'low_accuracy_warning'; accuracy: number; coords: GpsCoords }
  | { state: 'network_error' }
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
  const submittingRef                  = useRef(false)  // 중복 제출 방지 (연타·두 탭)
  // ── 직접 출근 state ───────────────────────────────────────────
  const [availableSites, setAvailableSites] = useState<AvailableSite[]>([])
  const [checkInLoading, setCheckInLoading] = useState(false)
  const [checkOutLoading, setCheckOutLoading] = useState(false)
  const [attendanceMsg, setAttendanceMsg] = useState('')
  const [exceptionReason, setExceptionReason] = useState('')
  const [needsException, setNeedsException] = useState(false)

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
      // 탭/앱 복귀 시 즉시 pending 재조회 (알림 미지원 환경 대체 흐름)
      const onVisible = () => { if (document.visibilityState === 'visible') fetchPending() }
      document.addEventListener('visibilitychange', onVisible)
      return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible) }
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

  // ── 체류확인 — GPS 위치 가져오기 ─────────────────────────────
  const handlePresenceRespond = async () => {
    if (!pending || submittingRef.current) return
    submittingRef.current = true
    setPresenceResult({ state: 'loading' })

    if (!navigator.onLine) {
      setPresenceResult({ state: 'network_error' })
      return
    }

    let pos: GeolocationPosition
    try {
      pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true, timeout: 12000,
        })
      )
    } catch (err) {
      submittingRef.current = false
      const code = (err as GeolocationPositionError).code
      if (code === 1) { setPresenceResult({ state: 'gps_denied' }); return }
      if (code === 2) { setPresenceResult({ state: 'gps_unavailable' }); return }
      // code === 3: TIMEOUT
      setPresenceResult({ state: 'gps_timeout' })
      return
    }

    const coords: GpsCoords = {
      latitude:  pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy:  pos.coords.accuracy,
    }

    // GPS 정확도 경고 (80m 이상): submittingRef는 사용자가 직접 재결정하므로 해제
    if (coords.accuracy >= 80) {
      submittingRef.current = false
      setPresenceResult({ state: 'low_accuracy_warning', accuracy: Math.round(coords.accuracy), coords })
      return
    }

    await submitPresenceCoords(coords)
  }

  // ── 체류확인 — API 제출 ───────────────────────────────────────
  const submitPresenceCoords = async (coords: GpsCoords) => {
    if (!pending) return
    submittingRef.current = true
    setPresenceResult({ state: 'loading' })
    try {
      const res  = await fetch('/api/attendance/presence/respond', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          presenceCheckId: pending.id,
          latitude:        coords.latitude,
          longitude:       coords.longitude,
          accuracy:        coords.accuracy,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        const msg = data.message ?? ''
        if (msg.includes('EXPIRED')) { setPresenceResult({ state: 'expired' }); return }
        setPresenceResult({ state: 'error', message: data.message ?? '서버 오류가 발생했습니다.' })
        return
      }

      const status = data.data.status as string
      const d = data.data.distanceMeters as number
      const r = data.data.allowedRadiusMeters as number
      if (status === 'COMPLETED') {
        setPresenceResult({ state: 'completed', distanceMeters: d, allowedRadiusMeters: r })
      } else if (status === 'REVIEW_REQUIRED') {
        setPresenceResult({ state: 'review_required', distanceMeters: d, allowedRadiusMeters: r })
      } else {
        setPresenceResult({ state: 'out_of_geofence', distanceMeters: d, allowedRadiusMeters: r })
      }
      setPending(null)
    } catch {
      setPresenceResult({ state: 'network_error' })
    } finally {
      submittingRef.current = false
    }
  }

  // ── GPS 좌표 가져오기 ─────────────────────────────────────────
  const getGpsCoords = (): Promise<{ latitude: number; longitude: number }> =>
    new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 12000 }
      )
    )

  // ── 배정 현장 목록 로딩 ───────────────────────────────────────
  const loadAvailableSites = useCallback(async () => {
    if (isPreview) return
    try {
      let url = '/api/attendance/available-sites'
      if (navigator.geolocation) {
        try {
          const coords = await getGpsCoords()
          url += `?lat=${coords.latitude}&lng=${coords.longitude}`
        } catch { /* GPS 실패해도 목록은 조회 */ }
      }
      const res = await fetch(url)
      const data = await res.json()
      if (data.success) setAvailableSites(data.sites ?? [])
    } catch { /* ignore */ }
  }, [isPreview])

  useEffect(() => {
    if (!loading && !isPreview && !today) {
      loadAvailableSites()
    }
  }, [loading, isPreview, today, loadAvailableSites])

  // ── 직접 출근 ─────────────────────────────────────────────────
  const handleDirectCheckIn = async (siteId: string) => {
    if (checkInLoading) return
    setCheckInLoading(true)
    setAttendanceMsg('')
    try {
      let coords: { latitude: number; longitude: number }
      try {
        coords = await getGpsCoords()
      } catch {
        setAttendanceMsg('GPS 권한을 허용해주세요.')
        return
      }

      const deviceToken = localStorage.getItem('deviceToken') ?? ''
      const res = await fetch('/api/attendance/check-in-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, ...coords, deviceToken }),
      })
      const data = await res.json()

      if (res.ok) {
        setAttendanceMsg(data.message ?? '출근 완료')
        const todayRes = await fetch('/api/attendance/today')
        const todayData = await todayRes.json()
        setToday(todayData.data)
      } else {
        setAttendanceMsg(data.message ?? '출근 실패')
      }
    } finally {
      setCheckInLoading(false)
    }
  }

  // ── 직접 퇴근 ─────────────────────────────────────────────────
  const handleDirectCheckOut = async (reason?: string) => {
    if (checkOutLoading) return
    setCheckOutLoading(true)
    setAttendanceMsg('')
    try {
      let coords: { latitude: number; longitude: number }
      try {
        coords = await getGpsCoords()
      } catch {
        setAttendanceMsg('GPS 권한을 허용해주세요.')
        return
      }

      const deviceToken = localStorage.getItem('deviceToken') ?? ''
      const res = await fetch('/api/attendance/check-out-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...coords, deviceToken, exceptionReason: reason }),
      })
      const data = await res.json()

      if (res.ok) {
        setAttendanceMsg(data.data?.isException ? '예외 퇴근 처리되었습니다.' : '퇴근 완료')
        setNeedsException(false)
        setExceptionReason('')
        const todayRes = await fetch('/api/attendance/today')
        const todayData = await todayRes.json()
        setToday(todayData.data)
      } else {
        if (data.code === 'NEEDS_EXCEPTION_REASON') {
          setNeedsException(true)
          setAttendanceMsg('현장 반경 밖입니다. 퇴근 사유를 입력해주세요.')
        } else {
          setAttendanceMsg(data.message ?? '퇴근 실패')
        }
      }
    } finally {
      setCheckOutLoading(false)
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
          onForceSubmit={submitPresenceCoords}
          onDismiss={() => setPresenceResult({ state: 'idle' })}
        />
      )}

      {/* 출퇴근 메시지 */}
      {attendanceMsg && (
        <div style={{
          background: attendanceMsg.includes('완료') ? '#e8f5e9' : '#fff3e0',
          color: attendanceMsg.includes('완료') ? '#2e7d32' : '#e65100',
          borderRadius: '10px', padding: '12px 16px', marginBottom: '12px', fontSize: '14px', fontWeight: 600,
        }}>
          {attendanceMsg}
        </div>
      )}

      {/* 오늘 현황 + 직접 출퇴근 */}
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
                {today.checkInDistance != null && <div style={styles.distanceLabel}>{Math.round(today.checkInDistance)}m</div>}
              </div>
              <div style={styles.timeDivider}>→</div>
              <div style={styles.timeBox}>
                <div style={styles.timeLabel}>퇴근</div>
                <div style={styles.timeValue}>{formatTime(today.checkOutAt)}</div>
                {today.checkOutDistance != null && <div style={styles.distanceLabel}>{Math.round(today.checkOutDistance)}m</div>}
              </div>
            </div>

            {/* 퇴근 버튼 (근무 중일 때) */}
            {!isPreview && today.status === 'WORKING' && (
              <div style={{ marginTop: '20px' }}>
                {needsException ? (
                  <>
                    <textarea
                      placeholder="반경 밖 퇴근 사유를 입력하세요"
                      value={exceptionReason}
                      onChange={e => setExceptionReason(e.target.value)}
                      rows={3}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e0e0e0', fontSize: '14px', resize: 'none', boxSizing: 'border-box' as const }}
                    />
                    <button
                      onClick={() => handleDirectCheckOut(exceptionReason)}
                      disabled={!exceptionReason.trim() || checkOutLoading}
                      style={{ ...styles.checkOutBtn, marginTop: '8px', opacity: !exceptionReason.trim() || checkOutLoading ? 0.6 : 1 }}
                    >
                      {checkOutLoading ? '퇴근 처리 중...' : '사유 입력 후 퇴근'}
                    </button>
                    <button onClick={() => setNeedsException(false)} style={styles.cancelBtn}>취소</button>
                  </>
                ) : (
                  <button
                    onClick={() => handleDirectCheckOut()}
                    disabled={checkOutLoading}
                    style={{ ...styles.checkOutBtn, opacity: checkOutLoading ? 0.6 : 1 }}
                  >
                    {checkOutLoading ? '퇴근 처리 중...' : '퇴근하기'}
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          <div>
            {/* 배정 현장 목록 + 출근 버튼 */}
            {!isPreview && availableSites.length > 0 ? (
              <div>
                <p style={{ fontSize: '14px', color: '#555', marginBottom: '12px' }}>배정된 현장을 선택하여 출근하세요.</p>
                {availableSites.map(site => (
                  <div key={site.siteId} style={{
                    border: `2px solid ${site.withinRadius ? '#2e7d32' : '#e0e0e0'}`,
                    borderRadius: '12px', padding: '14px', marginBottom: '10px',
                    background: site.withinRadius ? '#f1f8e9' : 'white',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: '#1a1a2e' }}>{site.siteName}</div>
                        <div style={{ fontSize: '12px', color: '#888' }}>{site.companyName}</div>
                      </div>
                      {site.distanceMeters !== null && (
                        <div style={{ textAlign: 'right' as const, flexShrink: 0, marginLeft: '8px' }}>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: site.withinRadius ? '#2e7d32' : '#666' }}>
                            {site.distanceMeters}m
                          </div>
                          <div style={{ fontSize: '11px', color: site.withinRadius ? '#388e3c' : '#999' }}>
                            {site.withinRadius ? '반경 내' : `허용 ${site.allowedRadiusMeters}m`}
                          </div>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDirectCheckIn(site.siteId)}
                      disabled={checkInLoading}
                      style={{ ...styles.checkInBtn, opacity: checkInLoading ? 0.6 : 1 }}
                    >
                      {checkInLoading ? '출근 처리 중...' : '출근하기'}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={styles.noRecord}>
                <p>오늘 출근 기록이 없습니다.</p>
                <p style={{ fontSize: '13px', color: '#888' }}>
                  {!isPreview && availableSites.length === 0
                    ? '배정된 현장이 없습니다. 관리자에게 문의하세요.'
                    : '아래 QR 스캔 또는 현장 선택으로 출근하세요.'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* QR 보조 수단 안내 */}
      <div style={styles.guideCard}>
        <div style={styles.guideTitle}>QR 스캔으로 출근</div>
        <div style={styles.guideStep}>현장에 부착된 QR코드를 스캔하면 자동으로 현장이 선택됩니다.</div>
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
  pending, result, countdown, onRespond, onForceSubmit, onDismiss,
}: {
  pending: PendingPresence | null
  result: PresenceResult
  countdown: string | null
  onRespond: () => void
  onForceSubmit: (coords: GpsCoords) => void
  onDismiss: () => void
}) {
  // ── 결과 화면들 ──
  if (result.state === 'completed') {
    return (
      <div style={pc.card}>
        <div style={pc.iconRow}>✅</div>
        <div style={{ ...pc.title, color: '#2e7d32' }}>현장 체류 확인 완료</div>
        <div style={pc.desc}>현장 기준 {Math.round(result.distanceMeters)}m · 허용 {result.allowedRadiusMeters}m</div>
        <button onClick={onDismiss} style={pc.secondaryBtn}>닫기</button>
      </div>
    )
  }

  if (result.state === 'review_required') {
    return (
      <div style={{ ...pc.card, borderColor: '#f57f17' }}>
        <div style={pc.iconRow}>🔍</div>
        <div style={{ ...pc.title, color: '#e65100' }}>검토 중</div>
        <div style={pc.desc}>
          현장 기준 {Math.round(result.distanceMeters)}m · 허용 {result.allowedRadiusMeters}m<br />
          GPS 정확도 또는 위치가 경계에 있어 관리자가 확인 중입니다.
        </div>
        <button onClick={onDismiss} style={pc.secondaryBtn}>닫기</button>
      </div>
    )
  }

  if (result.state === 'out_of_geofence') {
    return (
      <div style={{ ...pc.card, borderColor: '#e53935' }}>
        <div style={pc.iconRow}>📍</div>
        <div style={{ ...pc.title, color: '#c62828' }}>현장 반경 밖</div>
        <div style={pc.desc}>현장 기준 {Math.round(result.distanceMeters)}m · 허용 {result.allowedRadiusMeters}m</div>
        <div style={pc.warn}>현장에 있는 경우 관리자에게 문의하세요.</div>
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
        <div style={pc.iconRow}>🚫</div>
        <div style={{ ...pc.title, color: '#e65100' }}>위치 권한 거부됨</div>
        <div style={pc.desc}>
          브라우저 주소창 옆 자물쇠 아이콘을 눌러 위치 권한을 허용한 후 다시 시도해 주세요.
        </div>
        <button onClick={onDismiss} style={pc.secondaryBtn}>닫기</button>
      </div>
    )
  }

  if (result.state === 'gps_unavailable') {
    return (
      <div style={{ ...pc.card, borderColor: '#e65100' }}>
        <div style={pc.iconRow}>📡</div>
        <div style={{ ...pc.title, color: '#e65100' }}>현재 위치를 가져올 수 없음</div>
        <div style={pc.desc}>GPS 신호가 약합니다. 실외로 이동 후 다시 시도해 주세요.</div>
        <button onClick={onRespond} style={pc.primaryBtn}>다시 시도</button>
        <button onClick={onDismiss} style={pc.secondaryBtn}>닫기</button>
      </div>
    )
  }

  if (result.state === 'gps_timeout') {
    return (
      <div style={{ ...pc.card, borderColor: '#e65100' }}>
        <div style={pc.iconRow}>⏳</div>
        <div style={{ ...pc.title, color: '#e65100' }}>위치 조회 시간 초과</div>
        <div style={pc.desc}>GPS 응답이 너무 늦었습니다. 잠시 후 다시 시도해 주세요.</div>
        <button onClick={onRespond} style={pc.primaryBtn}>다시 시도</button>
        <button onClick={onDismiss} style={pc.secondaryBtn}>닫기</button>
      </div>
    )
  }

  if (result.state === 'network_error') {
    return (
      <div style={{ ...pc.card, borderColor: '#e53935' }}>
        <div style={pc.iconRow}>📶</div>
        <div style={{ ...pc.title, color: '#c62828' }}>네트워크 오류</div>
        <div style={pc.desc}>인터넷 연결을 확인하고 다시 시도해 주세요.</div>
        <button onClick={onRespond} style={pc.primaryBtn}>다시 시도</button>
        <button onClick={onDismiss} style={pc.secondaryBtn}>닫기</button>
      </div>
    )
  }

  if (result.state === 'low_accuracy_warning') {
    return (
      <div style={{ ...pc.card, borderColor: '#f57f17' }}>
        <div style={pc.iconRow}>📡</div>
        <div style={{ ...pc.title, color: '#e65100' }}>GPS 정확도 낮음</div>
        <div style={pc.desc}>
          현재 GPS 오차가 약 <strong>{result.accuracy}m</strong>입니다.<br />
          실내·지하 등 GPS 수신이 어려운 환경이면 실외로 이동 후 재시도하세요.
        </div>
        <button onClick={() => onForceSubmit(result.coords)} style={pc.primaryBtn}>그래도 응답하기</button>
        <button onClick={onRespond} style={{ ...pc.secondaryBtn, marginTop: '8px' }}>다시 측정하기</button>
        <button onClick={onDismiss} style={pc.secondaryBtn}>닫기</button>
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

  // ── PENDING 요청 화면 ──
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
  checkInBtn:    { width: '100%', padding: '12px', fontSize: '15px', fontWeight: 700, background: '#2e7d32', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer' },
  checkOutBtn:   { width: '100%', padding: '14px', fontSize: '17px', fontWeight: 700, background: '#1565c0', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer' },
  cancelBtn:     { width: '100%', padding: '10px', fontSize: '14px', background: 'none', border: '1px solid #e0e0e0', borderRadius: '8px', cursor: 'pointer', color: '#888', marginTop: '6px' },
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
