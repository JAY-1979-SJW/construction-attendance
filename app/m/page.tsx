'use client'

import Link from 'next/link'

export default function MobileLanding() {
  return (
    <div className="px-5 pb-12">
      {/* 로고 */}
      <div className="flex items-center gap-2.5 pt-7 mb-10">
        <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 22V12h6v10" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <span className="text-[16px] font-bold text-gray-900">해한<span className="text-orange-500">AI</span> 출퇴근</span>
      </div>

      {/* 타이틀 */}
      <h1 className="text-[26px] font-bold text-gray-900 leading-[1.3] mb-2">건설현장 출퇴근</h1>
      <p className="text-[14px] text-gray-500 mb-8">GPS 출퇴근 · 공수 자동 · 4대보험 집계</p>

      {/* CTA */}
      <div className="space-y-2.5 mb-10">
        <Link href="/m/register" className="flex items-center justify-center w-full py-[14px] bg-orange-500 text-white rounded-2xl no-underline text-[15px] font-bold active:bg-orange-600">무료 시작하기</Link>
        <Link href="/m/login" className="flex items-center justify-center w-full py-3 border-2 border-gray-200 text-gray-700 rounded-2xl no-underline text-[14px] font-semibold active:bg-gray-50">로그인</Link>
      </div>

      {/* 요약 카드 — 탭하면 상세 페이지 */}
      <div className="space-y-2">
        <Card href="/m/why" icon="🛡️" title="왜 필요한가" desc="사업주와 근로자 모두를 보호합니다" />
        <Card href="/m/features" icon="⚡" title="핵심 기능" desc="출퇴근부터 급여까지 한번에" />
        <Card href="/m/flow" icon="📱" title="이렇게 사용합니다" desc="가입부터 공수확인까지 5단계" />
        <Card href="/m/compare" icon="📊" title="수기 vs 전자" desc="어떤 차이가 있나요?" />
        <Card href="/m/users" icon="👥" title="누가 사용하나요" desc="근로자와 사업자 각각의 기능" />
        <Card href="/m/preview" icon="🖥️" title="화면 미리보기" desc="관리자 포털 실제 화면 확인" />
        <Card href="/m/faq" icon="❓" title="자주 묻는 질문" desc="설치, 승인, GPS, 기기변경" />
      </div>

      {/* 푸터 */}
      <div className="mt-10 pt-6 border-t border-gray-100 text-center text-[11px] text-gray-400 space-y-0.5">
        <p className="m-0">승민 F&G | 대표 신재우 | 372-34-00685</p>
        <p className="m-0">02-562-6652 | jay@haehan-ai.kr</p>
        <p className="m-0 mt-1.5">© 2026 해한AI Engineering</p>
      </div>
    </div>
  )
}

function Card({ href, icon, title, desc }: { href: string; icon: string; title: string; desc: string }) {
  return (
    <Link href={href} className="flex items-center gap-3.5 w-full bg-white rounded-xl px-4 py-3.5 border border-gray-100 no-underline active:bg-gray-50">
      <span className="text-[22px] shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-bold text-gray-900 truncate">{title}</div>
        <div className="text-[12px] text-gray-500 truncate">{desc}</div>
      </div>
      <span className="text-gray-300 shrink-0">›</span>
    </Link>
  )
}
