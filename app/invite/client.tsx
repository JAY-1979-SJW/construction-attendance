'use client'

import { useState, useEffect, useCallback } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InvitePageClient() {
  const [isStandalone, setIsStandalone] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [isAndroid, setIsAndroid] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true
    setIsStandalone(standalone)

    const ua = navigator.userAgent
    setIsIos(/iphone|ipad|ipod/i.test(ua))
    setIsAndroid(/android/i.test(ua))

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setInstalled(true)
      setDeferredPrompt(null)
    }
  }, [deferredPrompt])

  // 이미 설치된 상태로 진입
  if (isStandalone) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex flex-col items-center justify-center px-6">
        <img src="/icons/icon-192x192.png" alt="" className="w-20 h-20 rounded-2xl mb-4" />
        <h1 className="text-[22px] font-bold text-[#111827] mb-2">설치 완료</h1>
        <p className="text-[14px] text-[#6B7280] mb-6 text-center">앱이 이미 설치되어 있습니다.</p>
        <a
          href="/attendance"
          className="w-full max-w-[320px] py-4 text-[16px] font-bold text-white bg-[#F47920] rounded-2xl text-center no-underline block"
          style={{ boxShadow: '0 4px 12px rgba(244,121,32,0.3)' }}
        >
          출퇴근 시작하기
        </a>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      {/* 헤더 */}
      <div className="bg-white pt-12 pb-8 px-6 text-center border-b border-[#E5E7EB]">
        <img src="/icons/icon-192x192.png" alt="" className="w-20 h-20 rounded-2xl mx-auto mb-4" />
        <h1 className="text-[24px] font-bold text-[#111827] mb-1">해한 현장 출퇴근</h1>
        <p className="text-[14px] text-[#6B7280]">앱 설치 없이 바로 사용하세요</p>
      </div>

      <div className="max-w-[480px] mx-auto px-6 py-6">
        {/* 기능 소개 카드 */}
        <div className="bg-white rounded-2xl p-5 mb-4 border border-[#E5E7EB]">
          <div className="text-[13px] font-bold text-[#6B7280] uppercase tracking-wider mb-4">주요 기능</div>
          <div className="flex flex-col gap-4">
            {[
              { icon: '📍', title: 'GPS 출퇴근', desc: '현장 도착 시 버튼 하나로 출근' },
              { icon: '📋', title: '서류 관리', desc: '안전교육, 계약서 모바일 확인' },
              { icon: '🔔', title: '체류 확인', desc: '현장 재실 확인 자동 알림' },
              { icon: '📊', title: '근무 기록', desc: '출퇴근 이력 및 공수 조회' },
            ].map(f => (
              <div key={f.title} className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-[#FFF7ED] flex items-center justify-center text-[20px] shrink-0">{f.icon}</span>
                <div>
                  <div className="text-[14px] font-bold text-[#111827]">{f.title}</div>
                  <div className="text-[12px] text-[#6B7280]">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 설치 안내 */}
        <div className="bg-white rounded-2xl p-5 mb-4 border border-[#F47920] border-opacity-40">
          <div className="text-[15px] font-bold text-[#111827] mb-3">
            {installed ? '설치 완료!' : '홈 화면에 추가하기'}
          </div>

          {installed ? (
            <div className="text-center py-4">
              <div className="text-[40px] mb-2">✅</div>
              <div className="text-[14px] text-[#6B7280]">홈 화면에서 앱을 실행하세요</div>
            </div>
          ) : deferredPrompt ? (
            /* Android: 자동 설치 */
            <div>
              <p className="text-[13px] text-[#6B7280] mb-3">아래 버튼을 누르면 홈 화면에 바로가기가 추가됩니다.</p>
              <button
                onClick={handleInstall}
                className="w-full py-4 text-[16px] font-bold text-white bg-[#F47920] border-none rounded-2xl cursor-pointer"
                style={{ boxShadow: '0 4px 12px rgba(244,121,32,0.3)' }}
              >
                홈 화면에 추가
              </button>
            </div>
          ) : isIos ? (
            /* iOS Safari: 수동 안내 */
            <div className="bg-[#F5F7FA] rounded-xl p-4">
              <div className="flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <span className="w-7 h-7 rounded-full bg-[#F47920] text-white text-[13px] font-bold flex items-center justify-center shrink-0">1</span>
                  <div className="text-[13px] text-[#374151]">
                    하단 <strong className="inline-flex items-center gap-1">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/>
                        <polyline points="16 6 12 2 8 6"/>
                        <line x1="12" y1="2" x2="12" y2="15"/>
                      </svg>
                      공유
                    </strong> 버튼을 탭하세요
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-7 h-7 rounded-full bg-[#F47920] text-white text-[13px] font-bold flex items-center justify-center shrink-0">2</span>
                  <div className="text-[13px] text-[#374151]">
                    스크롤해서 <strong>"홈 화면에 추가"</strong>를 찾아 탭하세요
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-7 h-7 rounded-full bg-[#F47920] text-white text-[13px] font-bold flex items-center justify-center shrink-0">3</span>
                  <div className="text-[13px] text-[#374151]">
                    우측 상단 <strong>"추가"</strong>를 탭하면 완료!
                  </div>
                </div>
              </div>
            </div>
          ) : isAndroid ? (
            /* Android Chrome: 메뉴 안내 (beforeinstallprompt 미지원 시) */
            <div className="bg-[#F5F7FA] rounded-xl p-4">
              <div className="flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <span className="w-7 h-7 rounded-full bg-[#F47920] text-white text-[13px] font-bold flex items-center justify-center shrink-0">1</span>
                  <div className="text-[13px] text-[#374151]">
                    우측 상단 <strong>⋮ 메뉴</strong>를 탭하세요
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-7 h-7 rounded-full bg-[#F47920] text-white text-[13px] font-bold flex items-center justify-center shrink-0">2</span>
                  <div className="text-[13px] text-[#374151]">
                    <strong>"홈 화면에 추가"</strong> 또는 <strong>"앱 설치"</strong>를 탭하세요
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-7 h-7 rounded-full bg-[#F47920] text-white text-[13px] font-bold flex items-center justify-center shrink-0">3</span>
                  <div className="text-[13px] text-[#374151]">
                    <strong>"설치"</strong> 또는 <strong>"추가"</strong>를 탭하면 완료!
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* 데스크탑 등 */
            <p className="text-[13px] text-[#6B7280]">모바일 브라우저에서 열면 홈 화면 추가 안내가 표시됩니다.</p>
          )}
        </div>

        {/* 로그인/회원가입 */}
        <div className="flex flex-col gap-3">
          <a
            href="/login"
            className="w-full py-4 text-[16px] font-bold text-white bg-[#111827] rounded-2xl text-center no-underline block"
          >
            로그인
          </a>
          <a
            href="/register"
            className="w-full py-4 text-[16px] font-bold text-[#111827] bg-white border-2 border-[#E5E7EB] rounded-2xl text-center no-underline block"
          >
            회원가입
          </a>
        </div>

        {/* 푸터 */}
        <div className="text-center mt-6 pb-8">
          <div className="text-[11px] text-[#9CA3AF]">해한Ai Engineering</div>
          <div className="text-[11px] text-[#9CA3AF] mt-1">본 서비스는 출퇴근·문서 확인용입니다</div>
        </div>
      </div>
    </div>
  )
}
