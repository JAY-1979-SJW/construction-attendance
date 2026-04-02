'use client'

import { useState, useEffect, useCallback } from 'react'

/**
 * PWA 설치 프롬프트 + iOS Safari 홈 화면 추가 안내
 *
 * Android Chrome: beforeinstallprompt 이벤트로 설치 유도
 * iOS Safari: 수동 "공유 → 홈 화면에 추가" 안내 배너
 * 이미 설치된 경우(standalone): 표시 안 함
 * 한 번 닫으면 24시간 비표시
 */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIosGuide, setShowIosGuide] = useState(false)
  const [dismissed, setDismissed] = useState(true) // 기본: 숨김

  useEffect(() => {
    // 이미 standalone으로 실행 중이면 표시 안 함
    if (window.matchMedia('(display-mode: standalone)').matches) return
    if ((navigator as unknown as { standalone?: boolean }).standalone) return

    // 24시간 내 닫았으면 표시 안 함
    const lastDismissed = localStorage.getItem('pwa_dismiss_ts')
    if (lastDismissed && Date.now() - parseInt(lastDismissed) < 86_400_000) return

    setDismissed(false)

    // Android Chrome: beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // iOS Safari 감지
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const isSafari = /safari/i.test(navigator.userAgent) && !/chrome|crios|fxios/i.test(navigator.userAgent)
    if (isIos && isSafari) {
      setShowIosGuide(true)
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setDeferredPrompt(null)
      setDismissed(true)
    }
  }, [deferredPrompt])

  const handleDismiss = () => {
    setDismissed(true)
    localStorage.setItem('pwa_dismiss_ts', String(Date.now()))
  }

  if (dismissed) return null
  if (!deferredPrompt && !showIosGuide) return null

  // Android: 설치 버튼
  if (deferredPrompt) {
    return (
      <div className="fixed bottom-[72px] left-0 right-0 z-[90] px-4 pb-2 safe-bottom">
        <div className="max-w-[480px] mx-auto bg-white rounded-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.15)] p-4 border border-brand">
          <div className="flex items-start gap-3">
            <img src="/icons/icon-72x72.png" alt="" className="w-12 h-12 rounded-xl shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-bold text-title-brand">홈 화면에 추가</div>
              <div className="text-[12px] text-muted-brand mt-0.5">앱처럼 바로 실행할 수 있습니다</div>
            </div>
            <button onClick={handleDismiss} className="text-[18px] text-muted-brand bg-transparent border-none cursor-pointer p-1 shrink-0">×</button>
          </div>
          <button
            onClick={handleInstall}
            className="w-full mt-3 h-11 text-sm font-bold text-white bg-[#F47920] border-none rounded-xl cursor-pointer"
            style={{ boxShadow: '0 4px 12px rgba(244,121,32,0.3)' }}
          >
            설치하기
          </button>
        </div>
      </div>
    )
  }

  // iOS Safari: 수동 안내
  if (showIosGuide) {
    return (
      <div className="fixed bottom-[72px] left-0 right-0 z-[90] px-4 pb-2 safe-bottom">
        <div className="max-w-[480px] mx-auto bg-white rounded-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.15)] p-4 border border-brand">
          <div className="flex items-start gap-3">
            <img src="/icons/icon-72x72.png" alt="" className="w-12 h-12 rounded-xl shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-bold text-title-brand">홈 화면에 추가</div>
              <div className="text-[12px] text-muted-brand mt-0.5">앱처럼 바로 실행할 수 있습니다</div>
            </div>
            <button onClick={handleDismiss} className="text-[18px] text-muted-brand bg-transparent border-none cursor-pointer p-1 shrink-0">×</button>
          </div>
          <div className="mt-3 bg-[#F5F7FA] rounded-xl p-3">
            <div className="flex items-center gap-2 text-[13px] text-body-brand">
              <span className="text-[18px]">1.</span>
              <span>하단의 <strong className="inline-flex items-center gap-1"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg> 공유</strong> 버튼 탭</span>
            </div>
            <div className="flex items-center gap-2 text-[13px] text-body-brand mt-2">
              <span className="text-[18px]">2.</span>
              <span><strong>"홈 화면에 추가"</strong> 선택</span>
            </div>
            <div className="flex items-center gap-2 text-[13px] text-body-brand mt-2">
              <span className="text-[18px]">3.</span>
              <span><strong>"추가"</strong> 탭하면 완료</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}
