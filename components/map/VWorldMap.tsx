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

/** script 태그를 동적으로 추가하고 로드 완료를 Promise로 반환 */
function loadScript(src: string, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) { resolve(); return }
    const s = document.createElement('script')
    s.id  = id
    s.src = src
    s.onload  = () => resolve()
    s.onerror = () => reject(new Error(`script load failed: ${src}`))
    document.head.appendChild(s)
  })
}

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
    let cancelled = false

    const buildMap = () => {
      if (cancelled || !containerRef.current) return
      containerRef.current.innerHTML = ''
      const id = mapIdRef.current
      containerRef.current.id = id

      try {
        window.vw.mapOptions = {
          basemap: 'GRAPHIC',
          zoom: 15,
          lon: numLng,
          lat: numLat,
          container: id,
        }
        const map = new window.vw.ol3.Map()

        // HTML Overlay 마커 (window.ol = OpenLayers, sopMapInit.js 로드 후 사용 가능)
        const el = document.createElement('div')
        el.style.cssText =
          'width:18px;height:18px;background:#F47920;border:3px solid #fff;' +
          'border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.4);transform:translate(-50%,-50%);'
        const overlay = new window.ol.Overlay({
          position: window.ol.proj.fromLonLat([numLng, numLat]),
          element: el,
        })
        map.addOverlay(overlay)
        if (!cancelled) setStatus('ready')
      } catch (e) {
        console.error('[VWorldMap] buildMap error:', e)
        if (!cancelled) setStatus('error')
      }
    }

    /** VWorld SDK 전체 초기화:
     *  1. vworldMapInit.js.do → window.vw 설정 객체만 로드
     *  2. ol.js (OpenLayers) → window.ol 정의
     *  3. sopMapInit.js.do  → window.vw.ol3.Map 정의
     */
    const initSDK = async () => {
      try {
        const domain = DOMAIN ?? (typeof window !== 'undefined' ? window.location.hostname : 'localhost')
        const initSrc = `https://map.vworld.kr/js/vworldMapInit.js.do?version=2.0&apiKey=${API_KEY}&domain=${encodeURIComponent(domain)}`

        // 1단계: 설정 스크립트 로드
        await loadScript(initSrc, 'vworld-init')

        // 2단계: window.vw.ol3.ExtUrls / MapUrls 에서 실제 SDK URL 추출
        const extUrls = window.vw?.ol3?.ExtUrls
        const mapUrls = window.vw?.ol3?.MapUrls
        if (!extUrls || !mapUrls) throw new Error('VWorld ExtUrls/MapUrls 없음')

        // 3단계: OpenLayers + Map SDK 병렬 로드 (순서 중요: ol → sopMapInit)
        await loadScript(extUrls.openlayers, 'vworld-ol')
        await loadScript(mapUrls.earth,      'vworld-map-sdk')

        if (cancelled) return
        buildMap()
      } catch (e) {
        console.error('[VWorldMap] SDK init error:', e)
        if (!cancelled) setStatus('error')
      }
    }

    // 이미 완전히 로드된 경우 바로 초기화
    if (window.vw?.ol3?.Map && window.ol) {
      buildMap()
    } else {
      initSDK()
    }

    return () => { cancelled = true }
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
