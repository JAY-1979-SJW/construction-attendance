'use client'

import Link from 'next/link'

export default function MobileLandingPage() {
  return (
    <div className="px-5 pb-10">

      {/* 로고 */}
      <div className="flex items-center gap-2.5 pt-7 mb-10">
        <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 22V12h6v10" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <span className="text-[16px] font-bold text-gray-900">해한<span className="text-orange-500">AI</span> 출퇴근</span>
      </div>

      {/* 타이틀 */}
      <h1 className="text-[26px] font-bold text-gray-900 leading-[1.3] mb-3">
        건설현장 출퇴근,<br/>단순하고 정확하게
      </h1>
      <p className="text-[14px] text-gray-500 leading-[1.7] mb-8">
        GPS 출퇴근 · 공수 자동계산 · 4대보험 집계
      </p>

      {/* CTA */}
      <div className="space-y-2.5 mb-10">
        <Link href="/m/guide" className="flex items-center justify-center gap-2 w-full py-[14px] bg-gray-900 text-white rounded-2xl no-underline text-[15px] font-bold active:bg-gray-800">
          둘러보기
        </Link>
        <Link href="/m/register" className="flex items-center justify-center w-full py-[14px] bg-orange-500 text-white rounded-2xl no-underline text-[15px] font-bold active:bg-orange-600">
          무료 시작하기
        </Link>
        <Link href="/m/login" className="flex items-center justify-center w-full py-3 border-2 border-gray-200 text-gray-700 rounded-2xl no-underline text-[14px] font-semibold active:bg-gray-50">
          로그인
        </Link>
      </div>

      {/* 메뉴 카드 — 탭하면 각 상세 페이지로 이동 */}
      <div className="space-y-2">
        <MenuItem href="/m/guide#why" icon="🛡️" title="왜 필요한가" desc="중대재해법 · 노사분쟁 · 보험신고" />
        <MenuItem href="/m/guide#features" icon="⚡" title="핵심 기능" desc="GPS출퇴근 · 작업일보 · 전자서명" />
        <MenuItem href="/m/guide#flow" icon="📱" title="사용 방법" desc="가입 → 현장배정 → 출퇴근 → 공수확인" />
        <MenuItem href="/m/guide#compare" icon="📊" title="수기 vs 전자" desc="왜 전자 출퇴근이 필요한지" />
        <MenuItem href="/m/guide#users" icon="👥" title="사용 대상" desc="근로자 · 사업자 각각 어떻게 쓰나" />
        <MenuItem href="/m/guide#preview" icon="🖥️" title="화면 미리보기" desc="관리자 포털 실제 화면" />
        <MenuItem href="/m/guide#faq" icon="❓" title="자주 묻는 질문" desc="설치 · 승인 · GPS · 기기변경" />
      </div>

      {/* 하단 */}
      <div className="mt-10 text-center text-[11px] text-gray-400 space-y-1">
        <p className="m-0">승민 F&G | 대표 신재우 | 사업자 372-34-00685</p>
        <p className="m-0">통신판매업 2021-서울강남-06681</p>
        <p className="m-0">02-562-6652 | jay@haehan-ai.kr</p>
        <p className="m-0 mt-2">© 2026 해한AI Engineering</p>
      </div>
    </div>
  )
}

function MenuItem({ href, icon, title, desc }: { href: string; icon: string; title: string; desc: string }) {
  return (
    <Link href={href} className="flex items-center gap-3.5 w-full bg-white rounded-xl px-4 py-3.5 border border-gray-100 no-underline active:bg-gray-50">
      <span className="text-[22px] shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-bold text-gray-900">{title}</div>
        <div className="text-[12px] text-gray-500 mt-0.5">{desc}</div>
      </div>
      <span className="text-gray-300 text-[14px] shrink-0">›</span>
    </Link>
  )
}
