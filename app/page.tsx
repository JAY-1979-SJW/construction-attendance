'use client'

import Link from 'next/link'
import BusinessFooter from '@/components/BusinessFooter'
import PublicChatWidget from '@/components/PublicChatWidget'

export default function LandingPage() {
  return (
    <div className="font-sans min-h-screen bg-card text-fore-brand">

      {/* ── 헤더 (오렌지 라인 포함) ───────────────────────── */}
      <header className="sticky top-0 z-50">
        <div className="h-1 bg-brand-accent" />
        <div className="bg-card border-b border-footer">
          <div className="max-w-[1100px] mx-auto px-6 flex items-center justify-between" style={{ height: '60px' }}>
            {/* 로고 */}
            <Link href="/" className="flex items-center gap-2 no-underline">
              <div className="w-8 h-8 bg-accent-light rounded-[9px] flex items-center justify-center shrink-0">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M9 22V12h6v10" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className="text-[15px] font-bold text-title-brand">해한<span className="text-accent">AI</span> 출퇴근</span>
            </Link>

            {/* 네비게이션 */}
            <nav className="flex items-center gap-2">
              <Link href="/guide" className="hidden sm:block text-[13px] text-muted-brand hover:text-fore-brand transition-colors px-3 py-1.5 no-underline">
                둘러보기
              </Link>
              <Link href="/login"
                className="text-[13px] font-medium text-body-brand border border-brand rounded-[8px] px-4 py-[7px] no-underline hover:border-[#D1D5DB] transition-colors">
                로그인
              </Link>
              <Link href="/register"
                className="text-[13px] font-semibold text-white bg-brand-accent hover:bg-brand-accent-hover rounded-[8px] px-4 py-2 no-underline transition-colors">
                무료 시작하기
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* ── 히어로 ──────────────────────────────────────────── */}
      <section className="bg-surface border-b border-footer px-6 pt-16 pb-20">
        <div className="max-w-[1100px] mx-auto flex items-center gap-14 flex-wrap lg:flex-nowrap">

          {/* 좌측: 텍스트 + CTA */}
          <div className="flex-1 min-w-[280px]">
            <div className="inline-block bg-accent-light text-accent text-[12px] font-semibold px-3 py-1 rounded-full mb-5 tracking-wide">
              건설현장 출퇴근 관리
            </div>
            <h1 className="text-[40px] sm:text-[44px] font-bold text-title-brand leading-[1.25] mb-5 tracking-[-0.5px]">
              건설현장 출퇴근을<br />
              단순하고 정확하게<br />
              관리하세요
            </h1>
            <p className="text-[16px] text-body-brand leading-[1.85] mb-8">
              근로자는 빠르게 출퇴근을 기록하고,<br />
              관리자는 현장별 출근 현황과 근무일수를<br />
              한눈에 확인할 수 있습니다.
            </p>
            <div className="flex gap-3 flex-wrap">
              <Link href="/register"
                className="inline-block py-3 px-7 bg-brand-accent hover:bg-brand-accent-hover text-white rounded-[12px] no-underline text-[15px] font-semibold shadow-[0_2px_10px_rgba(249,115,22,0.25)] transition-colors">
                무료 시작하기
              </Link>
              <Link href="/guide"
                className="inline-block py-3 px-7 border border-brand text-body-brand hover:border-[#D1D5DB] bg-card rounded-[12px] no-underline text-[15px] font-medium transition-colors">
                둘러보기
              </Link>
            </div>
          </div>

          {/* 우측: 대시보드 미리보기 */}
          <div className="w-full lg:w-[420px] shrink-0">
            <div className="bg-card rounded-[16px] border border-brand shadow-[0_4px_24px_rgba(0,0,0,0.07)] overflow-hidden">
              {/* 미리보기 상단 */}
              <div className="bg-brand px-5 py-3 flex items-center gap-2 border-b border-brand">
                <div className="w-2.5 h-2.5 rounded-full bg-brand-accent" />
                <span className="text-[12px] text-muted-brand">관리자 대시보드 — 오늘 현황</span>
              </div>
              {/* 수치 요약 */}
              <div className="grid grid-cols-3 border-b border-footer">
                {[
                  { label: '오늘 출근', value: '12명' },
                  { label: '현재 근무중', value: '8명' },
                  { label: '관리 현장', value: '3개' },
                ].map((item) => (
                  <div key={item.label} className="px-4 py-4 border-r border-footer last:border-r-0 text-center">
                    <div className="text-[20px] font-bold text-accent">{item.value}</div>
                    <div className="text-[11px] text-muted2-brand mt-0.5">{item.label}</div>
                  </div>
                ))}
              </div>
              {/* 출근 목록 */}
              <div className="px-5 py-4">
                <div className="text-[12px] font-semibold text-muted-brand mb-3">오늘 출근 기록</div>
                {[
                  { name: '김철수', site: '1공구 현장', time: '08:12', status: '근무중', on: true },
                  { name: '이영희', site: '2공구 현장', time: '08:35', status: '근무중', on: true },
                  { name: '박민준', site: '1공구 현장', time: '09:01', status: '퇴근', on: false },
                ].map((r) => (
                  <div key={r.name} className="flex items-center justify-between py-2.5 border-b border-surface last:border-b-0">
                    <div>
                      <div className="text-[13px] font-medium text-fore-brand">{r.name}</div>
                      <div className="text-[11px] text-muted2-brand">{r.site}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[12px] text-muted-brand">{r.time}</div>
                      <div className={`text-[11px] font-semibold mt-0.5 ${r.on ? 'text-status-working' : 'text-muted2-brand'}`}>
                        {r.status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 왜 필요한가 ─────────────────────────────────────── */}
      <section className="py-20 px-6 bg-surface border-t border-footer">
        <div className="max-w-[960px] mx-auto">
          <div className="text-center mb-5">
            <p className="text-[11px] font-semibold text-accent tracking-[2px] uppercase mb-3">WHY</p>
            <h2 className="text-[28px] sm:text-[32px] font-bold text-title-brand tracking-[-0.3px] leading-[1.35]">
              사업주도, 근로자도<br />안심할 수 있는 현장
            </h2>
          </div>
          <p className="text-center text-[14px] text-muted-brand leading-[1.8] max-w-[640px] mx-auto mb-12">
            정확한 기록은 사업주의 관리 의무를 증명하고, 근로자의 정당한 권리를 보장합니다.<br />
            서로의 권리가 보호될 때, 현장은 더 안전하고 신뢰할 수 있는 곳이 됩니다.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-12">
            {[
              {
                icon: '🛡️',
                title: '안전한 현장 만들기',
                highlight: '사업주의 성실한 관리, 근로자의 안전한 작업',
                desc: '중대재해처벌법 시대, 안전 관리는 선택이 아닌 의무입니다. 체계적인 출퇴근 기록과 안전교육 이력은 사업주가 의무를 다하고 있음을 보여주고, 근로자가 안전한 환경에서 일하고 있음을 확인해줍니다.',
                tag: '산업안전보건법 제38조',
              },
              {
                icon: '🤝',
                title: '서로 신뢰하는 근로 관계',
                highlight: '투명한 기록이 오해를 없앱니다',
                desc: '근로자는 자신의 출퇴근과 공수를 직접 확인할 수 있고, 사업주는 정확한 데이터로 공정하게 정산할 수 있습니다. 서로 확인할 수 있는 기록이 있으면 불필요한 다툼이 사라집니다.',
                tag: '근로기준법 제48조',
              },
              {
                icon: '📊',
                title: '빠짐없는 정산과 신고',
                highlight: '근로자의 권리도, 사업주의 의무도 지켜집니다',
                desc: '정확한 근무일수로 4대보험과 퇴직공제가 빠짐없이 처리됩니다. 근로자는 보험 혜택을 놓치지 않고, 사업주는 신고 누락 걱정 없이 기한 내 처리할 수 있습니다.',
                tag: '고용보험법 제15조',
              },
            ].map(item => (
              <div key={item.title} className="bg-card rounded-[16px] border border-brand p-6 hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all">
                <div className="text-[32px] mb-3">{item.icon}</div>
                <h3 className="text-[16px] font-bold text-fore-brand mb-1">{item.title}</h3>
                <p className="text-[13px] font-semibold text-accent mb-3 m-0">{item.highlight}</p>
                <p className="text-[13px] text-muted-brand leading-[1.75] mb-3 m-0">{item.desc}</p>
                <span className="inline-block text-[11px] text-muted2-brand bg-surface px-2.5 py-1 rounded-full">{item.tag}</span>
              </div>
            ))}
          </div>

          <div className="bg-card rounded-[16px] border border-brand p-7 md:p-8">
            <div className="text-center mb-6">
              <h3 className="text-[18px] font-bold text-fore-brand mb-2">기록 방식에 따라 보호의 수준이 달라집니다</h3>
              <p className="text-[13px] text-muted-brand m-0">사업주와 근로자, 모두를 위한 선택</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#FFF8F0] rounded-xl p-5 border border-[#FFE0B2]">
                <div className="text-[14px] font-bold text-[#E65100] mb-3">수기 출석부</div>
                <ul className="space-y-2 m-0 p-0 list-none text-[13px] text-[#BF360C]">
                  {['대리 서명이 가능해 근로자의 실제 근무를 증명하기 어렵습니다', '분쟁 시 사업주도 근로자도 자신의 주장을 뒷받침하기 힘듭니다', '정산 오류로 근로자가 정당한 임금을 못 받을 수 있습니다', '감독관 점검 시 양측 모두 불이익을 받을 수 있습니다'].map(t => (
                    <li key={t} className="flex items-start gap-2"><span className="shrink-0 mt-0.5 text-[#E65100]">-</span>{t}</li>
                  ))}
                </ul>
              </div>
              <div className="bg-[#F0FAF0] rounded-xl p-5 border border-[#C8E6C9]">
                <div className="text-[14px] font-bold text-[#2E7D32] mb-3">GPS 전자 출퇴근</div>
                <ul className="space-y-2 m-0 p-0 list-none text-[13px] text-[#1B5E20]">
                  {['GPS + 시간 자동 기록으로 사업주와 근로자 모두 증명 가능합니다', '근로자는 본인 기록을 직접 확인하고, 사업주는 투명하게 관리합니다', '자동 집계로 정확한 급여를 보장하고 분쟁을 예방합니다', '법정 서류가 즉시 출력 가능해 점검에도 안심입니다'].map(t => (
                    <li key={t} className="flex items-start gap-2"><span className="shrink-0 mt-0.5 text-[#2E7D32]">+</span>{t}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 핵심 기능 ───────────────────────────────────────── */}
      <section id="features" className="py-20 px-6 bg-card">
        <div className="max-w-[1100px] mx-auto">
          <div className="text-center mb-12">
            <p className="text-[11px] font-semibold text-accent tracking-[2px] uppercase mb-3">핵심 기능</p>
            <h2 className="text-[28px] font-bold text-title-brand tracking-[-0.3px]">꼭 필요한 기능만 담았습니다</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                svg: <><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="9" r="2.5" stroke="#F97316" strokeWidth="2"/></>,
                title: 'GPS 기반 출퇴근 기록',
                desc: '현장 위치 기준으로 출근, 이동, 퇴근 기록을 남길 수 있습니다.',
              },
              {
                svg: <><rect x="3" y="3" width="18" height="18" rx="3" stroke="#F97316" strokeWidth="2"/><path d="M8 12h8M8 8h8M8 16h5" stroke="#F97316" strokeWidth="2" strokeLinecap="round"/></>,
                title: '현장별 출근 현황 확인',
                desc: '관리자는 날짜와 현장 기준으로 현재 근무 중인 인원을 확인할 수 있습니다.',
              },
              {
                svg: <><path d="M21 21H4.6A1.6 1.6 0 013 19.4V3" stroke="#F97316" strokeWidth="2" strokeLinecap="round"/><path d="M7 16l4-4 3 3 5-6" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></>,
                title: '근무일수 자동 집계',
                desc: '출퇴근 기록을 기준으로 근무일수와 월별 현황을 확인할 수 있습니다.',
              },
              {
                svg: <><path d="M9 12l2 2 4-4" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 3a9 9 0 100 18A9 9 0 0012 3z" stroke="#F97316" strokeWidth="2"/></>,
                title: '관리자 승인 및 운영 관리',
                desc: '근로자, 현장, 승인 대기 항목을 한 화면에서 관리할 수 있습니다.',
              },
            ].map((f) => (
              <div key={f.title} className="bg-surface rounded-[14px] border border-footer p-6 hover:border-brand hover:shadow-[0_2px_8px_rgba(0,0,0,0.05)] transition-all">
                <div className="w-10 h-10 bg-accent-light rounded-[10px] flex items-center justify-center mb-4">
                  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">{f.svg}</svg>
                </div>
                <h3 className="text-[14px] font-semibold text-fore-brand mb-2 leading-snug">{f.title}</h3>
                <p className="text-[13px] text-muted-brand leading-[1.7] m-0">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 사용 대상 ───────────────────────────────────────── */}
      <section className="py-20 px-6 bg-surface border-t border-footer">
        <div className="max-w-[860px] mx-auto">
          <div className="text-center mb-12">
            <p className="text-[11px] font-semibold text-accent tracking-[2px] uppercase mb-3">사용 대상</p>
            <h2 className="text-[28px] font-bold text-title-brand tracking-[-0.3px]">누가 사용하는 서비스인가요?</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* 근로자 카드 */}
            <div className="bg-card rounded-[16px] border border-brand p-7 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-accent-light rounded-[10px] flex items-center justify-center shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="8" r="4" stroke="#F97316" strokeWidth="2"/>
                    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#F97316" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>
                <div>
                  <div className="text-[15px] font-bold text-fore-brand">근로자</div>
                  <div className="text-[12px] text-muted2-brand">현장에서 일하는 직원</div>
                </div>
              </div>
              <ul className="space-y-2.5 m-0 p-0 list-none mb-6">
                {['빠른 출근 / 퇴근 기록', '내 출근 기록 확인', '현장 이동 기록', '월별 근무일수 조회'].map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-[14px] text-body-brand">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-accent shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/register"
                className="block text-center py-2.5 bg-brand-accent hover:bg-brand-accent-hover text-white text-[14px] font-semibold rounded-[9px] no-underline transition-colors">
                무료 가입하기
              </Link>
            </div>

            {/* 관리자 카드 */}
            <div className="bg-card rounded-[16px] border border-brand p-7 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-green-light rounded-[10px] flex items-center justify-center shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <rect x="2" y="7" width="20" height="14" rx="3" stroke="#16A34A" strokeWidth="2"/>
                    <path d="M16 7V5a4 4 0 00-8 0v2" stroke="#16A34A" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>
                <div>
                  <div className="text-[15px] font-bold text-fore-brand">관리자</div>
                  <div className="text-[12px] text-muted2-brand">현장 및 운영 담당자</div>
                </div>
              </div>
              <ul className="space-y-2.5 m-0 p-0 list-none mb-6">
                {['오늘 출근 현황 확인', '근로자 관리 및 승인', '현장별 인원 관리', '월별 근무일수 집계'].map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-[14px] text-body-brand">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#16A34A] shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/login"
                className="block text-center py-2.5 border border-brand hover:border-[#D1D5DB] text-body-brand text-[14px] font-medium rounded-[9px] no-underline transition-colors">
                로그인
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* ── 하단 CTA ────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-accent-light border-t border-accent-pale text-center">
        <div className="max-w-[560px] mx-auto">
          <h2 className="text-[28px] sm:text-[30px] font-bold text-title-brand mb-4 leading-[1.35]">
            현장 출퇴근 관리를<br />바로 시작해보세요
          </h2>
          <p className="text-[15px] text-muted-brand mb-8 leading-[1.7]">
            스마트폰 브라우저로 별도 설치 없이 바로 사용할 수 있습니다.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/register"
              className="inline-block py-3 px-7 bg-brand-accent hover:bg-brand-accent-hover text-white rounded-[10px] no-underline text-[15px] font-semibold transition-colors shadow-[0_2px_10px_rgba(249,115,22,0.25)]">
              무료 시작하기
            </Link>
            <Link href="/guide"
              className="inline-block py-3 px-7 border border-brand bg-card text-body-brand hover:border-[#D1D5DB] rounded-[12px] no-underline text-[15px] font-medium transition-colors">
              둘러보기
            </Link>
          </div>
        </div>
      </section>

      {/* ── 푸터 ────────────────────────────────────────────── */}
      <footer className="bg-surface border-t border-brand px-6 py-7">
        <div className="max-w-[1100px] mx-auto flex flex-col gap-5">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-accent-light rounded-[6px] flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M9 22V12h6v10" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className="text-[14px] font-semibold text-title-brand">해한<span className="text-accent">AI</span> 출퇴근</span>
            </div>
            <div className="flex items-center gap-5 text-[13px] text-muted2-brand flex-wrap justify-center">
              <Link href="/guide" className="no-underline hover:text-muted-brand transition-colors">둘러보기</Link>
              <Link href="/login" className="no-underline hover:text-muted-brand transition-colors">로그인</Link>
            </div>
          </div>
        </div>
      </footer>
      <BusinessFooter />
      <PublicChatWidget />

    </div>
  )
}
