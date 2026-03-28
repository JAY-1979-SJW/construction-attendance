'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import WorkerDisclaimerBanner from '@/components/worker/WorkerDisclaimerBanner'
import WorkerBottomNav from '@/components/worker/WorkerBottomNav'
import WorkerTopBar from '@/components/worker/WorkerTopBar'

interface TodayStatus {
  id: string
  siteId: string
  currentSiteId: string
  currentSiteName: string
  siteName: string
  siteAddress: string
  workDate: string
  checkInAt: string | null
  checkOutAt: string | null
  status: 'WORKING' | 'COMPLETED' | 'EXCEPTION'
  checkInDistance: number | null
  checkOutDistance: number | null
  moveEvents: { siteId: string; siteName: string; movedAt: string }[]
}

interface WorkerInfo {
  name: string
  company: string
  jobTitle: string
  accountStatus?: string
  devices?: { id: string }[]
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
  // ── 출근 조건 검사 state ──────────────────────────────────────
  const [eligibility, setEligibility] = useState<{ key: string; label: string; passed: boolean; message: string }[]>([])
  const [eligibilityChecked, setEligibilityChecked] = useState(false)
  // ── 직접 출근 state ───────────────────────────────────────────
  const [availableSites, setAvailableSites] = useState<AvailableSite[]>([])
  const [checkInLoading, setCheckInLoading]   = useState(false)
  const [checkOutLoading, setCheckOutLoading] = useState(false)
  const [moveLoading, setMoveLoading]         = useState(false)
  const [showMovePanel, setShowMovePanel]     = useState(false)
  const [attendanceMsg, setAttendanceMsg]     = useState('')
  const [exceptionReason, setExceptionReason] = useState('')
  const [needsException, setNeedsException]   = useState(false)
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'loading' | 'ok' | 'denied' | 'error'>('idle')
  // ── 최근 기록 state ───────────────────────────────────────────
  const [history, setHistory] = useState<{
    workDate: string
    siteName: string
    checkInAt: string | null
    checkOutAt: string | null
    status: string
  }[]>([])

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
      // PENDING / REJECTED 사용자 → 승인대기 또는 로그인으로 이동
      if (meData.data.accountStatus === 'PENDING') {
        router.push('/register/pending')
        return
      }
      if (meData.data.accountStatus === 'REJECTED') {
        router.push('/login?error=inactive')
        return
      }
      setWorker(meData.data)
      setToday(todayData.data)
      setLoading(false)
      // 최근 7일 기록 조회
      fetch('/api/attendance/history?days=7')
        .then((r) => r.json())
        .then((d) => { if (d.success) setHistory(d.data.items) })
        .catch(() => {})
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

  // ── GPS 오류 메시지 헬퍼 ─────────────────────────────────────
  const getGpsErrorMsg = (err: unknown): string => {
    const code = (err as GeolocationPositionError)?.code
    if (code === 1) return '위치 권한이 거부되었습니다. 브라우저 설정에서 위치 권한을 허용해 주세요.'
    if (code === 2) return '현재 위치를 가져올 수 없습니다. 실외로 이동 후 다시 시도해 주세요.'
    if (code === 3) return '위치 조회 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.'
    return 'GPS 오류가 발생했습니다. 위치 권한을 확인해 주세요.'
  }

  // ── 배정 현장 목록 로딩 ───────────────────────────────────────
  const loadAvailableSites = useCallback(async () => {
    if (isPreview) return
    try {
      let url = '/api/attendance/available-sites'
      if (navigator.geolocation) {
        setGpsStatus('loading')
        try {
          const coords = await getGpsCoords()
          url += `?lat=${coords.latitude}&lng=${coords.longitude}`
          setGpsStatus('ok')
        } catch (err) {
          const code = (err as GeolocationPositionError)?.code
          setGpsStatus(code === 1 ? 'denied' : 'error')
        }
      }
      const res = await fetch(url)
      const data = await res.json()
      if (data.success) {
        setAvailableSites(data.sites ?? [])
        // 첫 번째 현장 기준으로 eligibility 검사
        const sites = data.sites ?? []
        if (sites.length > 0) {
          const qs = new URLSearchParams({ siteId: sites[0].siteId, deviceToken: localStorage.getItem('deviceToken') || '' })
          if (url.includes('lat=')) {
            const u = new URL(url, location.origin)
            if (u.searchParams.get('lat')) qs.set('lat', u.searchParams.get('lat')!)
            if (u.searchParams.get('lng')) qs.set('lng', u.searchParams.get('lng')!)
          }
          fetch(`/api/attendance/eligibility?${qs}`)
            .then(r => r.json())
            .then(d => { if (d.success) { setEligibility(d.conditions); setEligibilityChecked(true) } })
            .catch(() => {})
        }
      }
    } catch { /* ignore */ }
  }, [isPreview])

