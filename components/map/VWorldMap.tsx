'use client'

import { useEffect, useRef, useState } from 'react'

interface VWorldMapProps {
  lat?: number | string | null
  lng?: number | string | null
  height?: string
}

/**
 * VWorld 2D 타일 + Leaflet.js 기반 지도 컴포넌트
 * - VWorld JS SDK 도메인 등록 불필요
 * - 타일 URL: https://xdworld.vworld.kr/2d/Base/202002/{z}/{x}/{y}.png
 */
export default function VWorldMap({ lat, lng, height = '280px' }: VWorldMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<unknown>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')

  const numLat = lat != null ? parseFloat(String(lat)) : NaN
  const numLng = lng != null ? parseFloat(String(lng)) : NaN
  const hasCoords = !isNaN(numLat) && !isNaN(numLng) && numLat !== 0 && numLng !== 0

  useEffect(() => {
    if (!hasCoords || !containerRef.current) { setStatus('idle'); return }

    setStatus('loading')
    let cancelled = false

    const initMap = async () => {
      try {
        // Leaflet을 동적으로 import (SSR 방지)
        const L = (await import('leaflet')).default

        // Leaflet CSS 동적 로드
        if (!document.getElementById('leaflet-css')) {
          const link = document.createElement('link')
          link.id   = 'leaflet-css'
          link.rel  = 'stylesheet'
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
          document.head.appendChild(link)
        }

        if (cancelled || !containerRef.current) return

        // 기존 맵 인스턴스 제거
        if (mapRef.current) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(mapRef.current as any).remove()
          mapRef.current = null
        }
        containerRef.current.innerHTML = ''

        // Leaflet 맵 초기화
        const map = L.map(containerRef.current, {
          center: [numLat, numLng],
          zoom: 15,
          zoomControl: true,
          attributionControl: true,
        })
        mapRef.current = map

        // VWorld 2D 기본 타일 레이어
        L.tileLayer(
          'https://xdworld.vworld.kr/2d/Base/202002/{z}/{x}/{y}.png',
          {
            attribution: '© VWorld',
            maxZoom: 19,
            tileSize: 256,
          }
        ).addTo(map)

        // 마커
        const icon = L.divIcon({
          html: '<div style="width:16px;height:16px;background:#F47920;border:3px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.4);margin:-8px 0 0 -8px;"></div>',
          className: '',
          iconSize: [0, 0],
        })
        L.marker([numLat, numLng], { icon }).addTo(map)

        if (!cancelled) setStatus('ready')
      } catch (e) {
        console.error('[VWorldMap] Leaflet init error:', e)
        if (!cancelled) setStatus('error')
      }
    }

    initMap()

    return () => {
      cancelled = true
      if (mapRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(mapRef.current as any).remove()
        mapRef.current = null
      }
    }
  }, [numLat, numLng, hasCoords])

  if (!hasCoords) {
    return (
      <div style={{ height }}
        className="flex items-center justify-center rounded-lg border border-brand bg-surface text-muted2-brand text-sm">
        위치 정보 없음
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', height }}>
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-surface text-muted2-brand text-sm z-10">
          지도 불러오는 중...
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-surface text-status-rejected text-sm z-10">
          지도 로드 실패
        </div>
      )}
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%' }}
        className="rounded-lg border border-brand overflow-hidden"
      />
    </div>
  )
}
