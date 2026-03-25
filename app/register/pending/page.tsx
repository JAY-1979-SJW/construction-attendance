'use client'

import Link from 'next/link'
import Image from 'next/image'

export default function RegisterPendingPage() {
  return (
    <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center p-6">
      <div className="bg-white rounded-[20px] px-9 py-11 w-full max-w-[460px] shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-[#E5E7EB] border-t-[3px] border-t-[#F97316] text-center">
        <div className="mb-5">
          <Image src="/logo/logo_main.png" alt="해한Ai Engineering" width={240} height={180} className="w-[160px] h-auto mx-auto block rounded-xl" priority />
        </div>
        <div className="mb-5">
          <div className="w-[72px] h-[72px] bg-[rgba(249,115,22,0.1)] border border-[rgba(249,115,22,0.3)] rounded-full flex items-center justify-center text-[32px] mx-auto">⏳</div>
        </div>
        <h1 className="text-2xl font-extrabold text-[#111827] tracking-[-0.5px] mb-3">가입 신청 완료</h1>
        <p className="text-[15px] text-[#6B7280] leading-[1.7] mb-7">
          회원가입 신청이 접수되었습니다.<br />
          <span className="text-[#F97316] font-bold">관리자 승인 후</span> 로그인 및 출퇴근이 가능합니다.
        </p>

        <div className="text-left mb-6 bg-[#F9FAFB] rounded-xl px-5 py-4">
          {[
            { num: '✓',  color: '#16a34a', bg: 'rgba(22,163,74,0.1)',    border: 'rgba(22,163,74,0.3)',    title: '회원가입 신청',         sub: '완료되었습니다.' },
            { num: '2',  color: '#F97316', bg: 'rgba(249,115,22,0.1)',   border: 'rgba(249,115,22,0.3)',   title: '관리자 계정 승인',      sub: '승인 대기 중입니다.' },
            { num: '3',  color: '#9CA3AF', bg: 'rgba(156,163,175,0.1)', border: 'rgba(156,163,175,0.2)', title: '기기 승인',             sub: '계정 승인 후 진행됩니다.' },
            { num: '4',  color: '#9CA3AF', bg: 'rgba(156,163,175,0.1)', border: 'rgba(156,163,175,0.2)', title: '현장 참여 신청 및 승인', sub: '계정 승인 후 신청 가능합니다.' },
            { num: '5',  color: '#9CA3AF', bg: 'rgba(156,163,175,0.1)', border: 'rgba(156,163,175,0.2)', title: '출퇴근 가능',            sub: '모든 승인 완료 후 사용 가능합니다.' },
          ].map((step) => (
            <div key={step.num} className="flex items-start gap-[14px] mb-[14px]">
              <span
                className="w-[30px] h-[30px] min-w-[30px] rounded-full flex items-center justify-center text-[13px] font-bold mt-[2px]"
                style={{ color: step.color, background: step.bg, border: `1px solid ${step.border}` }}
              >
                {step.num}
              </span>
              <div>
                <div
                  className="text-sm font-semibold mb-[2px]"
                  style={{ color: step.num === '✓' ? '#111827' : step.num === '2' ? '#111827' : '#9CA3AF' }}
                >
                  {step.title}
                </div>
                <div className="text-[12px] text-[#9CA3AF]">{step.sub}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl px-4 py-[14px] mb-6 text-left flex gap-3 items-start">
          <span className="text-[18px] shrink-0">ℹ️</span>
          <div>
            <div className="text-[13px] font-bold text-[#2563EB] mb-1">승인 안내</div>
            <div className="text-[13px] text-[#4B5563] leading-[1.6]">승인 소요 시간: 영업일 기준 1~2일 이내<br />문의: 현장 관리자 또는 담당자에게 연락해 주세요.</div>
          </div>
        </div>

        <Link href="/login" className="inline-block px-10 py-[15px] bg-[#F97316] text-white rounded-[10px] no-underline text-[15px] font-bold shadow-[0_4px_14px_rgba(249,115,22,0.35)]">로그인 화면으로</Link>
      </div>
    </div>
  )
}
