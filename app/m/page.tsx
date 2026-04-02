'use client'

import Link from 'next/link'
import BusinessFooter from '@/components/BusinessFooter'

export default function MobileLandingPage() {
  return (
    <div className="overflow-x-hidden w-full">

      {/* ── 히어로 ── */}
      <section className="px-5 pt-8 pb-10 bg-white">
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 22V12h6v10" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <span className="text-[16px] font-bold text-gray-900">해한<span className="text-orange-500">AI</span> 출퇴근</span>
        </div>

        <h1 className="text-[26px] font-bold text-gray-900 leading-[1.35] mb-3 break-keep">
          건설현장 출퇴근,<br />단순하고 정확하게
        </h1>
        <p className="text-[14px] text-gray-500 leading-[1.8] mb-7 break-keep">
          GPS로 출퇴근을 기록하고<br />공수·급여·보험을 자동으로 관리합니다.
        </p>

        <div className="space-y-2.5">
          <Link href="/m/guide" className="flex items-center justify-center gap-2 w-full py-[14px] bg-gray-900 text-white rounded-2xl no-underline text-[15px] font-bold active:bg-gray-800">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            가입 없이 둘러보기
          </Link>
          <Link href="/m/register" className="flex items-center justify-center w-full py-[14px] bg-orange-500 text-white rounded-2xl no-underline text-[15px] font-bold active:bg-orange-600">
            무료 시작하기
          </Link>
          <Link href="/m/login" className="flex items-center justify-center w-full py-3 border-2 border-gray-200 text-gray-700 rounded-2xl no-underline text-[14px] font-semibold active:bg-gray-50">
            로그인
          </Link>
        </div>
      </section>

      {/* ── 이런 분들께 추천합니다 ── */}
      <section className="px-5 py-8 bg-gray-50">
        <h2 className="text-[18px] font-bold text-gray-900 mb-5 break-keep">이런 분들께 추천합니다</h2>
        <div className="space-y-2.5">
          {[
            { emoji: '👷', text: '매일 출퇴근을 수기로 기록하고 있다면' },
            { emoji: '📝', text: '월말 공수 정산 때 항상 숫자가 안 맞는다면' },
            { emoji: '⚖️', text: '근로자와 분쟁 발생 시 증거가 없다면' },
            { emoji: '📊', text: '4대보험 신고를 매번 수동으로 하고 있다면' },
            { emoji: '🏗️', text: '여러 현장 인원 파악이 어렵다면' },
          ].map(item => (
            <div key={item.text} className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-gray-100">
              <span className="text-[20px] shrink-0">{item.emoji}</span>
              <span className="text-[14px] text-gray-700 break-keep">{item.text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── 왜 필요한가 ── */}
      <section className="px-5 py-8 bg-white">
        <h2 className="text-[18px] font-bold text-gray-900 mb-2 text-center break-keep">사업주도, 근로자도<br />안심할 수 있는 현장</h2>
        <p className="text-[13px] text-gray-500 text-center mb-6 leading-[1.7] break-keep">
          정확한 기록이 양측의 권리를 보호합니다.
        </p>
        <div className="space-y-2.5">
          {[
            { icon: '🛡️', title: '안전한 현장 운영', tag: '산업안전보건법', desc: '중대재해처벌법 대비, 체계적 기록으로 안전관리 의무 증명' },
            { icon: '🤝', title: '투명한 근로 관계', tag: '근로기준법', desc: '근로자는 본인 기록 직접 확인, 사업주는 공정하게 정산' },
            { icon: '📊', title: '정확한 정산과 신고', tag: '고용보험법', desc: '4대보험·퇴직공제 자동 집계, 신고 누락 예방' },
          ].map(c => (
            <div key={c.title} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[20px]">{c.icon}</span>
                <span className="text-[14px] font-bold text-gray-900">{c.title}</span>
              </div>
              <p className="text-[13px] text-gray-500 leading-[1.7] m-0 mb-2 break-keep">{c.desc}</p>
              <span className="text-[11px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{c.tag}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── 수기 vs 전자 비교 ── */}
      <section className="px-5 py-8 bg-gray-50">
        <h2 className="text-[16px] font-bold text-gray-900 mb-4 text-center break-keep">같은 현장, 다른 관리</h2>
        <div className="space-y-2.5">
          <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
            <div className="text-[14px] font-bold text-orange-700 mb-2">수기 출석부</div>
            <div className="space-y-1.5 text-[13px] text-orange-600">
              {['대리 서명 가능 — 신뢰도 낮음', '분쟁 시 증거로 인정 어려움', '월말 정산 오류 발생', '감독관 점검 시 보완 요구'].map(t => (
                <div key={t} className="flex items-start gap-2"><span className="shrink-0 mt-0.5">-</span><span className="break-keep">{t}</span></div>
              ))}
            </div>
          </div>
          <div className="bg-green-50 rounded-xl p-4 border border-green-100">
            <div className="text-[14px] font-bold text-green-700 mb-2">GPS 전자 출퇴근</div>
            <div className="space-y-1.5 text-[13px] text-green-700">
              {['GPS+시간 자동 기록 — 객관적 증거', '기기 인증으로 본인만 가능', '공수·급여 자동 계산', '법정 서류 즉시 출력'].map(t => (
                <div key={t} className="flex items-start gap-2"><span className="shrink-0 mt-0.5">+</span><span className="break-keep">{t}</span></div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 핵심 기능 ── */}
      <section className="px-5 py-8 bg-white">
        <h2 className="text-[18px] font-bold text-gray-900 mb-5 text-center">핵심 기능</h2>
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: '📍', title: 'GPS\n출퇴근' },
            { icon: '📋', title: '작업\n일보' },
            { icon: '💰', title: '공수\n자동계산' },
            { icon: '📄', title: '전자\n계약서명' },
            { icon: '🛡️', title: '안전교육\n확인' },
            { icon: '📊', title: '4대보험\n자동집계' },
            { icon: '📅', title: '근무\n캘린더' },
            { icon: '🔔', title: '체류확인\n알림' },
            { icon: '📦', title: '자재\n청구관리' },
          ].map(f => (
            <div key={f.title} className="bg-gray-50 rounded-xl py-3 px-2 text-center">
              <div className="text-[22px] mb-1">{f.icon}</div>
              <div className="text-[11px] font-semibold text-gray-700 whitespace-pre-line leading-[1.4]">{f.title}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 사용 흐름 ── */}
      <section className="px-5 py-8 bg-gray-50">
        <h2 className="text-[18px] font-bold text-gray-900 mb-5 text-center break-keep">이렇게 사용합니다</h2>
        <div className="space-y-3">
          {[
            { step: '1', title: '가입', desc: '이메일 또는 Google/카카오로 간편 가입' },
            { step: '2', title: '현장 배정', desc: '관리자가 현장을 배정하면 알림' },
            { step: '3', title: '출퇴근', desc: '현장 도착 → 출근 버튼, 퇴근 시 퇴근 버튼' },
            { step: '4', title: '작업일보', desc: '하루 작업 내용을 사진과 함께 기록' },
            { step: '5', title: '공수 확인', desc: '캘린더에서 월별 공수와 급여를 확인' },
          ].map(s => (
            <div key={s.step} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-orange-500 text-white text-[14px] font-bold flex items-center justify-center shrink-0">{s.step}</div>
              <div className="pt-0.5">
                <div className="text-[14px] font-bold text-gray-900">{s.title}</div>
                <div className="text-[13px] text-gray-500 mt-0.5 break-keep">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 사용자 유형 ── */}
      <section className="px-5 py-8 bg-white">
        <h2 className="text-[18px] font-bold text-gray-900 mb-5 text-center">누가 사용하나요?</h2>
        <div className="space-y-2.5">
          <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
            <div className="text-[15px] font-bold text-gray-900 mb-2">근로자</div>
            <div className="space-y-1 text-[13px] text-gray-600">
              {['GPS 출퇴근 기록', '내 공수·급여 캘린더 확인', '작업일보 작성', '계약서·안전교육 전자서명'].map(t => (
                <div key={t} className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-orange-400 shrink-0" />{t}</div>
              ))}
            </div>
          </div>
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
            <div className="text-[15px] font-bold text-gray-900 mb-2">사업자 (관리자)</div>
            <div className="space-y-1 text-[13px] text-gray-600">
              {['현장별 출근 현황 실시간 확인', '공수·급여 자동 정산', '4대보험·퇴직공제 자동 집계', '노임대장·세금계산표 출력'].map(t => (
                <div key={t} className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-blue-400 shrink-0" />{t}</div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 하단 CTA ── */}
      <section className="px-5 py-10 bg-orange-50 text-center">
        <h2 className="text-[20px] font-bold text-gray-900 mb-2 break-keep">지금 바로 시작하세요</h2>
        <p className="text-[13px] text-gray-500 mb-5 break-keep">스마트폰 브라우저로 별도 설치 없이 사용</p>
        <div className="space-y-2.5">
          <Link href="/m/register" className="block w-full py-[14px] bg-orange-500 text-white rounded-2xl no-underline text-[15px] font-bold active:bg-orange-600">무료 시작하기</Link>
          <Link href="/m/guide" className="block w-full py-3 border-2 border-gray-200 bg-white text-gray-700 rounded-2xl no-underline text-[14px] font-semibold active:bg-gray-50">둘러보기</Link>
        </div>
      </section>

      <BusinessFooter />
    </div>
  )
}
