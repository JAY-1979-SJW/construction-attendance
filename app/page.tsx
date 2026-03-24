'use client'

import Link from 'next/link'
import Image from 'next/image'

export default function LandingPage() {
  return (
    <div className="font-sans text-white bg-brand min-h-screen">

      {/* ── 헤더 ───────────────────────────────────────── */}
      <header className="bg-card sticky top-0 z-[100] shadow-[0_2px_16px_rgba(0,0,0,0.3)]">
        <div className="max-w-[1100px] mx-auto px-6 h-16 flex items-center justify-between">
          {/* 브랜드 로고 */}
          <Link href="/" className="flex items-center no-underline">
            <Image
              src="/logo/logo_main.png"
              alt="해한Ai Engineering"
              width={120}
              height={90}
              className="h-12 w-auto rounded-lg"
              priority
            />
          </Link>

          {/* 네비게이션 */}
          <nav className="flex items-center gap-2">
            <Link href="/guide"
              className="text-muted-brand no-underline text-sm px-3 py-1.5 rounded-md transition-colors hover:text-white">
              사용 가이드
            </Link>
            <Link href="/register"
              className="text-muted-brand no-underline text-sm px-3 py-1.5 rounded-md transition-colors hover:text-white">
              회원가입
            </Link>
            <Link href="/login"
              className="py-[7px] px-4 border border-brand-secondary text-secondary-brand rounded-lg no-underline text-sm font-semibold">
              로그인
            </Link>
            <Link href="/attendance"
              className="py-2 px-[18px] bg-brand-accent text-white rounded-lg no-underline text-sm font-bold">
              앱 시작하기
            </Link>
            <Link href="/admin/login"
              className="py-[7px] px-[14px] bg-brand text-muted-brand border border-[#374558] rounded-lg no-underline text-[13px]">
              관리자
            </Link>
          </nav>
        </div>
        {/* 브랜드 하단 라인 */}
        <div className="h-[3px] bg-brand-accent" />
      </header>

      {/* ── 히어로 ─────────────────────────────────────── */}
      <section className="bg-[linear-gradient(160deg,#0d1b2a_0%,#1B2838_45%,#1a3148_100%)] px-6 pt-[100px] pb-20 text-center border-b border-[#2a3f5a]">
        <div className="max-w-[720px] mx-auto">
          {/* 중앙 로고 */}
          <div className="mb-9">
            <Image
              src="/logo/logo_main.png"
              alt="해한Ai Engineering"
              width={320}
              height={240}
              className="w-[280px] h-auto mx-auto block rounded-3xl"
              priority
            />
          </div>

          <div className="inline-block bg-[rgba(244,121,32,0.15)] border border-[rgba(244,121,32,0.4)] text-accent rounded-[20px] px-[18px] py-1.5 text-[13px] font-semibold mb-7 tracking-[0.5px]">
            건설현장 출퇴근 관리 솔루션
          </div>
          <h1 className="text-[52px] font-black leading-[1.2] mb-5 tracking-[-1.5px]">
            현장 어디서든<br />
            <span className="text-accent">GPS 출퇴근</span>, 한 번으로 끝
          </h1>
          <p className="text-lg text-muted-brand leading-[1.8] mb-10">
            스마트폰 위치 인식으로 출근·이동·퇴근을 자동 기록합니다.<br />
            별도 장비 없이 지금 바로 도입하세요.
          </p>
          <div className="flex gap-[14px] justify-center flex-wrap mb-14">
            <Link href="/attendance"
              className="inline-block py-4 px-10 bg-brand-accent text-white rounded-[10px] no-underline text-base font-bold shadow-[0_4px_16px_rgba(244,121,32,0.4)]">
              앱 체험하기
            </Link>
            <Link href="/guide"
              className="inline-block py-[15px] px-10 border-2 border-brand-secondary text-secondary-brand rounded-[10px] no-underline text-base font-semibold">
              사용법 보기
            </Link>
          </div>

          {/* 통계 배지 */}
          <div className="flex justify-center bg-[rgba(255,255,255,0.05)] border border-[rgba(91,164,217,0.15)] rounded-2xl overflow-hidden">
            {[
              { num: 'GPS', label: '기반 출퇴근' },
              { num: '실시간', label: '현황 확인' },
              { num: '자동', label: '퇴근 처리' },
              { num: '무료', label: '도입 상담' },
            ].map((item) => (
              <div key={item.label}
                className="flex-1 py-5 px-4 flex flex-col items-center gap-1 border-r border-[rgba(91,164,217,0.12)] last:border-r-0">
                <span className="text-[22px] font-extrabold text-accent">{item.num}</span>
                <span className="text-xs text-muted-brand">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 핵심 기능 ───────────────────────────────────── */}
      <section className="py-20 px-6 bg-brand">
        <div className="max-w-[1100px] mx-auto">
          <p className="text-[13px] font-bold text-accent tracking-[1.5px] uppercase text-center mb-3">핵심 기능</p>
          <h2 className="text-[36px] font-extrabold text-center mb-4 tracking-[-0.5px]">현장 관리를 더 스마트하게</h2>
          <p className="text-base text-muted-brand text-center mb-14 leading-[1.7]">
            복잡한 종이 대장·수기 기록 없이 스마트폰 하나로 모든 출퇴근을 관리합니다.
          </p>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-5">
            {[
              {
                icon: '📍',
                color: '#F47920',
                title: 'GPS 출퇴근',
                desc: '현장 반경 안에서만 출퇴근 가능. 위치 조작·대리 출퇴근을 원천 차단합니다.',
              },
              {
                icon: '🔒',
                color: '#5BA4D9',
                title: '관리자 승인 방식',
                desc: '승인된 기기·근로자만 사용 가능. 보안이 검증된 인력만 현장에 접근합니다.',
              },
              {
                icon: '📊',
                color: '#4CAF50',
                title: '실시간 현황 대시보드',
                desc: '관리자는 현재 출근 인원을 언제 어디서나 실시간으로 파악할 수 있습니다.',
              },
              {
                icon: '🔄',
                color: '#AB47BC',
                title: '자동 미퇴근 처리',
                desc: '퇴근 버튼 미입력 시 다음날 자동으로 미퇴근 처리. 누락 없는 기록 관리.',
              },
              {
                icon: '🚶',
                color: '#26C6DA',
                title: '현장 간 이동 기록',
                desc: '여러 현장을 오가는 경우 이동 기록도 시간 순서대로 자동 저장됩니다.',
              },
              {
                icon: '📱',
                color: '#FF7043',
                title: 'PWA 앱 설치',
                desc: '앱 스토어 없이 홈 화면에 바로 추가. Android·iOS 모두 지원합니다.',
              },
            ].map((f) => (
              <div key={f.title}
                className="bg-card rounded-2xl p-8 border border-[rgba(91,164,217,0.12)] transition-transform duration-200 hover:-translate-y-0.5">
                <div
                  className="w-[52px] h-[52px] rounded-[14px] flex items-center justify-center mb-[18px]"
                  style={{ background: f.color + '22', border: `1px solid ${f.color}44` }}
                >
                  <span className="text-2xl">{f.icon}</span>
                </div>
                <h3 className="text-[17px] font-bold mb-2.5">{f.title}</h3>
                <p className="text-sm text-muted-brand leading-[1.7] m-0">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 사용 방법 ───────────────────────────────────── */}
      <section className="py-20 px-6 bg-brand-dark">
        <div className="max-w-[1100px] mx-auto">
          <p className="text-[13px] font-bold text-accent tracking-[1.5px] uppercase text-center mb-3">4단계 프로세스</p>
          <h2 className="text-[36px] font-extrabold text-center mb-4 tracking-[-0.5px]">이렇게 사용하세요</h2>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-6 relative mt-12">
            {[
              { num: '01', icon: '📱', title: '회원가입 & 승인', desc: '이름·연락처·직종으로 가입 후\n관리자 승인을 받으세요.' },
              { num: '02', icon: '📍', title: 'GPS 출근',        desc: '현장 반경 안에서\n출근 버튼 한 번으로 기록 완료.' },
              { num: '03', icon: '🚶', title: '현장 이동 (선택)', desc: '다른 현장으로 이동 시\n이동 버튼을 눌러 추가 기록.' },
              { num: '04', icon: '🏠', title: 'GPS 퇴근',        desc: '업무 종료 후 반드시\n퇴근 버튼을 눌러 마무리.' },
            ].map((step, i) => (
              <div key={step.num}
                className="bg-brand rounded-2xl p-8 px-6 text-center border border-[rgba(91,164,217,0.12)] relative">
                {/* 연결선 (마지막 제외) — hidden by default */}
                {i < 3 && <div className="hidden" />}
                <div className="inline-block bg-[rgba(244,121,32,0.15)] border border-brand-accent text-accent rounded-lg py-1 px-3 text-xs font-black tracking-[1px] mb-4">
                  {step.num}
                </div>
                <div className="text-[40px] mb-4">{step.icon}</div>
                <h3 className="text-base font-bold mb-2.5">{step.title}</h3>
                <p className="text-[13px] text-muted-brand leading-[1.7] whitespace-pre-line m-0">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 수치 실적 ───────────────────────────────────── */}
      <section className="py-20 px-6 bg-brand border-t border-[rgba(91,164,217,0.12)] border-b border-b-[rgba(91,164,217,0.12)]">
        <div className="max-w-[1100px] mx-auto grid grid-cols-2 gap-[60px] items-center">
          <div>
            <p className="text-[13px] font-bold text-accent tracking-[1.5px] uppercase text-left mb-3">도입 효과</p>
            <h2 className="text-[36px] font-extrabold text-left mb-5 tracking-[-0.5px]">
              현장 관리 시간<br />
              <span className="text-accent">70% 절감</span>
            </h2>
            <p className="text-muted-brand leading-[1.8] text-base">
              수기 대장 정리, 전화 확인, 출퇴근 집계에 쏟던 시간을<br />
              실제 현장 관리에 집중하세요.
            </p>
            <Link href="/register"
              className="inline-block py-4 px-10 bg-brand-accent text-white rounded-[10px] no-underline text-base font-bold shadow-[0_4px_16px_rgba(244,121,32,0.4)] mt-7">
              지금 무료로 시작하기
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { num: '0원',  label: '기본 사용 비용' },
              { num: '5분',  label: '평균 도입 시간' },
              { num: '100%', label: '수기 대장 대체율' },
              { num: '24/7', label: '실시간 현황 확인' },
            ].map((stat) => (
              <div key={stat.label}
                className="bg-card border border-[rgba(91,164,217,0.15)] rounded-2xl py-7 px-5 text-center">
                <div className="text-[32px] font-black text-accent mb-2">{stat.num}</div>
                <div className="text-[13px] text-muted-brand">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 확인 사항 ───────────────────────────────────── */}
      <section className="py-20 px-6 bg-brand-dark">
        <div className="max-w-[1100px] mx-auto">
          <p className="text-[13px] font-bold text-accent tracking-[1.5px] uppercase text-center mb-3">시작 전 확인</p>
          <h2 className="text-[36px] font-extrabold text-center mb-4 tracking-[-0.5px]">꼭 확인하세요</h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4 mt-12">
            {[
              { icon: '📡', title: 'GPS 권한 허용',  desc: '스마트폰 위치 권한을 허용해야 출퇴근 기록이 가능합니다.' },
              { icon: '✅', title: '기기 등록 승인',  desc: '최초 1회 관리자의 기기 승인이 필요합니다. 미승인 기기는 사용 불가.' },
              { icon: '⏰', title: '퇴근 버튼 필수',  desc: '퇴근 버튼을 누르지 않으면 자동으로 미퇴근 처리됩니다.' },
              { icon: '📞', title: '문제 발생 시',    desc: '오류나 문제가 생기면 즉시 현장 관리자에게 알려주세요.' },
            ].map((n) => (
              <div key={n.title}
                className="flex gap-4 items-start bg-brand border border-[rgba(91,164,217,0.15)] rounded-[14px] py-[22px] px-5">
                <div className="w-11 h-11 bg-[rgba(244,121,32,0.12)] rounded-xl flex items-center justify-center text-xl shrink-0">
                  {n.icon}
                </div>
                <div>
                  <div className="text-[15px] font-bold mb-1.5">{n.title}</div>
                  <div className="text-[13px] text-muted-brand leading-[1.6]">{n.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────── */}
      <section className="bg-[linear-gradient(135deg,#0d1b2a_0%,#1a2c42_100%)] py-[100px] px-6 text-center">
        <div className="max-w-[680px] mx-auto">
          <p className="text-[13px] font-bold tracking-[1.5px] uppercase text-center mb-3 text-[rgba(255,255,255,0.6)]">
            지금 바로 시작
          </p>
          <h2 className="text-[44px] font-black leading-[1.2] my-3 mb-5 tracking-[-1px]">
            현장 출퇴근 관리,<br />
            <span className="text-accent">5분 안에 도입</span>하세요
          </h2>
          <p className="text-base text-[rgba(255,255,255,0.6)] mb-10 leading-[1.7]">
            별도 설치 없이 스마트폰 브라우저로 바로 사용 가능합니다.
          </p>
          <div className="flex gap-[14px] justify-center flex-wrap">
            <Link href="/register"
              className="inline-block py-4 px-10 bg-brand-accent text-white rounded-[10px] no-underline text-base font-bold shadow-[0_4px_16px_rgba(244,121,32,0.4)]">
              지금 회원가입
            </Link>
            <Link href="/attendance"
              className="inline-block py-[15px] px-10 border-2 border-[rgba(255,255,255,0.4)] text-[rgba(255,255,255,0.85)] rounded-[10px] no-underline text-base font-semibold">
              앱 미리보기
            </Link>
          </div>
        </div>
      </section>

      {/* ── 푸터 ────────────────────────────────────────── */}
      <footer className="bg-footer border-top-accent">
        <div className="max-w-[1100px] mx-auto px-6 pt-12 pb-8">
          <div className="flex justify-between items-start flex-wrap gap-8 mb-8">
            <div className="text-xl font-extrabold text-white">
              해한<span className="text-accent">Ai</span> Engineering
              <p className="text-[13px] text-secondary-brand font-normal mt-1.5 mb-0">Transforming the World with Ai</p>
            </div>
            <div className="flex gap-6 flex-wrap items-center">
              <Link href="/guide"      className="text-muted-brand no-underline text-sm">사용 가이드</Link>
              <Link href="/register"   className="text-muted-brand no-underline text-sm">회원가입</Link>
              <Link href="/login"      className="text-muted-brand no-underline text-sm">로그인</Link>
              <Link href="/admin/login" className="text-muted-brand no-underline text-sm">관리자</Link>
            </div>
          </div>
          <div className="h-px bg-[rgba(255,255,255,0.08)] mb-6" />
          <div className="flex justify-between items-center text-[13px] text-muted-brand flex-wrap gap-2">
            <span>© 2026 해한Ai Engineering. All rights reserved.</span>
            <span className="text-secondary-brand text-xs">건설현장 출퇴근 관리 시스템</span>
          </div>
        </div>
      </footer>

    </div>
  )
}
