'use client'

import Link from 'next/link'
import BusinessFooter from '@/components/BusinessFooter'

export default function MobileLandingPage() {
  return (
    <div className="font-[Pretendard,system-ui,sans-serif]">

      {/* 히어로 */}
      <section className="px-5 pt-8 pb-10 bg-white">
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 22V12h6v10" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <span className="text-[16px] font-bold text-gray-900">해한<span className="text-orange-500">AI</span> 출퇴근</span>
        </div>

        <h1 className="text-[28px] font-bold text-gray-900 leading-[1.35] mb-3">
          건설현장 출퇴근,<br />단순하고 정확하게
        </h1>
        <p className="text-[15px] text-gray-500 leading-[1.8] mb-7">
          GPS로 출퇴근을 기록하고<br />공수·급여·보험을 자동으로 관리합니다.
        </p>

        <div className="space-y-3">
          <Link href="/m/guide" className="flex items-center justify-center gap-2 w-full py-4 bg-gray-900 text-white rounded-2xl no-underline text-[16px] font-bold active:bg-gray-800">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            가입 없이 둘러보기
          </Link>
          <Link href="/m/register" className="flex items-center justify-center w-full py-4 bg-orange-500 text-white rounded-2xl no-underline text-[16px] font-bold active:bg-orange-600">
            무료 시작하기
          </Link>
          <Link href="/m/login" className="flex items-center justify-center w-full py-3.5 border-2 border-gray-200 text-gray-700 rounded-2xl no-underline text-[15px] font-semibold active:bg-gray-50">
            로그인
          </Link>
        </div>
      </section>

      {/* 왜 필요한가 */}
      <section className="px-5 py-10 bg-gray-50">
        <h2 className="text-[20px] font-bold text-gray-900 mb-2 text-center">사업주도, 근로자도<br />안심할 수 있는 현장</h2>
        <p className="text-[13px] text-gray-500 text-center mb-7 leading-[1.7]">
          정확한 기록은 사업주의 관리 의무를 증명하고<br />근로자의 정당한 권리를 보장합니다.
        </p>

        <div className="space-y-3">
          {[
            { icon: '🛡️', title: '안전한 현장', desc: '중대재해처벌법 대비, 체계적 출퇴근 기록으로 안전관리 의무 증명' },
            { icon: '🤝', title: '투명한 근로 관계', desc: '근로자는 본인 기록 직접 확인, 사업주는 공정하게 정산' },
            { icon: '📊', title: '정확한 정산', desc: '4대보험·퇴직공제 자동 집계, 신고 누락 예방' },
          ].map(c => (
            <div key={c.title} className="bg-white rounded-2xl p-5 border border-gray-100">
              <div className="text-[24px] mb-2">{c.icon}</div>
              <div className="text-[15px] font-bold text-gray-900 mb-1">{c.title}</div>
              <div className="text-[13px] text-gray-500 leading-[1.7]">{c.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 핵심 기능 */}
      <section className="px-5 py-10 bg-white">
        <h2 className="text-[18px] font-bold text-gray-900 mb-5 text-center">핵심 기능</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: '📍', title: 'GPS 출퇴근' },
            { icon: '📋', title: '작업일보' },
            { icon: '💰', title: '공수·급여 자동' },
            { icon: '📄', title: '전자 계약·서명' },
            { icon: '🛡️', title: '안전교육 확인' },
            { icon: '📊', title: '4대보험 자동' },
          ].map(f => (
            <div key={f.title} className="bg-gray-50 rounded-2xl p-4 text-center">
              <div className="text-[24px] mb-1.5">{f.icon}</div>
              <div className="text-[13px] font-semibold text-gray-900">{f.title}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 하단 CTA */}
      <section className="px-5 py-10 bg-orange-50 text-center">
        <h2 className="text-[20px] font-bold text-gray-900 mb-3">지금 바로 시작하세요</h2>
        <p className="text-[13px] text-gray-500 mb-5">스마트폰 브라우저로 별도 설치 없이 사용</p>
        <div className="space-y-2.5">
          <Link href="/m/register" className="block w-full py-4 bg-orange-500 text-white rounded-2xl no-underline text-[16px] font-bold active:bg-orange-600">무료 시작하기</Link>
          <Link href="/m/guide" className="block w-full py-3.5 border-2 border-gray-200 bg-white text-gray-700 rounded-2xl no-underline text-[15px] font-semibold active:bg-gray-50">둘러보기</Link>
        </div>
      </section>

      <BusinessFooter />
    </div>
  )
}
