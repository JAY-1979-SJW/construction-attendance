'use client'

import Link from 'next/link'
import Image from 'next/image'

function StepBar({ current }: { current: number }) {
  const steps = ['약관동의', '소셜인증', '정보입력', '승인대기']
  return (
    <div className="flex items-center justify-between mb-7 px-1">
      {steps.map((label, i) => {
        const step = i + 1
        const done = step < current
        const active = step === current
        return (
          <div key={label} className="flex flex-col items-center flex-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold mb-1 ${
              done ? 'bg-[#16a34a] text-white' : active ? 'bg-[#F97316] text-white' : 'bg-[#E5E7EB] text-[#9CA3AF]'
            }`}>
              {done ? '✓' : step}
            </div>
            <span className={`text-[10px] ${active ? 'text-[#F97316] font-semibold' : done ? 'text-[#16a34a]' : 'text-[#9CA3AF]'}`}>{label}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function RegisterPendingPage() {
  return (
    <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl px-8 py-9 w-full max-w-[440px] shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-[#E5E7EB] border-t-[3px] border-t-[#F97316] text-center">
        <div className="mb-3">
          <Image src="/logo/logo_main.png" alt="해한Ai" width={240} height={180} className="w-[120px] h-auto mx-auto block rounded-xl" priority />
        </div>

        <StepBar current={4} />

        <div className="w-[56px] h-[56px] bg-[rgba(22,163,74,0.1)] border border-[rgba(22,163,74,0.3)] rounded-full flex items-center justify-center text-[24px] mx-auto mb-4">✓</div>

        <h1 className="text-[18px] font-extrabold text-[#111827] mb-2">가입이 완료되었습니다</h1>
        <p className="text-[14px] text-[#6B7280] leading-[1.7] mb-6">
          <span className="text-[#F97316] font-semibold">관리자 승인 후</span> 서비스를 이용할 수 있습니다.<br />
          승인 후 기기 등록 및 현장 참여를 진행합니다.
        </p>

        <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-4 py-3 mb-6 text-[12px] text-[#6B7280] leading-[1.6]">
          승인은 영업일 1~2일 이내 처리됩니다.<br />문의: 현장 관리자 또는 담당자
        </div>

        <Link href="/login" className="inline-block px-10 py-[12px] bg-[#F97316] text-white rounded-[10px] no-underline text-[14px] font-bold shadow-[0_4px_14px_rgba(249,115,22,0.25)]">
          로그인 화면으로
        </Link>
      </div>
    </div>
  )
}
