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
              done ? 'bg-[#16a34a] text-white' : active ? 'bg-brand-accent text-white' : 'bg-brand-deeper text-muted2-brand'
            }`}>
              {done ? '✓' : step}
            </div>
            <span className={`text-[10px] ${active ? 'text-accent font-semibold' : done ? 'text-status-working' : 'text-muted2-brand'}`}>{label}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function RegisterPendingPage() {
  return (
    <div className="min-h-screen bg-brand flex items-center justify-center p-6">
      <div className="bg-card rounded-2xl px-8 py-9 w-full max-w-[440px] shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-brand border-t-[3px] border-t-accent text-center">
        <div className="mb-3">
          <Image src="/logo/logo_main.png" alt="해한Ai" width={240} height={180} className="w-[120px] h-auto mx-auto block rounded-xl" priority />
        </div>

        <StepBar current={4} />

        <div className="w-[56px] h-[56px] bg-[rgba(22,163,74,0.1)] border border-[rgba(22,163,74,0.3)] rounded-full flex items-center justify-center text-[24px] mx-auto mb-4">✓</div>

        <h1 className="text-[18px] font-extrabold text-fore-brand mb-2">가입이 완료되었습니다</h1>
        <p className="text-[14px] text-muted-brand leading-[1.7] mb-6">
          <span className="text-accent font-semibold">관리자 승인 후</span> 서비스를 이용할 수 있습니다.<br />
          승인 후 기기 등록 및 현장 참여를 진행합니다.
        </p>

        {/* ── 필수 서류 안내 ── */}
        <div className="text-left mb-6">
          <h2 className="text-[14px] font-bold text-fore-brand mb-3">필수 서류 안내</h2>
          <div className="space-y-[10px]">
            {[
              { name: '개인정보 제공 동의서', status: 'done', note: '가입 시 동의 완료' },
              { name: '근로계약서', status: 'later', note: '현장 배정 후 관리자가 생성' },
              { name: '안전교육 확인서', status: 'later', note: '현장 배정 후 관리자가 생성' },
              { name: '건강 이상 없음 각서', status: 'pending', note: '승인 후 제출' },
              { name: '건강 증명서', status: 'pending', note: '승인 후 업로드' },
            ].map((doc) => (
              <div key={doc.name} className="flex items-start gap-[10px] bg-surface border border-brand rounded-lg px-3 py-[10px]">
                <span className="text-[16px] leading-none mt-[1px] shrink-0">
                  {doc.status === 'done' ? '✅' : doc.status === 'later' ? '⏳' : '📄'}
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-fore-brand">{doc.name}</div>
                  <div className="text-[11px] mt-[2px]" style={{ color: doc.status === 'done' ? '#16a34a' : doc.status === 'later' ? '#9CA3AF' : '#F97316' }}>
                    {doc.note}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface border border-brand rounded-xl px-4 py-3 mb-6 text-[12px] text-muted-brand leading-[1.6]">
          승인은 영업일 1~2일 이내 처리됩니다.<br />문의: 현장 관리자 또는 담당자
        </div>

        <Link href="/login" className="inline-block px-10 py-[12px] bg-brand-accent text-white rounded-[10px] no-underline text-[14px] font-bold shadow-[0_4px_14px_rgba(249,115,22,0.25)]">
          로그인 화면으로
        </Link>
      </div>
    </div>
  )
}
