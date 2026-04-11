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
        // sopMapInit.js.do 로드 후 window.vw.Map 에 2D Map 생성자가 정의됨
        window.vw.mapOptions = {
          basemap: 'GRAPHIC',
          zoom: 15,
          lon: numLng,
          lat: numLat,
          container: id,
        }
        new window.vw.Map()

        // 마커: 지도 중앙(= 설정된 좌표)에 CSS 절대위치로 표시
        // addOverlay API 미지원 → 컨테이너 div에 직접 추가
        const container = document.getElementById(id)
        if (container) {
          container.style.position = 'relative'
          const marker = document.createElement('div')
          marker.style.cssText =
            'position:absolute;top:50%;left:50%;width:18px;height:18px;' +
            'background:#F47920;border:3px solid #fff;border-radius:50%;' +
            'box-shadow:0 1px 4px rgba(0,0,0,.4);transform:translate(-50%,-50%);' +
            'z-index:100;pointer-events:none;'
          container.appendChild(marker)
        }
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

        // 3단계: Map SDK 로드 (sopMapInit.js.do → window.vw.Map 정의)
        await loadScript(mapUrls.earth, 'vworld-map-sdk')

        if (cancelled) return
        buildMap()
      } catch (e) {
        console.error('[VWorldMap] SDK init error:', e)
        if (!cancelled) setStatus('error')
      }
    }

    // 이미 완전히 로드된 경우 바로 초기화
    if (typeof window.vw?.Map === 'function') {
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