  useEffect(() => {
    if (!loading && !isPreview && (!today || today.status === 'WORKING')) {
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
      } catch (err) {
        setAttendanceMsg(getGpsErrorMsg(err))
        return
      }

      const deviceToken = localStorage.getItem('ca_device_token') ?? ''
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
      } catch (err) {
        setAttendanceMsg(getGpsErrorMsg(err))
        return
      }

      const deviceToken = localStorage.getItem('ca_device_token') ?? ''
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

  // ── 현장 이동 ─────────────────────────────────────────────────
  const handleSiteMove = async (targetSiteId: string) => {
    if (moveLoading) return
    setMoveLoading(true)
    setAttendanceMsg('')
    try {
      let coords: { latitude: number; longitude: number }
      try {
        coords = await getGpsCoords()
      } catch (err) {
        setAttendanceMsg(getGpsErrorMsg(err))
        return
      }

      const deviceToken = localStorage.getItem('ca_device_token') ?? ''
      const res = await fetch('/api/attendance/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetSiteId, ...coords, deviceToken }),
      })
      const data = await res.json()

      if (res.ok) {
        setAttendanceMsg(data.message ?? '현장 이동 완료')
        setShowMovePanel(false)
        const todayRes = await fetch('/api/attendance/today')
        const todayData = await todayRes.json()
        setToday(todayData.data)
        await loadAvailableSites()
      } else {
        setAttendanceMsg(data.message ?? '이동 처리 실패')
      }
    } finally {
      setMoveLoading(false)
    }
  }

