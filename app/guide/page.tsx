'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

type Step = 'login' | 'pending' | 'home-empty' | 'checkin' | 'home-working' | 'checkout' | 'completed'

const STEPS: { key: Step; label: string; desc: string }[] = [
  { key: 'login',        label: '1. 로그인',       desc: '전화번호 입력' },
  { key: 'pending',      label: '2. 승인 대기',     desc: '최초 1회 기기 승인' },
  { key: 'home-empty',   label: '3. 홈 화면',       desc: '출근 전 상태' },
  { key: 'checkin',      label: '4. 출근 QR',       desc: 'QR 스캔 후 화면' },
  { key: 'home-working', label: '5. 근무 중',        desc: '출근 완료 상태' },
  { key: 'checkout',     label: '6. 퇴근 QR',       desc: 'QR 스캔 후 화면' },
  { key: 'completed',    label: '7. 퇴근 완료',      desc: '오늘 완료' },
]

export default function GuidePage() {
  const [step, setStep] = useState<Step>('login')

  const currentIdx = STEPS.findIndex((s) => s.key === step)
  const canPrev = currentIdx > 0
  const canNext = currentIdx < STEPS.length - 1

  const prev = () => canPrev && setStep(STEPS[currentIdx - 1].key)
  const next = () => canNext && setStep(STEPS[currentIdx + 1].key)

  return (
    <div className="font-sans text-white min-h-screen bg-brand">

      {/* 상단 헤더 */}
      <header className="flex justify-between items-center px-6 h-[60px] bg-card border-b border-[rgba(91,164,217,0.15)] sticky top-0 z-10 shadow-[0_2px_12px_rgba(0,0,0,0.2)]">
        <Link href="/" className="text-sm text-muted-brand no-underline flex items-center gap-1">
          ← 돌아가기
        </Link>
        <div className="flex items-center gap-2.5">
          <Image
            src="/logo/logo_main.png"
            alt="해한Ai Engineering"
            width={80}
            height={60}
            className="h-10 w-auto rounded-md"
            priority
          />
          <span className="text-brand-muted2 text-[13px]">|</span>
          <span className="text-base font-bold text-white">앱 사용 미리보기</span>
        </div>
        <Link href="/login"
          className="py-[9px] px-5 bg-brand-accent text-white rounded-lg no-underline text-[13px] font-bold shadow-[0_2px_8px_rgba(244,121,32,0.3)]">
          시작하기
        </Link>
      </header>

      <div className="flex gap-7 p-7 px-6 max-w-[1100px] mx-auto flex-wrap">

        {/* 스텝 탭 */}
        <div className="flex flex-col gap-1.5 min-w-[190px] flex-none">
          {STEPS.map((s) => (
            <button
              key={s.key}
              onClick={() => setStep(s.key)}
              className="rounded-xl px-4 py-3 cursor-pointer text-left transition-all duration-150"
              style={
                s.key === step
                  ? {
                      background: 'rgba(244,121,32,0.1)',
                      border: '1px solid #F47920',
                      borderLeft: '3px solid #F47920',
                    }
                  : {
                      background: '#1B2838',
                      border: '1px solid rgba(91,164,217,0.15)',
                    }
              }
            >
              <span className="block text-[13px] font-bold text-white mb-0.5">{s.label}</span>
              <span className="block text-[11px] text-brand-muted2">{s.desc}</span>
            </button>
          ))}
        </div>

        {/* 폰 프레임 + 화면 */}
        <div className="flex-1 flex flex-col items-center gap-5">
          <div
            className="w-[300px] rounded-[40px] p-3.5 bg-[#0d1520] shadow-[0_24px_60px_rgba(0,0,0,0.5),inset_0_0_0_1px_rgba(255,255,255,0.06)] border border-[rgba(91,164,217,0.2)]"
          >
            <div className="w-[50px] h-[5px] bg-[#222] rounded-[3px] mx-auto mb-2.5" />
            <div className="bg-brand rounded-[28px] min-h-[540px] overflow-hidden relative">
              <ScreenContent step={step} onNext={next} />
            </div>
            <div className="w-9 h-9 bg-[#222] rounded-full mx-auto mt-2.5 border border-[#333]" />
          </div>

          {/* 이전/다음 버튼 */}
          <div className="flex items-center gap-4">
            <button
              onClick={prev}
              disabled={!canPrev}
              style={{ opacity: canPrev ? 1 : 0.3 }}
              className="py-2.5 px-6 bg-brand-accent text-white border-none rounded-[10px] cursor-pointer text-sm font-bold shadow-[0_3px_10px_rgba(244,121,32,0.3)]"
            >
              ← 이전
            </button>
            <span className="text-sm text-brand-muted2 min-w-12 text-center">
              {currentIdx + 1} / {STEPS.length}
            </span>
            <button
              onClick={next}
              disabled={!canNext}
              style={{ opacity: canNext ? 1 : 0.3 }}
              className="py-2.5 px-6 bg-brand-accent text-white border-none rounded-[10px] cursor-pointer text-sm font-bold shadow-[0_3px_10px_rgba(244,121,32,0.3)]"
            >
              다음 →
            </button>
          </div>
        </div>
      </div>

      {/* 하단 CTA */}
      <div className="text-center py-12 px-6 bg-[linear-gradient(135deg,#0d1b2a_0%,#1a2c42_100%)]">
        <p className="text-muted-brand mb-5 text-base">직접 사용해 보려면?</p>
        <Link href="/login"
          className="inline-block py-4 px-11 bg-brand-accent text-white rounded-xl no-underline text-[17px] font-bold shadow-[0_4px_16px_rgba(244,121,32,0.4)]">
          출퇴근 앱 시작하기
        </Link>
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────────
   화면 콘텐츠 (스텝별)
────────────────────────────────────────────── */
function ScreenContent({ step, onNext }: { step: Step; onNext: () => void }) {
  const [processing, setProcessing] = useState(false)

  const fakeProcess = () => {
    setProcessing(true)
    setTimeout(() => { setProcessing(false); onNext() }, 1200)
  }

  switch (step) {
    /* ── 1. 로그인 ── */
    case 'login':
      return (
        <div className="max-w-[480px] mx-auto px-5 py-5 min-h-[540px] bg-brand">
          <div className="text-center pt-10 mb-2">
            <Image
              src="/logo/logo_main.png"
              alt="해한Ai Engineering"
              width={120}
              height={90}
              className="w-[100px] h-auto mx-auto block rounded-[10px]"
              priority
            />
          </div>
          <div className="text-xs text-brand-muted2 text-center mb-7">현장 출퇴근 관리 시스템</div>
          <div className="bg-card rounded-2xl p-[22px] border border-[rgba(91,164,217,0.15)]">
            <div className="text-xs text-muted-brand mb-1.5">전화번호</div>
            <input
              className="w-full px-3 py-3 text-[15px] border border-[rgba(91,164,217,0.25)] rounded-lg box-border mb-3 bg-[rgba(255,255,255,0.06)] text-white"
              defaultValue="010-1234-5678"
              readOnly
            />
            <button
              onClick={fakeProcess}
              disabled={processing}
              className="w-full py-[13px] text-[15px] font-bold bg-brand-accent text-white border-none rounded-[10px] cursor-pointer mb-3 shadow-[0_3px_10px_rgba(244,121,32,0.3)]"
            >
              {processing ? '확인 중...' : '로그인'}
            </button>
            <div className="text-[11px] text-[#5a6a7e] text-center leading-[1.5]">
              ※ 처음 사용 시 관리자 기기 승인이 필요합니다.
            </div>
          </div>
        </div>
      )

    /* ── 2. 기기 승인 대기 ── */
    case 'pending':
      return (
        <div className="max-w-[480px] mx-auto px-5 py-5 min-h-[540px] bg-brand flex flex-col justify-center items-center">
          <div className="text-[48px] mb-4">⏳</div>
          <div className="text-lg font-bold text-white mb-2">기기 승인 대기 중</div>
          <div className="text-[13px] text-muted-brand text-center leading-[1.7] mb-6">
            현장 관리자가 이 기기를<br />승인하면 자동으로 로그인됩니다.<br /><br />
            <strong>최초 1회만</strong> 필요합니다.
          </div>
          <div className="bg-[rgba(91,164,217,0.1)] rounded-[10px] py-[14px] px-[18px] text-[13px] text-[#4A93C8] text-center">
            📱 승인 완료 후<br />다시 로그인하세요
          </div>
          <button
            onClick={onNext}
            className="w-full py-[13px] text-[15px] font-bold bg-[#555] text-white border-none rounded-[10px] cursor-pointer mt-6 shadow-[0_3px_10px_rgba(244,121,32,0.3)]"
          >
            (승인됨 — 다음 보기)
          </button>
        </div>
      )

    /* ── 3. 홈 (출근 전) ── */
    case 'home-empty':
      return (
        <div className="max-w-[480px] mx-auto px-5 py-5 min-h-[540px] bg-brand">
          <div className="flex justify-between items-center mb-4 pt-2">
            <div>
              <div className="text-base font-bold text-white">홍길동</div>
              <div className="text-[11px] text-brand-muted2 mt-0.5">해한Ai Engineering · 철근공</div>
            </div>
            <button className="bg-[rgba(255,255,255,0.06)] border border-[rgba(91,164,217,0.2)] rounded-md py-[5px] px-2.5 text-[11px] cursor-pointer text-muted-brand">
              로그아웃
            </button>
          </div>
          <div className="bg-card rounded-[14px] p-[18px] mb-2.5 border border-[rgba(91,164,217,0.12)]">
            <div className="text-[11px] text-brand-muted2 mb-2.5 uppercase tracking-[0.5px]">오늘의 출퇴근</div>
            <div className="text-center py-5 text-muted-brand">
              <p>오늘 출근 기록이 없습니다.</p>
              <p className="text-[13px] text-muted-brand">현장 QR코드를 스캔하여 출근하세요.</p>
            </div>
          </div>
          <div className="bg-[rgba(91,164,217,0.08)] border border-[rgba(91,164,217,0.2)] rounded-xl p-3.5 mb-2.5">
            <div className="text-xs font-bold text-secondary-brand mb-2">출퇴근 방법</div>
            <div className="text-[11px] text-[#4A93C8] mb-1 flex gap-1.5">1. 현장에 부착된 QR코드를 스캔하세요</div>
            <div className="text-[11px] text-[#4A93C8] mb-1 flex gap-1.5">2. 위치 권한을 허용하세요</div>
            <div className="text-[11px] text-[#4A93C8] mb-1 flex gap-1.5">3. 출근 / 퇴근 버튼을 누르세요</div>
          </div>
          <button
            onClick={onNext}
            className="w-full py-[11px] text-xs bg-[rgba(244,121,32,0.1)] text-accent border border-[rgba(244,121,32,0.3)] rounded-[9px] cursor-pointer font-semibold"
          >
            → QR 스캔 시뮬레이션
          </button>
        </div>
      )

    /* ── 4. QR 스캔 → 출근 ── */
    case 'checkin':
      return (
        <div className="max-w-[480px] mx-auto px-5 py-5 min-h-[540px] bg-brand">
          <div className="bg-card rounded-xl p-3.5 mb-2.5 border border-[rgba(91,164,217,0.12)]">
            <div className="text-[10px] text-[#5a6a7e] mb-1 uppercase tracking-[0.5px]">스캔한 현장</div>
            <div className="text-[17px] font-bold text-white mb-0.5">해한 A현장</div>
            <div className="text-xs text-muted-brand">서울시 강남구 테헤란로 123</div>
          </div>
          <div className="bg-card rounded-[14px] py-7 px-5 text-center border border-[rgba(91,164,217,0.12)] mb-2.5">
            <div className="text-[48px] mb-3">🏗️</div>
            <div className="text-lg font-bold text-white mb-1.5">출근 처리</div>
            <div className="text-[13px] text-muted-brand mb-[18px]">현재 위치를 확인 후 출근 처리합니다.</div>
            <button
              onClick={fakeProcess}
              disabled={processing}
              style={{ opacity: processing ? 0.6 : 1 }}
              className="w-full py-[15px] text-base font-bold bg-[linear-gradient(135deg,#2e7d32,#43a047)] text-white border-none rounded-xl cursor-pointer shadow-[0_3px_10px_rgba(46,125,50,0.3)]"
            >
              {processing ? '위치 확인 중...' : '출근하기'}
            </button>
          </div>
          <button className="w-full py-2.5 text-xs bg-transparent border border-[rgba(91,164,217,0.2)] rounded-[9px] cursor-pointer text-brand-muted2">
            GPS 오류 또는 예외 신청
          </button>
        </div>
      )

    /* ── 5. 홈 (근무 중) ── */
    case 'home-working':
      return (
        <div className="max-w-[480px] mx-auto px-5 py-5 min-h-[540px] bg-brand">
          <div className="flex justify-between items-center mb-4 pt-2">
            <div>
              <div className="text-base font-bold text-white">홍길동</div>
              <div className="text-[11px] text-brand-muted2 mt-0.5">해한Ai Engineering · 철근공</div>
            </div>
            <button className="bg-[rgba(255,255,255,0.06)] border border-[rgba(91,164,217,0.2)] rounded-md py-[5px] px-2.5 text-[11px] cursor-pointer text-muted-brand">
              로그아웃
            </button>
          </div>
          <div className="bg-card rounded-[14px] p-[18px] mb-2.5 border border-[rgba(91,164,217,0.12)]">
            <div className="text-[11px] text-brand-muted2 mb-2.5 uppercase tracking-[0.5px]">오늘의 출퇴근</div>
            <div className="inline-block bg-[#2e7d32] text-white text-[13px] font-bold py-1 px-3 rounded-[20px] mb-3">
              근무 중
            </div>
            <div className="text-base font-bold text-white mb-1">해한 A현장</div>
            <div className="text-[13px] text-muted-brand mb-5">서울시 강남구 테헤란로 123</div>
            <div className="flex items-center gap-3">
              <div className="flex-1 text-center">
                <div className="text-xs text-brand-muted2 mb-1">출근</div>
                <div className="text-[22px] font-bold">08:30</div>
                <div className="text-[11px] text-[#aaa] mt-1">45m</div>
              </div>
              <div className="text-lg text-[#ccc]">→</div>
              <div className="flex-1 text-center">
                <div className="text-xs text-brand-muted2 mb-1">퇴근</div>
                <div className="text-[22px] font-bold text-[#bbb]">--:--</div>
              </div>
            </div>
          </div>
          <div className="bg-[rgba(91,164,217,0.08)] border border-[rgba(91,164,217,0.2)] rounded-xl p-3.5 mb-2.5">
            <div className="text-xs font-bold text-secondary-brand mb-2">출퇴근 방법</div>
            <div className="text-[11px] text-[#4A93C8] mb-1 flex gap-1.5">1. 현장에 부착된 QR코드를 스캔하세요</div>
            <div className="text-[11px] text-[#4A93C8] mb-1 flex gap-1.5">2. 위치 권한을 허용하세요</div>
            <div className="text-[11px] text-[#4A93C8] mb-1 flex gap-1.5">3. 출근 / 퇴근 버튼을 누르세요</div>
          </div>
          <button
            onClick={onNext}
            className="w-full py-[11px] text-xs bg-[rgba(244,121,32,0.1)] text-accent border border-[rgba(244,121,32,0.3)] rounded-[9px] cursor-pointer font-semibold"
          >
            → 퇴근 QR 스캔 시뮬레이션
          </button>
        </div>
      )

    /* ── 6. QR 스캔 → 퇴근 ── */
    case 'checkout':
      return (
        <div className="max-w-[480px] mx-auto px-5 py-5 min-h-[540px] bg-brand">
          <div className="bg-card rounded-xl p-3.5 mb-2.5 border border-[rgba(91,164,217,0.12)]">
            <div className="text-[10px] text-[#5a6a7e] mb-1 uppercase tracking-[0.5px]">스캔한 현장</div>
            <div className="text-[17px] font-bold text-white mb-0.5">해한 A현장</div>
            <div className="text-xs text-muted-brand">서울시 강남구 테헤란로 123</div>
          </div>
          <div className="bg-card rounded-[14px] py-7 px-5 text-center border border-[rgba(91,164,217,0.12)] mb-2.5">
            <div className="text-[48px] mb-3">🏠</div>
            <div className="text-lg font-bold text-white mb-1.5">퇴근 처리</div>
            <div className="text-[13px] text-muted-brand mb-[18px]">현재 위치를 확인 후 퇴근 처리합니다.</div>
            <button
              onClick={fakeProcess}
              disabled={processing}
              style={{ opacity: processing ? 0.6 : 1 }}
              className="w-full py-[15px] text-base font-bold bg-[linear-gradient(135deg,#E06810,#F47920)] text-white border-none rounded-xl cursor-pointer shadow-[0_3px_10px_rgba(244,121,32,0.3)]"
            >
              {processing ? '위치 확인 중...' : '퇴근하기'}
            </button>
          </div>
          <button className="w-full py-2.5 text-xs bg-transparent border border-[rgba(91,164,217,0.2)] rounded-[9px] cursor-pointer text-brand-muted2">
            GPS 오류 또는 예외 신청
          </button>
        </div>
      )

    /* ── 7. 퇴근 완료 ── */
    case 'completed':
      return (
        <div className="max-w-[480px] mx-auto px-5 py-5 min-h-[540px] bg-brand">
          <div className="bg-card rounded-xl p-3.5 mb-2.5 border border-[rgba(91,164,217,0.12)]">
            <div className="text-[10px] text-[#5a6a7e] mb-1 uppercase tracking-[0.5px]">스캔한 현장</div>
            <div className="text-[17px] font-bold text-white mb-0.5">해한 A현장</div>
            <div className="text-xs text-muted-brand">서울시 강남구 테헤란로 123</div>
          </div>
          <div className="bg-card rounded-[14px] py-7 px-5 text-center border border-[rgba(91,164,217,0.12)] mb-2.5">
            <div className="text-[48px] mb-3">✅</div>
            <div className="text-lg font-bold text-[#2e7d32] mb-1.5">퇴근이 완료되었습니다.</div>
            <div className="text-[13px] text-muted-brand mb-[18px]">현장까지 거리: 32m</div>
            <button className="w-full py-[13px] text-sm font-semibold bg-[rgba(255,255,255,0.06)] text-[#CBD5E0] border border-[rgba(91,164,217,0.2)] rounded-[10px] cursor-pointer">
              내 출퇴근 현황 보기
            </button>
          </div>
          <div className="bg-[#e8f5e9] rounded-xl p-4 mt-2 text-center text-sm text-[#2e7d32]">
            🎉 오늘 근무 완료!<br />
            <span className="text-[13px] text-[#388e3c] font-bold">08:30 → 17:45</span>
          </div>
        </div>
      )
  }
}
