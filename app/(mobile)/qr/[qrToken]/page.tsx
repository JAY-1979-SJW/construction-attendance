'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import WorkerTopBar from '@/components/worker/WorkerTopBar'
import WorkerBottomNav from '@/components/worker/WorkerBottomNav'

type Stage = 'loading' | 'not_logged_in' | 'site_invalid' | 'ready' | 'gps_loading' | 'gps_denied' | 'gps_error' | 'submitting' | 'success' | 'error'

interface SiteInfo {
  id: string
  name: string
  address: string
}

export default function QrCheckInPage() {
  const { qrToken } = useParams<{ qrToken: string }>()
  const router = useRouter()
  const [stage, setStage] = useState<Stage>('loading')
  const [site, setSite] = useState<SiteInfo | null>(null)
  const [message, setMessage] = useState('')
  const [distance, setDistance] = useState<number | null>(null)
  const [withinRadius, setWithinRadius] = useState<boolean | null>(null)
  const submittingRef = useRef(false)

  // 초기: 세션 확인 + 현장 정보 조회
  useEffect(() => {
    (async () => {
      // 세션 확인
      const meRes = await fetch('/api/auth/me')
      const meData = await meRes.json()
      if (!meData.success) {
        setStage('not_logged_in')
        return
      }
      if (meData.data.accountStatus === 'PENDING') {
        router.push('/register/pending')
        return
      }
      if (meData.data.accountStatus === 'REJECTED') {
        router.push('/login?error=inactive')
        return
      }

      // QR 토큰으로 현장 조회
      const siteRes = await fetch(`/api/public/sites/by-qr?token=${encodeURIComponent(qrToken)}`)
      const siteData = await siteRes.json()
      if (!siteData.success || !siteData.data) {
        setStage('site_invalid')
        return
      }
      setSite(siteData.data)
      setStage('ready')
    })().catch(() => setStage('site_invalid'))
  }, [qrToken, router])

  // QR 출근 실행
  const handleCheckIn = async () => {
    if (submittingRef.current) return
    submittingRef.current = true
    setStage('gps_loading')
    setMessage('')

    // GPS
    let coords: { latitude: number; longitude: number }
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true, timeout: 12000,
        })
      )
      coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude }
    } catch (err) {
      submittingRef.current = false
      const code = (err as GeolocationPositionError)?.code
      if (code === 1) { setStage('gps_denied'); return }
      setStage('gps_error')
      return
    }

    // API 호출
    setStage('submitting')
    const deviceToken = localStorage.getItem('ca_device_token') ?? ''
    try {
      const res = await fetch('/api/attendance/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrToken, ...coords, deviceToken }),
      })
      const data = await res.json()

      if (res.ok) {
        setDistance(data.data?.distance ?? null)
        setWithinRadius(data.data?.withinRadius ?? null)
        setMessage(data.message ?? '출근 완료')
        setStage('success')
      } else {
        setMessage(data.message ?? '출근 실패')
        setStage('error')
      }
    } catch {
      setMessage('네트워크 오류가 발생했습니다.')
      setStage('error')
    } finally {
      submittingRef.current = false
    }
  }

  // 로딩
  if (stage === 'loading') {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-[15px] text-[#6B7280]">확인 중...</p>
      </div>
    )
  }

  // 미로그인
  if (stage === 'not_logged_in') {
    return (
      <>
        <WorkerTopBar />
        <div className="mobile-content">
          <div className="bg-card rounded-2xl p-6 text-center">
            <div className="text-[48px] mb-4">📋</div>
            <div className="text-[17px] font-bold text-[#0F172A] mb-2">QR 출근</div>
            <p className="text-[14px] text-[#6B7280] mb-5">출근을 위해 먼저 로그인이 필요합니다.</p>
            <button
              onClick={() => router.push(`/login?redirect=${encodeURIComponent(`/qr/${qrToken}`)}`)}
              className="w-full py-3 bg-accent text-white border-none rounded-xl text-[15px] font-bold cursor-pointer"
            >
              로그인하기
            </button>
            <button
              onClick={() => router.push(`/register?redirect=${encodeURIComponent(`/qr/${qrToken}`)}`)}
              className="w-full py-3 mt-2 bg-transparent border border-[#E5E7EB] text-[#6B7280] rounded-xl text-[14px] cursor-pointer"
            >
              회원가입
            </button>
          </div>
        </div>
        <WorkerBottomNav />
      </>
    )
  }

  // 잘못된 QR
  if (stage === 'site_invalid') {
    return (
      <>
        <WorkerTopBar />
        <div className="mobile-content">
          <div className="bg-card rounded-2xl p-6 text-center">
            <div className="text-[48px] mb-4">⚠️</div>
            <div className="text-[17px] font-bold text-[#0F172A] mb-2">유효하지 않은 QR 코드</div>
            <p className="text-[14px] text-[#6B7280] mb-5">이 QR 코드는 등록된 현장과 일치하지 않습니다.</p>
            <button
              onClick={() => router.push('/attendance')}
              className="w-full py-3 bg-accent text-white border-none rounded-xl text-[15px] font-bold cursor-pointer"
            >
              출퇴근 페이지로 이동
            </button>
          </div>
        </div>
        <WorkerBottomNav />
      </>
    )
  }

  return (
    <>
      <WorkerTopBar />
      <div className="mobile-content">
        {/* 현장 정보 카드 */}
        <div className="bg-card rounded-2xl p-6 mb-4">
          <div className="text-[13px] text-muted-brand mb-2">QR 출근</div>
          <div className="text-[18px] font-bold text-[#0F172A] mb-1">{site?.name}</div>
          <div className="text-[13px] text-[#6B7280]">{site?.address}</div>
        </div>

        {/* 메시지 */}
        {message && (
          <div style={{
            background: stage === 'success' ? 'rgba(22,163,74,0.08)' : 'rgba(234,88,12,0.08)',
            color: stage === 'success' ? '#16a34a' : '#ea580c',
          }} className="rounded-[10px] px-4 py-3 mb-4 text-[14px] font-semibold">
            {message}
          </div>
        )}

        {/* 성공 */}
        {stage === 'success' && (
          <div className="bg-card rounded-2xl p-6 text-center mb-4">
            <div className="text-[48px] mb-3">✅</div>
            <div className="text-[17px] font-bold text-[#16a34a] mb-2">출근 완료</div>
            {distance != null && (
              <div className="text-[13px] text-[#6B7280]">
                현장까지 거리: {Math.round(distance)}m {withinRadius ? '(반경 내)' : '(반경 외)'}
              </div>
            )}
            <button
              onClick={() => router.push('/attendance')}
              className="w-full py-3 mt-4 bg-accent text-white border-none rounded-xl text-[15px] font-bold cursor-pointer"
            >
              출퇴근 현황 보기
            </button>
          </div>
        )}

        {/* GPS 거부 */}
        {stage === 'gps_denied' && (
          <div className="bg-card rounded-2xl p-6 text-center mb-4">
            <div className="text-[48px] mb-3">📍</div>
            <div className="text-[15px] font-bold text-[#ea580c] mb-2">위치 권한이 필요합니다</div>
            <p className="text-[13px] text-[#6B7280] mb-4">브라우저 설정에서 위치 권한을 허용한 후 다시 시도해 주세요.</p>
            <button
              onClick={() => { setStage('ready'); setMessage('') }}
              className="w-full py-3 bg-accent text-white border-none rounded-xl text-[15px] font-bold cursor-pointer"
            >
              다시 시도
            </button>
          </div>
        )}

        {/* GPS 오류 */}
        {stage === 'gps_error' && (
          <div className="bg-card rounded-2xl p-6 text-center mb-4">
            <div className="text-[15px] font-bold text-[#ea580c] mb-2">위치를 가져올 수 없습니다</div>
            <p className="text-[13px] text-[#6B7280] mb-4">실외로 이동한 후 다시 시도해 주세요.</p>
            <button
              onClick={() => { setStage('ready'); setMessage('') }}
              className="w-full py-3 bg-accent text-white border-none rounded-xl text-[15px] font-bold cursor-pointer"
            >
              다시 시도
            </button>
          </div>
        )}

        {/* 출근 버튼 */}
        {(stage === 'ready' || stage === 'error') && (
          <button
            onClick={handleCheckIn}
            className="w-full py-4 bg-[#16a34a] text-white border-none rounded-2xl text-[17px] font-bold cursor-pointer mb-4"
          >
            QR 출근하기
          </button>
        )}

        {/* GPS/제출 중 */}
        {(stage === 'gps_loading' || stage === 'submitting') && (
          <div className="w-full py-4 bg-[#d1d5db] text-white text-center rounded-2xl text-[17px] font-bold mb-4">
            {stage === 'gps_loading' ? '위치 확인 중...' : '출근 처리 중...'}
          </div>
        )}

        {/* 직접 출근 페이지 링크 */}
        <div className="text-center">
          <button
            onClick={() => router.push('/attendance')}
            className="bg-transparent border-none text-[13px] text-[#6B7280] cursor-pointer underline"
          >
            직접 출퇴근 페이지로 이동
          </button>
        </div>
      </div>
      <WorkerBottomNav />
    </>
  )
}
