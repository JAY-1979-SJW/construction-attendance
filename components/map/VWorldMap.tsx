'use client'

import { useEffect, useRef, useState } from 'react'

const API_KEY = process.env.NEXT_PUBLIC_VWORLD_API_KEY
const DOMAIN  = process.env.NEXT_PUBLIC_VWORLD_DOMAIN

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vw: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ol: any
  }
}

interface VWorldMapProps {
  lat?: number | string | null
  lng?: number | string | null
  height?: string
}

let _mapSeq = 0

export default function VWorldMap({ lat, lng, height = '280px' }: VWorldMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapIdRef     = useRef(`vw-map-${++_mapSeq}`)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')

  const numLat = lat != null ? parseFloat(String(lat)) : NaN
  const numLng = lng != null ? parseFloat(String(lng)) : NaN
  const hasCoords = !isNaN(numLat) && !isNaN(numLng) && numLat !== 0 && numLng !== 0

  useEffect(() => {
    if (!hasCoords) { setStatus('idle'); return }
    if (!API_KEY)   { setStatus('error'); return }

    setStatus('loading')

    const buildMap = () => {
      if (!containerRef.current) return
      containerRef.current.innerHTML = ''
      const id = mapIdRef.current
      containerRef.current.id = id

      try {
        const opts = {
          basemap: 'GRAPHIC',
          zoom: 15,
          lon: numLng,
          lat: numLat,
          container: id,
        }
        window.vw.mapOptions = opts
        const map = new window.vw.ol3.Map(opts)

        // HTML Overlay 마커
        const el = document.createElement('div')
        el.style.cssText =
          'width:18px;height:18px;background:#F47920;border:3px solid #fff;' +
          'border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.4);transform:translate(-50%,-50%);'
        const overlay = new window.ol.Overlay({
          position: window.ol.proj.fromLonLat([numLng, numLat]),
          element: el,
        })
        map.addOverlay(overlay)
        setStatus('ready')
      } catch {
        setStatus('error')
      }
    }

    // 이미 로드된 경우 바로 초기화
    if (window.vw?.ol3) { buildMap(); return }

    // 스크립트 태그는 있지만 아직 로드 중인 경우
    const scriptId = 'vworld-map-sdk'
    if (document.getElementById(scriptId)) {
      const poll = setInterval(() => {
        if (window.vw?.ol3) { clearInterval(poll); buildMap() }
      }, 100)
      return () => clearInterval(poll)
    }

    // 최초 로드
    const domain = DOMAIN ?? (typeof window !== 'undefined' ? window.location.hostname : 'localhost')
    const script = document.createElement('script')
    script.id  = scriptId
    script.src = `https://map.vworld.kr/js/vworldMapInit.js.do?version=2.0&apiKey=${API_KEY}&domain=${encodeURIComponent(domain)}`
    script.onload  = buildMap
    script.onerror = () => setStatus('error')
    document.head.appendChild(script)
  }, [numLat, numLng, hasCoords])

  if (!API_KEY) {
    return (
      <div style={{ height }}
        className="flex items-center justify-center rounded-lg border border-brand bg-surface text-yellow-600 text-sm">
        VWorld API 키 설정 필요 (NEXT_PUBLIC_VWORLD_API_KEY)
      </div>
    )
  }

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
