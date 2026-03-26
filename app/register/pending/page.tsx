'use client'

import Link from 'next/link'
import Image from 'next/image'

/* ── 스텝 인디케이터 ─────────────────────────────── */
function StepBar({ current }: { current: number }) {
  const steps = ['약관동의', '소셜인증', '정보입력', '승인대기']
  return (
    <div className="flex items-center justify-between mb-8 px-2">
      {steps.map((label, i) => {
        const step = i + 1
        const done = step < current
        const active = step === current
        return (
          <div key={label} className="flex flex-col items-center flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold mb-1 transition-colors ${
              done ? 'bg-[#16a34a] text-white' : active ? 'bg-[#F97316] text-white' : 'bg-[#E5E7EB] text-[#9CA3AF]'
            }`}>
              {done ? '✓' : step}
            </div>
            <span className={`text-[11px] ${active ? 'text-[#F97316] font-semibold' : done ? 'text-[#16a34a]' : 'text-[#9CA3AF]'}`}>{label}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function RegisterPendingPage() {
  return (
    <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl px-8 py-9 w-full max-w-[480px] shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-[#E5E7EB] border-t-[3px] border-t-[#F97316] text-center">
        <div className="mb-4">
          <Image src="/logo/logo_main.png" alt="해한Ai Engineering" width={240} height={180} className="w-[140px] h-auto mx-auto block rounded-xl" priority />
        </div>

        <StepBar current={4} />

        <div className="mb-5">
          <div className="w-[64px] h-[64px] bg-[rgba(22,163,74,0.1)] border border-[rgba(22,163,74,0.3)] rounded-full flex items-center justify-center text-[28px] mx-auto">✓</div>
        </div>
        <h1 className="text-[20px] font-extrabold text-[#111827] tracking-[-0.5px] mb-2">가입 신청 완료</h1>
        <p className="text-[14px] text-[#6B7280] leading-[1.7] mb-6">
          회원가입이 접수되었습니다.<br />
          <span className="text-[#F97316] font-bold">관리자 승인 후</span> 출퇴근이 가능합니다.
        </p>

        {/* 다음 단계 안내 */}
        <div className="text-left mb-6 bg-[#F9FAFB] rounded-xl px-5 py-4">
          {[
            { icon: '✓', color: '#16a34a', title: '회원가입 완료', active: false },
            { icon: '⏳', color: '#F97316', title: '관리자 승인 대기 중', active: true },
            { icon: '3', color: '#9CA3AF', title: '기기 승인', active: false },
            { icon: '4', color: '#9CA3AF', title: '현장 참여 신청', active: false },
            { icon: '5', color: '#9CA3AF', title: '출퇴근 시작', active: false },
          ].map((s) => (
            <div key={s.title} className="flex items-center gap-3 mb-3 last:mb-0">
              <span
                className="w-7 h-7 min-w-[28px] rounded-full flex items-center justify-center text-[12px] font-bold"
                style={{ color: s.color, background: `${s.color}18`, border: `1.5px solid ${s.color}40` }}
              >
                {s.icon}
              </span>
              <span className={`text-[13px] ${s.active ? 'text-[#111827] font-semibold' : s.icon === '✓' ? 'text-[#374151]' : 'text-[#9CA3AF]'}`}>
                {s.title}
              </span>
            </div>
          ))}
        </div>

        <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl px-4 py-3 mb-6 text-left flex gap-3 items-start">
          <span className="text-[16px] shrink-0 mt-0.5">ℹ️</span>
          <div className="text-[12px] text-[#4B5563] leading-[1.6]">
            승인은 영업일 기준 1~2일 이내 처리됩니다.<br />문의: 현장 관리자 또는 담당자에게 연락해 주세요.
          </div>
        </div>

        <Link href="/login" className="inline-block px-10 py-[13px] bg-[#F97316] text-white rounded-[10px] no-underline text-[14px] font-bold shadow-[0_4px_14px_rgba(249,115,22,0.35)]">
          로그인 화면으로
        </Link>
      </div>
    </div>
  )
}
