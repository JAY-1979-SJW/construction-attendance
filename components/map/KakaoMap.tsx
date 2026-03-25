'use client'

import { useEffect, useRef, useState } from 'react'

interface KakaoMapProps {
  lat?: number | string | null
  lng?: number | string | null
  markerTitle?: string
  height?: string
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    kakao: any
  }
}

const JS_KEY = process.env.NEXT_PUBLIC_KAKAO_MAP_JS_KEY

export default function KakaoMap({ lat, lng, markerTitle, height = '280px' }: KakaoMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')

  const numLat = lat != null ? parseFloat(String(lat)) : NaN
  const numLng = lng != null ? parseFloat(String(lng)) : NaN
  const hasCoords = !isNaN(numLat) && !isNaN(numLng) && numLat !== 0 && numLng !== 0

  useEffect(() => {
    if (!hasCoords) { setStatus('idle'); return }
    if (!JS_KEY) { setStatus('error'); return }

    setStatus('loading')

    const buildMap = () => {
      if (!containerRef.current) return
      // 이전 지도 내용 초기화
      containerRef.current.innerHTML = ''
      try {
        window.kakao.maps.load(() => {
          if (!containerRef.current) return
          const latlng = new window.kakao.maps.LatLng(numLat, numLng)
          const map = new window.kakao.maps.Map(containerRef.current, {
            center: latlng,
            level: 4,
          })
          new window.kakao.maps.Marker({
            position: latlng,
            title: markerTitle ?? '',
          }).setMap(map)
          setStatus('ready')
        })
      } catch {
        setStatus('error')
      }
    }

    // SDK 이미 로드된 경우 바로 초기화
    if (window.kakao?.maps) {
      buildMap()
      return
    }

    // 스크립트 태그가 이미 삽입된 경우 (로드 대기)
    const scriptId = 'kakao-maps-sdk'
    if (document.getElementById(scriptId)) {
      const poll = setInterval(() => {
        if (window.kakao?.maps) { clearInterval(poll); buildMap() }
      }, 100)
      return () => clearInterval(poll)
    }

    // 최초 로드
    const script = document.createElement('script')
    script.id = scriptId
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${JS_KEY}&autoload=false`
    script.onload = buildMap
    script.onerror = () => setStatus('error')
    document.head.appendChild(script)
  }, [numLat, numLng, markerTitle, hasCoords])

  if (!JS_KEY) {
    return (
      <div style={{ height }}
        className="flex items-center justify-center rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-yellow-600 text-sm">
        카카오맵 키 설정 필요 (NEXT_PUBLIC_KAKAO_MAP_JS_KEY)
      </div>
    )
  }

  if (!hasCoords) {
    return (
      <div style={{ height }}
        className="flex items-center justify-center rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-[#9CA3AF] text-sm">
        위치 정보 없음
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', height }}>
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-[#F9FAFB] text-[#9CA3AF] text-sm z-10">
          지도 불러오는 중...
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-[#F9FAFB] text-[#dc2626] text-sm z-10">
          지도 로드 실패
        </div>
      )}
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%' }}
        className="rounded-lg border border-[#E5E7EB] overflow-hidden"
      />
    </div>
  )
}