  const formatTime = (iso: string | null) => {
    if (!iso) return '--:--'
    return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p>불러오는 중...</p>
      </div>
    )
  }

  return (
    <>
      <WorkerTopBar />
      <div className="mobile-content">
      {/* 법적 고지 배너 */}
      {!isPreview && <WorkerDisclaimerBanner />}

      {/* 미리보기 배너 */}
      {isPreview && (
        <div className="flex items-center justify-between bg-accent-light border border-accent-light rounded-[10px] px-[14px] py-[10px] mb-3 text-[13px] text-accent-hover gap-2">
          <span>👀 미리보기 모드 — 실제 사용하려면</span>
          <button onClick={() => router.push('/login')} className="px-[14px] py-[6px] bg-accent text-white border-none rounded-md cursor-pointer text-xs font-bold shrink-0">로그인하기</button>
        </div>
      )}

      {/* 헤더 */}
      <div className="flex justify-between items-center mb-6 pt-2">
        <div>
          <div className="text-lg font-bold text-title-brand">{worker?.name}</div>
          <div className="text-[13px] text-muted-brand mt-0.5">{worker?.company} · {worker?.jobTitle}</div>
        </div>
        <button
          onClick={() => isPreview ? router.push('/login') : fetch('/api/auth/logout', { method: 'POST' }).then(() => router.push('/login'))}
          className="bg-transparent border border-brand rounded-lg px-3 py-[6px] text-[13px] cursor-pointer text-muted-brand"
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

      {/* 출퇴근 메시지 — background/color depend on runtime string value, keep dynamic */}
      {attendanceMsg && (
        <div style={{
          background: attendanceMsg.includes('완료') ? 'rgba(22,163,74,0.08)' : 'rgba(234,88,12,0.08)',
          color: attendanceMsg.includes('완료') ? '#16a34a' : '#ea580c',
        }} className="rounded-[10px] px-4 py-3 mb-3 text-[14px] font-semibold">
          {attendanceMsg}
        </div>
      )}

      {/* ── 첫 진입 안내 (현장 미배정 / 기기 미등록) ── */}
      {!isPreview && !today && availableSites.length === 0 && (
        <div className="bg-card rounded-2xl p-5 mb-4 border border-accent-light">
          <div className="text-[15px] font-bold text-title-brand mb-3">시작하기</div>
          <div className="space-y-[10px]">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-green-light text-status-working text-[12px] font-bold flex items-center justify-center shrink-0">✓</span>
              <span className="text-[13px] text-muted-brand">계정 승인 완료</span>
            </div>
            {(!worker?.devices || worker.devices.length === 0) && (
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-accent-light text-accent text-[12px] font-bold flex items-center justify-center shrink-0">!</span>
                <span className="text-[13px] text-accent">기기 등록이 필요합니다</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-accent-light text-accent text-[12px] font-bold flex items-center justify-center shrink-0">!</span>
              <span className="text-[13px] text-accent">배정된 현장이 없습니다</span>
            </div>
          </div>
          <p className="text-[12px] text-muted-brand mt-3 mb-0">현장 관리자에게 현장 참여를 요청하세요.</p>
        </div>
      )}

      {/* 오늘 현황 + 직접 출퇴근 */}
      <div className="bg-card rounded-2xl p-6 mb-4">
        <div className="text-[13px] text-muted-brand mb-3">오늘의 출퇴근</div>
        {today ? (
          <>
            {/* STATUS_COLOR is a runtime lookup — keep background dynamic */}
            <div className="inline-block text-white text-[13px] font-bold py-1 px-3 rounded-[20px] mb-3" style={{ background: STATUS_COLOR[today.status] }}>
              {STATUS_LABEL[today.status]}
            </div>
            <div className="text-lg font-bold text-title-brand mb-1">
              {today.moveEvents?.length > 0 ? today.currentSiteName : today.siteName}
            </div>
            {today.moveEvents?.length > 0 && (
              <div className="text-xs text-muted-brand mb-1">
                출근: {today.siteName} → 현재: {today.currentSiteName}
              </div>
            )}
            <div className="text-[13px] text-muted-brand mb-5">{today.siteAddress}</div>
            <div className="flex items-center gap-3">
              <div className="flex-1 text-center">
                <div className="text-xs text-muted-brand mb-1">출근</div>
                <div className="text-2xl font-bold text-title-brand">{formatTime(today.checkInAt)}</div>
                {today.checkInDistance != null && <div className="text-[11px] text-muted2-brand mt-1">{Math.round(today.checkInDistance)}m</div>}
              </div>
              <div className="text-xl text-[#D1D5DB]">→</div>
              <div className="flex-1 text-center">
                <div className="text-xs text-muted-brand mb-1">퇴근</div>
                <div className="text-2xl font-bold text-title-brand">{formatTime(today.checkOutAt)}</div>
                {today.checkOutDistance != null && <div className="text-[11px] text-muted2-brand mt-1">{Math.round(today.checkOutDistance)}m</div>}
              </div>
            </div>

            {/* 근무중 바로가기 (TBM / 작업완료) */}
            {!isPreview && today.status === 'WORKING' && (
              <div className="mt-4 flex gap-2">
                <a href="/tbm" className="flex-1 py-2.5 rounded-xl text-center text-[13px] font-bold border border-blue-200 bg-blue-50 text-blue-700 no-underline">TBM 확인</a>
                <a href="/work-complete" className="flex-1 py-2.5 rounded-xl text-center text-[13px] font-bold border border-green-200 bg-green-50 text-green-700 no-underline">작업완료 보고</a>
                <a href="/daily-report" className="flex-1 py-2.5 rounded-xl text-center text-[13px] font-bold border border-gray-200 bg-gray-50 text-gray-700 no-underline">작업일보</a>
              </div>
            )}

            {/* 퇴근 버튼 + 현장 이동 버튼 (근무 중일 때) */}
            {!isPreview && today.status === 'WORKING' && (
              <div className="mt-5">
                {/* 현장 이동 패널 */}
                {showMovePanel ? (
                  <div>
                    <div className="text-sm font-semibold mb-[10px] text-secondary-brand">
                      이동할 현장을 선택하세요
                    </div>
                    {availableSites
                      .filter(s => s.siteId !== today.currentSiteId)
                      .map(site => (
                        <div
                          key={site.siteId}
                          className="rounded-[10px] p-3 mb-2"
                          style={{
                            border: `2px solid ${site.withinRadius ? '#1565c0' : '#E5E7EB'}`,
                            background: site.withinRadius ? 'rgba(21,101,192,0.08)' : '#FFFFFF',
                          }}
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <div className="text-sm font-bold text-title-brand">{site.siteName}</div>
                              <div className="text-[11px] text-muted-brand">{site.companyName}</div>
                            </div>
                            {site.distanceMeters !== null && (
                              <div
                                className="text-[12px] text-right"
                                style={{ color: site.withinRadius ? '#1565c0' : '#999' }}
                              >
                                {site.distanceMeters}m<br/>
                                <span className="text-[10px]">{site.withinRadius ? '반경 내' : `허용 ${site.allowedRadiusMeters}m`}</span>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => handleSiteMove(site.siteId)}
                            disabled={moveLoading}
                            className="mt-2 w-full py-[10px] text-white border-none rounded-lg text-[14px] font-semibold cursor-pointer"
                            style={{
                              background: site.withinRadius ? '#1565c0' : '#9e9e9e',
                              opacity: moveLoading ? 0.6 : 1,
                            }}
                          >
                            {moveLoading ? '이동 처리 중...' : '이 현장으로 이동'}
                          </button>
                        </div>
                      ))}
                    {availableSites.filter(s => s.siteId !== today.currentSiteId).length === 0 && (
                      <div className="text-[13px] text-muted-brand py-[10px]">
                        이동 가능한 다른 배정 현장이 없습니다.
                      </div>
                    )}
                    <button onClick={() => setShowMovePanel(false)} className="w-full py-[10px] text-sm bg-transparent border border-brand rounded-lg cursor-pointer text-muted-brand mt-[6px]">취소</button>
                  </div>
                ) : needsException ? (
                  <>
                    <textarea
                      placeholder="반경 밖 퇴근 사유를 입력하세요"
                      value={exceptionReason}
                      onChange={e => setExceptionReason(e.target.value)}
                      rows={3}
                      className="w-full px-[10px] py-[10px] rounded-lg border border-brand text-[14px] resize-none box-border"
                    />
                    <button
                      onClick={() => handleDirectCheckOut(exceptionReason)}
                      disabled={!exceptionReason.trim() || checkOutLoading}
                      className="w-full py-[14px] text-[17px] font-bold bg-brand-accent-hover text-white border-none rounded-xl cursor-pointer mt-2"
                      style={{ opacity: !exceptionReason.trim() || checkOutLoading ? 0.6 : 1 }}
                    >
                      {checkOutLoading ? '퇴근 처리 중...' : '사유 입력 후 퇴근'}
                    </button>
                    <button onClick={() => setNeedsException(false)} className="w-full py-[10px] text-sm bg-transparent border border-brand rounded-lg cursor-pointer text-muted-brand mt-[6px]">취소</button>
                  </>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDirectCheckOut()}
                      disabled={checkOutLoading}
                      className="w-full py-[14px] text-[17px] font-bold bg-brand-accent-hover text-white border-none rounded-xl cursor-pointer flex-1"
                      style={{ opacity: checkOutLoading ? 0.6 : 1 }}
                    >
                      {checkOutLoading ? '퇴근 처리 중...' : '퇴근하기'}
                    </button>
                    {availableSites.filter(s => s.siteId !== today.currentSiteId).length > 0 && (
                      <button
                        onClick={() => setShowMovePanel(true)}
                        className="py-[14px] px-4 bg-brand-accent-hover text-white border-none rounded-xl text-[14px] font-semibold cursor-pointer whitespace-nowrap"
                      >
                        현장 이동
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div>
            {/* 배정 현장 목록 + 출근 버튼 */}
            {/* GPS 상태 표시 */}
            {!isPreview && (
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs flex items-center gap-[6px]">
                  {gpsStatus === 'loading' && <><span className="text-secondary-brand">📡</span><span className="text-secondary-brand">위치 조회 중...</span></>}
                  {gpsStatus === 'ok' && <><span className="text-status-working">📍</span><span className="text-status-working">위치 확인됨</span></>}
                  {gpsStatus === 'denied' && <><span className="text-accent-hover">🚫</span><span className="text-accent-hover">위치 권한 거부됨</span></>}
                  {gpsStatus === 'error' && <><span className="text-accent-hover">⚠️</span><span className="text-accent-hover">위치 오류</span></>}
                  {gpsStatus === 'idle' && <><span className="text-muted2-brand">📍</span><span className="text-muted2-brand">위치 미확인</span></>}
                </div>
                <button
                  onClick={loadAvailableSites}
                  disabled={gpsStatus === 'loading' || checkInLoading}
                  className="text-xs px-[10px] py-1 bg-brand border border-brand rounded-md cursor-pointer text-muted-brand"
                >
                  새로고침
                </button>
              </div>
            )}
            {/* 출근 조건 체크리스트 */}
            {eligibilityChecked && eligibility.length > 0 && (
              <div className={`rounded-xl p-4 mb-3 border ${eligibility.every(c => c.passed) ? 'bg-green-light border-green' : 'bg-card border-brand'}`}>
                <div className="text-[13px] font-bold text-body-brand mb-3">
                  {eligibility.every(c => c.passed) ? '출근 준비 완료' : '출근 조건 확인'}
                </div>
                {eligibility.map(c => {
                  const ACTION_HINT: Record<string, string> = {
                    account: '관리자 승인을 기다려 주세요.',
                    device: '기기 등록 후 관리자 승인을 기다려 주세요.',
                    site: '하단 [현장] 탭에서 현장 참여를 신청하세요.',
                    docs: '하단 [서류] 탭에서 서류를 제출하세요.',
                    time: '출근 가능 시간에 다시 시도하세요.',
                    gps: '현장 근처로 이동하세요.',
                    duplicate: '',
                  }
                  return (
                    <div key={c.key} className="flex items-start gap-2 mb-2">
                      <span className={`text-[14px] mt-[1px] shrink-0 ${c.passed ? 'text-status-working' : 'text-status-missing'}`}>
                        {c.passed ? '✓' : '✕'}
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center gap-1">
                          <span className={`text-[12px] font-medium ${c.passed ? 'text-body-brand' : 'text-status-missing'}`}>{c.label}</span>
                          <span className={`text-[11px] ${c.passed ? 'text-muted-brand' : 'text-muted2-brand'}`}>— {c.message}</span>
                        </div>
                        {!c.passed && ACTION_HINT[c.key] && (
                          <div className="text-[11px] text-status-exception mt-0.5">{ACTION_HINT[c.key]}</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            {!isPreview && availableSites.length > 0 ? (
              <div>
                {/* 현장 1개: 즉시 출근 강조 */}
                {availableSites.length === 1 ? (
                  <div className="rounded-xl p-5" style={{ border: '2px solid #2e7d32', background: 'rgba(22,163,74,0.06)' }}>
                    <div className="text-[16px] font-bold text-title-brand mb-1">{availableSites[0].siteName}</div>
                    <div className="text-[12px] text-muted-brand mb-4">{availableSites[0].companyName}
                      {availableSites[0].distanceMeters !== null && (
                        <span className="ml-2" style={{ color: availableSites[0].withinRadius ? '#4caf50' : '#999' }}>
                          {availableSites[0].distanceMeters}m {availableSites[0].withinRadius ? '(반경 내)' : `(허용 ${availableSites[0].allowedRadiusMeters}m)`}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleDirectCheckIn(availableSites[0].siteId)}
                      disabled={checkInLoading || (eligibilityChecked && !eligibility.every(c => c.passed))}
                      className="w-full py-[14px] text-[16px] font-bold text-white border-none rounded-xl cursor-pointer"
                      style={{
                        background: eligibilityChecked && !eligibility.every(c => c.passed) ? '#9CA3AF' : '#2e7d32',
                        opacity: checkInLoading ? 0.6 : 1,
                        boxShadow: eligibilityChecked && !eligibility.every(c => c.passed) ? 'none' : '0 4px 12px rgba(46,125,50,0.3)',
                      }}
                    >
                      {checkInLoading ? '출근 처리 중...' : eligibilityChecked && !eligibility.every(c => c.passed) ? '조건 미충족' : '출근하기'}
                    </button>
                  </div>
                ) : (
                  /* 현장 여러 개: 선택 목록 */
                  <>
                    <p className="text-[13px] text-muted-brand mb-3">출근할 현장을 선택하세요</p>
                    {availableSites.map(site => (
                      <div key={site.siteId} className="rounded-xl p-[14px] mb-[10px]"
                        style={{ border: `2px solid ${site.withinRadius ? '#2e7d32' : '#E5E7EB'}`, background: site.withinRadius ? 'rgba(22,163,74,0.06)' : '#FFFFFF' }}>
                        <div className="flex justify-between items-center mb-2">
                          <div>
                            <div className="text-[15px] font-bold text-title-brand">{site.siteName}</div>
                            <div className="text-[11px] text-muted-brand">{site.companyName}</div>
                          </div>
                          {site.distanceMeters !== null && (
                            <div className="text-right shrink-0 ml-2">
                              <div className="text-[12px] font-bold" style={{ color: site.withinRadius ? '#2e7d32' : '#666' }}>{site.distanceMeters}m</div>
                              <div className="text-[10px]" style={{ color: site.withinRadius ? '#388e3c' : '#999' }}>{site.withinRadius ? '반경 내' : `허용 ${site.allowedRadiusMeters}m`}</div>
                            </div>
                          )}
                        </div>
                        <button onClick={() => handleDirectCheckIn(site.siteId)}
                          disabled={checkInLoading || (eligibilityChecked && !eligibility.every(c => c.passed))}
                          className="w-full py-[11px] text-[14px] font-bold text-white border-none rounded-[10px] cursor-pointer"
                          style={{
                            background: eligibilityChecked && !eligibility.every(c => c.passed) ? '#9CA3AF' : '#2e7d32',
                            opacity: checkInLoading ? 0.6 : 1,
                          }}>
                          {checkInLoading ? '처리 중...' : eligibilityChecked && !eligibility.every(c => c.passed) ? '조건 미충족' : '출근하기'}
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            ) : !isPreview ? (
              <div className="text-center py-5 text-muted-brand">
                <p className="text-[14px] mb-1">배정된 현장이 없습니다</p>
                <p className="text-[12px] text-muted-brand">관리자에게 현장 참여를 요청하세요.</p>
              </div>
            ) : (
              <div className="text-center py-5 text-muted-brand">
                <p>출근 가능한 현장이 없습니다.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 최근 내 기록 */}
      {!isPreview && history.length > 0 && (
        <div className="bg-card rounded-2xl p-5 mb-4">
          <div className="text-[13px] text-muted-brand mb-3">최근 내 기록</div>
          <div className="flex flex-col gap-[10px]">
            {history.map((item) => {
              const dateLabel = new Date(item.workDate + 'T00:00:00+09:00')
                .toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short' })
              const inTime  = item.checkInAt  ? new Date(item.checkInAt).toLocaleTimeString('ko-KR',  { hour: '2-digit', minute: '2-digit' }) : '--:--'
              const outTime = item.checkOutAt ? new Date(item.checkOutAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '--:--'
              const statusColor =
                item.status === 'COMPLETED' ? '#81c784' :
                item.status === 'EXCEPTION' ? '#FFB74D' :
                '#A0AEC0'
              const statusLabel =
                item.status === 'COMPLETED' ? '퇴근' :
                item.status === 'EXCEPTION' ? '예외' :
                item.status === 'WORKING'   ? '근무중' : item.status
              return (
                <div
                  key={item.workDate + item.siteName}
                  className="flex items-center justify-between"
                  style={{ borderBottom: '1px solid #F3F4F6', paddingBottom: 8 }}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-[13px] text-muted-brand w-[80px] shrink-0">{dateLabel}</div>
                    <div>
                      <div className="text-[14px] font-semibold text-title-brand leading-tight">{item.siteName}</div>
                      <div className="text-[12px] text-muted-brand mt-[2px]">{inTime} ~ {outTime}</div>
                    </div>
                  </div>
                  <div className="text-[12px] font-bold shrink-0" style={{ color: statusColor }}>{statusLabel}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!isPreview && <WorkerBottomNav />}
    </div>
    </>
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
      <div className="bg-card border-2 border-blue rounded-2xl p-6 mb-4">
        <div className="text-[40px] text-center mb-3">✅</div>
        <div className="text-lg font-bold mb-[6px] text-status-working">현장 체류 확인 완료</div>
        <div className="text-[13px] text-muted-brand leading-[1.7] mb-4">현장 기준 {Math.round(result.distanceMeters)}m · 허용 {result.allowedRadiusMeters}m</div>
        <button onClick={onDismiss} className="w-full py-3 text-sm bg-footer text-muted-brand border-none rounded-[10px] cursor-pointer mt-2">닫기</button>
      </div>
    )
  }

  if (result.state === 'review_required') {
    return (
      <div className="bg-card border-2 border-yellow rounded-2xl p-6 mb-4">
        <div className="text-[40px] text-center mb-3">🔍</div>
        <div className="text-lg font-bold mb-[6px] text-accent-hover">검토 중</div>
        <div className="text-[13px] text-muted-brand leading-[1.7] mb-4">
          현장 기준 {Math.round(result.distanceMeters)}m · 허용 {result.allowedRadiusMeters}m<br />
          GPS 정확도 또는 위치가 경계에 있어 관리자가 확인 중입니다.
        </div>
        <button onClick={onDismiss} className="w-full py-3 text-sm bg-footer text-muted-brand border-none rounded-[10px] cursor-pointer mt-2">닫기</button>
      </div>
    )
  }

  if (result.state === 'out_of_geofence') {
    return (
      <div className="bg-card border-2 border-red rounded-2xl p-6 mb-4">
        <div className="text-[40px] text-center mb-3">📍</div>
        <div className="text-lg font-bold mb-[6px] text-status-missing">현장 반경 밖</div>
        <div className="text-[13px] text-muted-brand leading-[1.7] mb-4">현장 기준 {Math.round(result.distanceMeters)}m · 허용 {result.allowedRadiusMeters}m</div>
        <div className="text-xs text-muted-brand mb-4 leading-[1.6]">현장에 있는 경우 관리자에게 문의하세요.</div>
        <button onClick={onDismiss} className="w-full py-3 text-sm bg-footer text-muted-brand border-none rounded-[10px] cursor-pointer mt-2">닫기</button>
      </div>
    )
  }

  if (result.state === 'expired') {
    return (
      <div className="bg-card border-2 border-brand-deeper rounded-2xl p-6 mb-4">
        <div className="text-[40px] text-center mb-3">⏱️</div>
        <div className="text-lg font-bold text-muted-brand mb-[6px]">응답 시간 종료</div>
        <div className="text-[13px] text-muted-brand leading-[1.7] mb-4">체류 확인 응답 가능 시간이 지났습니다.</div>
        <button onClick={onDismiss} className="w-full py-3 text-sm bg-footer text-muted-brand border-none rounded-[10px] cursor-pointer mt-2">닫기</button>
      </div>
    )
  }

  if (result.state === 'gps_denied') {
    return (
      <div className="bg-card border-2 border-accent rounded-2xl p-6 mb-4">
        <div className="text-[40px] text-center mb-3">🚫</div>
        <div className="text-lg font-bold mb-[6px] text-accent-hover">위치 권한 거부됨</div>
        <div className="text-[13px] text-muted-brand leading-[1.7] mb-4">
          브라우저 주소창 옆 자물쇠 아이콘을 눌러 위치 권한을 허용한 후 다시 시도해 주세요.
        </div>
        <button onClick={onDismiss} className="w-full py-3 text-sm bg-footer text-muted-brand border-none rounded-[10px] cursor-pointer mt-2">닫기</button>
      </div>
    )
  }

  if (result.state === 'gps_unavailable') {
    return (
      <div className="bg-card border-2 border-accent rounded-2xl p-6 mb-4">
        <div className="text-[40px] text-center mb-3">📡</div>
        <div className="text-lg font-bold mb-[6px] text-accent-hover">현재 위치를 가져올 수 없음</div>
        <div className="text-[13px] text-muted-brand leading-[1.7] mb-4">GPS 신호가 약합니다. 실외로 이동 후 다시 시도해 주세요.</div>
        <button onClick={onRespond} className="w-full py-4 text-[17px] font-bold bg-accent text-white border-none rounded-xl cursor-pointer">다시 시도</button>
        <button onClick={onDismiss} className="w-full py-3 text-sm bg-footer text-muted-brand border-none rounded-[10px] cursor-pointer mt-2">닫기</button>
      </div>
    )
  }

  if (result.state === 'gps_timeout') {
    return (
      <div className="bg-card border-2 border-accent rounded-2xl p-6 mb-4">
        <div className="text-[40px] text-center mb-3">⏳</div>
        <div className="text-lg font-bold mb-[6px] text-accent-hover">위치 조회 시간 초과</div>
        <div className="text-[13px] text-muted-brand leading-[1.7] mb-4">GPS 응답이 너무 늦었습니다. 잠시 후 다시 시도해 주세요.</div>
        <button onClick={onRespond} className="w-full py-4 text-[17px] font-bold bg-accent text-white border-none rounded-xl cursor-pointer">다시 시도</button>
        <button onClick={onDismiss} className="w-full py-3 text-sm bg-footer text-muted-brand border-none rounded-[10px] cursor-pointer mt-2">닫기</button>
      </div>
    )
  }

  if (result.state === 'network_error') {
    return (
      <div className="bg-card border-2 border-red rounded-2xl p-6 mb-4">
        <div className="text-[40px] text-center mb-3">📶</div>
        <div className="text-lg font-bold mb-[6px] text-status-missing">네트워크 오류</div>
        <div className="text-[13px] text-muted-brand leading-[1.7] mb-4">인터넷 연결을 확인하고 다시 시도해 주세요.</div>
        <button onClick={onRespond} className="w-full py-4 text-[17px] font-bold bg-accent text-white border-none rounded-xl cursor-pointer">다시 시도</button>
        <button onClick={onDismiss} className="w-full py-3 text-sm bg-footer text-muted-brand border-none rounded-[10px] cursor-pointer mt-2">닫기</button>
      </div>
    )
  }

  if (result.state === 'low_accuracy_warning') {
    return (
      <div className="bg-card border-2 border-yellow rounded-2xl p-6 mb-4">
        <div className="text-[40px] text-center mb-3">📡</div>
        <div className="text-lg font-bold mb-[6px] text-accent-hover">GPS 정확도 낮음</div>
        <div className="text-[13px] text-muted-brand leading-[1.7] mb-4">
          현재 GPS 오차가 약 <strong>{result.accuracy}m</strong>입니다.<br />
          실내·지하 등 GPS 수신이 어려운 환경이면 실외로 이동 후 재시도하세요.
        </div>
        <button onClick={() => onForceSubmit(result.coords)} className="w-full py-4 text-[17px] font-bold bg-accent text-white border-none rounded-xl cursor-pointer">그래도 응답하기</button>
        <button onClick={onRespond} className="w-full py-3 text-sm bg-footer text-muted-brand border-none rounded-[10px] cursor-pointer mt-2">다시 측정하기</button>
        <button onClick={onDismiss} className="w-full py-3 text-sm bg-footer text-muted-brand border-none rounded-[10px] cursor-pointer mt-2">닫기</button>
      </div>
    )
  }

  if (result.state === 'error') {
    return (
      <div className="bg-card border-2 border-red rounded-2xl p-6 mb-4">
        <div className="text-[40px] text-center mb-3">⚠️</div>
        <div className="text-lg font-bold mb-[6px] text-status-missing">오류 발생</div>
        <div className="text-[13px] text-muted-brand leading-[1.7] mb-4">{result.message}</div>
        <button onClick={onDismiss} className="w-full py-3 text-sm bg-footer text-muted-brand border-none rounded-[10px] cursor-pointer mt-2">닫기</button>
      </div>
    )
  }

  // ── PENDING 요청 화면 ──
  if (!pending) return null

  const isLoading = result.state === 'loading'
  return (
    <div className="bg-card border-2 border-blue rounded-2xl p-6 mb-4">
      <div className="inline-block bg-accent-light text-accent text-[11px] font-bold px-[10px] py-[3px] rounded-xl mb-[10px]">{pending.timeBucket === 'AM' ? '오전 체류 확인' : '오후 체류 확인'}</div>
      <div className="text-lg font-bold text-title-brand mb-[6px]">현장 체류 확인 요청</div>
      <div className="text-sm font-semibold text-secondary-brand mb-[10px]">{pending.siteName}</div>
      <div className="text-[13px] text-muted-brand leading-[1.7] mb-4">관리자가 현재 현장 체류 확인을 요청했습니다.<br />아래 버튼을 눌러 현재 위치로 응답해 주세요.</div>
      {/* countdown value is runtime — keep color dynamic */}
      {countdown && (
        <div
          className="text-[15px] font-bold mb-[14px]"
          style={{ color: countdown === '만료됨' ? '#888' : '#e65100' }}
        >
          ⏱ 마감까지 {countdown}
        </div>
      )}
      <button
        onClick={onRespond}
        disabled={isLoading}
        className="w-full py-4 text-[17px] font-bold bg-accent text-white border-none rounded-xl cursor-pointer"
        style={{ opacity: isLoading ? 0.6 : 1 }}
      >
        {isLoading ? '위치 확인 중...' : '현재 위치로 응답'}
      </button>
    </div>
  )
}
