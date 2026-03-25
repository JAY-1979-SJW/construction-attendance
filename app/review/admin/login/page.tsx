import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '[검토용] 관리자 로그인 — 해한AI 출퇴근',
  robots: { index: false, follow: false },
}

export default function ReviewAdminLoginPage() {
  return (
    <div className="font-sans min-h-screen bg-[#F9FAFB] text-[#111827]">

      {/* 검토용 배너 */}
      <div className="bg-[#F47920] text-white text-center text-[12px] font-semibold py-1.5">
        검토용 화면 — 실제 로그인 불가 · Mock Data
      </div>

      {/* 헤더 */}
      <header className="sticky top-0 z-50">
        <div className="h-1 bg-[#F97316]" />
        <div className="bg-white border-b border-[#F3F4F6]">
          <div className="max-w-[1100px] mx-auto px-6 flex items-center justify-between" style={{ height: '60px' }}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#FFF7ED] rounded-[9px] flex items-center justify-center shrink-0">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M9 22V12h6v10" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className="text-[15px] font-bold text-[#0F172A]">해한AI 출퇴근</span>
            </div>
            <nav className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-[#F97316] border border-[#FDBA74] bg-[#FFF7ED] rounded-[8px] px-4 py-[7px]">
                관리자 로그인
              </span>
              <Link href="/review/admin/dashboard"
                className="text-[13px] font-semibold text-white bg-[#F97316] rounded-[8px] px-4 py-2 no-underline">
                대시보드 미리보기
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* 본문 */}
      <main className="max-w-[1100px] mx-auto px-6 py-16 flex items-start gap-16 flex-wrap lg:flex-nowrap">

        {/* 좌: 안내 */}
        <div className="flex-1 min-w-[260px] pt-4">
          <div className="inline-block bg-[#FFF7ED] text-[#F97316] text-[12px] font-semibold px-3 py-1 rounded-full mb-5 tracking-wide">
            관리자 포털
          </div>
          <h1 className="text-[32px] sm:text-[36px] font-bold text-[#0F172A] leading-[1.25] mb-5 tracking-[-0.3px]">
            현장 운영을 위한<br />관리자 전용 로그인
          </h1>
          <p className="text-[15px] text-[#4B5563] leading-[1.85] mb-8">
            오늘 출근 현황, 근로자 승인, 현장 관리를<br />
            한곳에서 확인할 수 있습니다.
          </p>
          <ul className="space-y-3 m-0 p-0 list-none">
            {['오늘 현장별 출근 인원 확인', '근로자 및 기기 승인 처리', '미퇴근 누락 즉시 파악'].map(item => (
              <li key={item} className="flex items-center gap-2.5 text-[14px] text-[#374151]">
                <div className="w-1.5 h-1.5 rounded-full bg-[#F97316] shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* 우: 로그인 카드 */}
        <div className="w-full lg:w-[440px] shrink-0">
          <div className="bg-white rounded-[20px] border border-[#E5E7EB] shadow-[0_4px_24px_rgba(0,0,0,0.06)] px-8 py-9">
            <h2 className="text-[20px] font-semibold text-[#111827] mb-1.5 leading-snug">관리자 로그인</h2>
            <p className="text-[13px] text-[#6B7280] mb-7">관리자 계정으로 로그인하세요.</p>

            {/* 검토용 안내 */}
            <div className="bg-[#FFF7ED] border border-[#FDBA74] rounded-[10px] px-4 py-3 text-[13px] text-[#D97706] mb-5">
              검토용 화면입니다. 실제 로그인은 동작하지 않습니다.
            </div>

            <div className="mb-4">
              <label className="block text-[13px] font-semibold text-[#374151] mb-[6px]">이메일</label>
              <input type="email" defaultValue="admin@company.com" readOnly
                className="w-full h-12 px-4 text-[15px] text-[#111827] bg-[#F9FAFB] border border-[#E5E7EB] rounded-[10px] outline-none" />
            </div>
            <div className="mb-6">
              <label className="block text-[13px] font-semibold text-[#374151] mb-[6px]">비밀번호</label>
              <input type="password" defaultValue="password" readOnly
                className="w-full h-12 px-4 text-[15px] text-[#111827] bg-[#F9FAFB] border border-[#E5E7EB] rounded-[10px] outline-none" />
            </div>

            <Link href="/review/admin/dashboard"
              className="no-underline flex items-center justify-center w-full h-12 text-[15px] font-semibold text-white bg-[#F97316] hover:bg-[#EA580C] rounded-[12px] transition-colors shadow-[0_2px_10px_rgba(249,115,22,0.25)]">
              대시보드 미리보기 →
            </Link>

            <div className="mt-6 flex flex-col items-center gap-2.5 text-[13px] text-[#6B7280]">
              <span className="text-[#9CA3AF]">검토용 페이지 · 운영 경로와 분리됨</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
