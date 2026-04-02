'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

const STEPS = [
  {
    icon: '📱',
    title: '홈 화면에 추가하셨나요?',
    desc: '브라우저에서 "홈 화면에 추가"를 하면 앱처럼 사용할 수 있습니다.',
    tip: 'iPhone: 공유 → 홈 화면에 추가\nAndroid: ⋮ 메뉴 → 앱 설치',
  },
  {
    icon: '📍',
    title: '위치 권한을 허용해 주세요',
    desc: '출퇴근 처리를 위해 GPS 위치 정보가 필요합니다. 브라우저에서 "허용"을 눌러주세요.',
    tip: '위치 정보는 출퇴근 판정에만 사용되며, 다른 용도로 사용되지 않습니다.',
  },
  {
    icon: '🏗️',
    title: '현장에서 출근하기',
    desc: '현장 100m 이내에 도착하면 "출근" 버튼을 누르세요. GPS로 위치가 자동 확인됩니다.',
    tip: 'GPS가 안 될 경우 "예외 신청" 버튼을 이용하세요.',
  },
  {
    icon: '📋',
    title: '작업일보 작성',
    desc: '퇴근 전에 오늘 한 작업을 기록합니다. 공종, 위치, 작업 내용을 입력하세요.',
    tip: '어제 작업과 같으면 자동으로 불러옵니다.',
  },
  {
    icon: '📄',
    title: '서류 제출',
    desc: '관리자가 요청한 서류(계약서, 안전교육 등)를 모바일에서 서명/업로드합니다.',
    tip: '"내 서류" 메뉴에서 미제출 서류를 확인할 수 있습니다.',
  },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  const handleNext = () => {
    if (isLast) {
      // 온보딩 완료 → 출퇴근 메인으로
      localStorage.setItem('onboarding_done', 'true')
      router.push('/attendance')
      return
    }
    setStep(step + 1)
  }

  const handleSkip = () => {
    localStorage.setItem('onboarding_done', 'true')
    router.push('/attendance')
  }

  return (
    <div className="min-h-screen bg-brand flex flex-col">
      <div className="h-1 bg-brand-accent shrink-0" />

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-[400px]">

          {/* 로고 */}
          <div className="text-center mb-6">
            <Image src="/logo/logo_main.png" alt="해한Ai" width={120} height={90} className="w-[80px] h-auto mx-auto rounded-xl" priority />
          </div>

          {/* 진행률 */}
          <div className="flex gap-1.5 mb-8">
            {STEPS.map((_, i) => (
              <div key={i} className={`flex-1 h-1 rounded-full transition-colors ${i <= step ? 'bg-brand-accent' : 'bg-brand-deeper'}`} />
            ))}
          </div>

          {/* 콘텐츠 카드 */}
          <div className="bg-card rounded-2xl border border-brand p-7 text-center mb-6">
            <div className="text-[48px] mb-4">{current.icon}</div>
            <h2 className="text-[18px] font-bold text-fore-brand mb-3">{current.title}</h2>
            <p className="text-[14px] text-muted-brand leading-[1.7] mb-4">{current.desc}</p>
            <div className="bg-surface rounded-xl px-4 py-3 text-[12px] text-secondary-brand leading-[1.6] whitespace-pre-wrap text-left">
              {current.tip}
            </div>
          </div>

          {/* 버튼 */}
          <div className="space-y-3">
            <button
              onClick={handleNext}
              className="w-full h-12 text-[15px] font-semibold text-white bg-brand-accent hover:bg-brand-accent-hover rounded-[12px] border-none cursor-pointer transition-colors shadow-[0_2px_10px_rgba(249,115,22,0.25)]"
            >
              {isLast ? '시작하기' : '다음'}
            </button>
            {!isLast && (
              <button
                onClick={handleSkip}
                className="w-full h-10 text-[13px] text-muted-brand bg-transparent border border-brand rounded-[10px] cursor-pointer hover:bg-surface transition-colors"
              >
                건너뛰기
              </button>
            )}
          </div>

          {/* 하단 안내 */}
          <p className="text-center text-[11px] text-muted2-brand mt-5">
            {step + 1} / {STEPS.length}단계 · 언제든 사용 가이드에서 다시 볼 수 있습니다
          </p>
        </div>
      </div>
    </div>
  )
}
