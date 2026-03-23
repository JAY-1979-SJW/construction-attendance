'use client'

import Link from 'next/link'
import Image from 'next/image'

export default function LandingPage() {
  return (
    <div style={s.root}>

      {/* ── 헤더 ───────────────────────────────────────── */}
      <header style={s.header}>
        <div style={s.headerInner}>
          {/* 브랜드 로고 */}
          <Link href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            <Image
              src="/logo/logo_main.png"
              alt="해한Ai Engineering"
              width={120}
              height={90}
              style={{ height: '48px', width: 'auto', borderRadius: '8px' }}
              priority
            />
          </Link>

          {/* 네비게이션 */}
          <nav style={s.nav}>
            <Link href="/guide"       style={s.navLink}>사용 가이드</Link>
            <Link href="/register"    style={s.navLink}>회원가입</Link>
            <Link href="/login"       style={s.navBtnOutline}>로그인</Link>
            <Link href="/attendance"  style={s.navBtnPrimary}>앱 시작하기</Link>
            <Link href="/admin/login" style={s.navBtnAdmin}>관리자</Link>
          </nav>
        </div>
        {/* 브랜드 하단 라인 */}
        <div style={s.headerLine} />
      </header>

      {/* ── 히어로 ─────────────────────────────────────── */}
      <section style={s.hero}>
        <div style={s.heroInner}>
          {/* 중앙 로고 */}
          <div style={{ marginBottom: '36px' }}>
            <Image
              src="/logo/logo_main.png"
              alt="해한Ai Engineering"
              width={320}
              height={240}
              style={{ width: '280px', height: 'auto', margin: '0 auto', display: 'block', borderRadius: '24px' }}
              priority
            />
          </div>

          <div style={s.badge}>건설현장 출퇴근 관리 솔루션</div>
          <h1 style={s.heroTitle}>
            현장 어디서든<br />
            <span style={s.heroAccent}>GPS 출퇴근</span>, 한 번으로 끝
          </h1>
          <p style={s.heroDesc}>
            스마트폰 위치 인식으로 출근·이동·퇴근을 자동 기록합니다.<br />
            별도 장비 없이 지금 바로 도입하세요.
          </p>
          <div style={s.heroBtns}>
            <Link href="/attendance"  style={s.btnPrimary}>앱 체험하기</Link>
            <Link href="/guide"       style={s.btnOutline}>사용법 보기</Link>
          </div>

          {/* 통계 배지 */}
          <div style={s.statBar}>
            {[
              { num: 'GPS', label: '기반 출퇴근' },
              { num: '실시간', label: '현황 확인' },
              { num: '자동', label: '퇴근 처리' },
              { num: '무료', label: '도입 상담' },
            ].map((item) => (
              <div key={item.label} style={s.statItem}>
                <span style={s.statNum}>{item.num}</span>
                <span style={s.statLabel}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 핵심 기능 ───────────────────────────────────── */}
      <section style={s.section}>
        <div style={s.sectionInner}>
          <p style={s.sectionEyebrow}>핵심 기능</p>
          <h2 style={s.sectionTitle}>현장 관리를 더 스마트하게</h2>
          <p style={s.sectionDesc}>복잡한 종이 대장·수기 기록 없이 스마트폰 하나로 모든 출퇴근을 관리합니다.</p>

          <div style={s.cardGrid}>
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
              <div key={f.title} style={s.featureCard}>
                <div style={{ ...s.featureIconWrap, background: f.color + '22', border: `1px solid ${f.color}44` }}>
                  <span style={s.featureIconText}>{f.icon}</span>
                </div>
                <h3 style={s.featureTitle}>{f.title}</h3>
                <p style={s.featureDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 사용 방법 ───────────────────────────────────── */}
      <section style={{ ...s.section, background: '#141E2A' }}>
        <div style={s.sectionInner}>
          <p style={s.sectionEyebrow}>4단계 프로세스</p>
          <h2 style={s.sectionTitle}>이렇게 사용하세요</h2>

          <div style={s.stepGrid}>
            {[
              { num: '01', icon: '📱', title: '회원가입 & 승인', desc: '이름·연락처·직종으로 가입 후\n관리자 승인을 받으세요.' },
              { num: '02', icon: '📍', title: 'GPS 출근', desc: '현장 반경 안에서\n출근 버튼 한 번으로 기록 완료.' },
              { num: '03', icon: '🚶', title: '현장 이동 (선택)', desc: '다른 현장으로 이동 시\n이동 버튼을 눌러 추가 기록.' },
              { num: '04', icon: '🏠', title: 'GPS 퇴근', desc: '업무 종료 후 반드시\n퇴근 버튼을 눌러 마무리.' },
            ].map((step, i) => (
              <div key={step.num} style={s.stepCard}>
                {/* 연결선 (마지막 제외) */}
                {i < 3 && <div style={s.stepLine} />}
                <div style={s.stepNumBadge}>{step.num}</div>
                <div style={s.stepIconWrap}>{step.icon}</div>
                <h3 style={s.stepTitle}>{step.title}</h3>
                <p style={s.stepDesc}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 수치 실적 ───────────────────────────────────── */}
      <section style={s.trustSection}>
        <div style={s.sectionInner}>
          <div style={s.trustGrid}>
            <div style={s.trustLeft}>
              <p style={{ ...s.sectionEyebrow, textAlign: 'left' }}>도입 효과</p>
              <h2 style={{ ...s.sectionTitle, textAlign: 'left', marginBottom: '20px' }}>
                현장 관리 시간<br />
                <span style={s.heroAccent}>70% 절감</span>
              </h2>
              <p style={{ color: '#A0AEC0', lineHeight: 1.8, fontSize: '16px' }}>
                수기 대장 정리, 전화 확인, 출퇴근 집계에 쏟던 시간을<br />
                실제 현장 관리에 집중하세요.
              </p>
              <Link href="/register" style={{ ...s.btnPrimary, display: 'inline-block', marginTop: '28px' }}>
                지금 무료로 시작하기
              </Link>
            </div>
            <div style={s.trustRight}>
              {[
                { num: '0원', label: '기본 사용 비용' },
                { num: '5분', label: '평균 도입 시간' },
                { num: '100%', label: '수기 대장 대체율' },
                { num: '24/7', label: '실시간 현황 확인' },
              ].map((stat) => (
                <div key={stat.label} style={s.trustCard}>
                  <div style={s.trustNum}>{stat.num}</div>
                  <div style={s.trustLabel}>{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 확인 사항 ───────────────────────────────────── */}
      <section style={{ ...s.section, background: '#141E2A' }}>
        <div style={s.sectionInner}>
          <p style={s.sectionEyebrow}>시작 전 확인</p>
          <h2 style={s.sectionTitle}>꼭 확인하세요</h2>
          <div style={s.noticeGrid}>
            {[
              { icon: '📡', title: 'GPS 권한 허용', desc: '스마트폰 위치 권한을 허용해야 출퇴근 기록이 가능합니다.' },
              { icon: '✅', title: '기기 등록 승인', desc: '최초 1회 관리자의 기기 승인이 필요합니다. 미승인 기기는 사용 불가.' },
              { icon: '⏰', title: '퇴근 버튼 필수', desc: '퇴근 버튼을 누르지 않으면 자동으로 미퇴근 처리됩니다.' },
              { icon: '📞', title: '문제 발생 시', desc: '오류나 문제가 생기면 즉시 현장 관리자에게 알려주세요.' },
            ].map((n) => (
              <div key={n.title} style={s.noticeCard}>
                <div style={s.noticeIconCircle}>{n.icon}</div>
                <div>
                  <div style={s.noticeTitle}>{n.title}</div>
                  <div style={s.noticeDesc}>{n.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────── */}
      <section style={s.cta}>
        <div style={s.ctaInner}>
          <p style={{ ...s.sectionEyebrow, color: 'rgba(255,255,255,0.6)' }}>지금 바로 시작</p>
          <h2 style={s.ctaTitle}>
            현장 출퇴근 관리,<br />
            <span style={s.heroAccent}>5분 안에 도입</span>하세요
          </h2>
          <p style={s.ctaDesc}>별도 설치 없이 스마트폰 브라우저로 바로 사용 가능합니다.</p>
          <div style={s.heroBtns}>
            <Link href="/register"   style={s.btnPrimary}>지금 회원가입</Link>
            <Link href="/attendance" style={{ ...s.btnOutline, borderColor: 'rgba(255,255,255,0.4)', color: 'rgba(255,255,255,0.85)' }}>앱 미리보기</Link>
          </div>
        </div>
      </section>

      {/* ── 푸터 ────────────────────────────────────────── */}
      <footer style={s.footer}>
        <div style={s.footerInner}>
          <div style={s.footerTop}>
            <div style={s.footerBrand}>
              해한<span style={s.logoAi}>Ai</span> Engineering
              <p style={s.footerTagline}>Transforming the World with Ai</p>
            </div>
            <div style={s.footerLinks}>
              <Link href="/guide"      style={s.footerLink}>사용 가이드</Link>
              <Link href="/register"   style={s.footerLink}>회원가입</Link>
              <Link href="/login"      style={s.footerLink}>로그인</Link>
              <Link href="/admin/login" style={s.footerLink}>관리자</Link>
            </div>
          </div>
          <div style={s.footerDivider} />
          <div style={s.footerBottom}>
            <span>© 2026 해한Ai Engineering. All rights reserved.</span>
            <span style={{ color: '#5BA4D9', fontSize: '12px' }}>건설현장 출퇴근 관리 시스템</span>
          </div>
        </div>
      </footer>

    </div>
  )
}

// ── 스타일 ─────────────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  root: {
    fontFamily: "'Pretendard', 'Pretendard Variable', 'Malgun Gothic', system-ui, sans-serif",
    color: '#ffffff',
    background: '#1B2838',
    minHeight: '100vh',
  },

  // ── 헤더
  header: {
    background: '#243144',
    position: 'sticky' as const,
    top: 0,
    zIndex: 100,
    boxShadow: '0 2px 16px rgba(0,0,0,0.3)',
  },
  headerInner: {
    maxWidth: '1100px',
    margin: '0 auto',
    padding: '0 24px',
    height: '64px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLine: {
    height: '3px',
    background: '#F47920',
  },
  logo: {
    fontSize: '20px',
    fontWeight: 800,
    color: '#ffffff',
    letterSpacing: '-0.5px',
  },
  logoAi: {
    color: '#F47920',
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  navLink: {
    color: '#A0AEC0',
    textDecoration: 'none',
    fontSize: '14px',
    padding: '6px 12px',
    borderRadius: '6px',
    transition: 'color 0.2s',
  },
  navBtnOutline: {
    padding: '7px 16px',
    border: '1px solid #5BA4D9',
    color: '#5BA4D9',
    borderRadius: '8px',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: 600,
  },
  navBtnPrimary: {
    padding: '8px 18px',
    background: '#F47920',
    color: 'white',
    borderRadius: '8px',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: 700,
  },
  navBtnAdmin: {
    padding: '7px 14px',
    background: '#1B2838',
    color: '#A0AEC0',
    border: '1px solid #374558',
    borderRadius: '8px',
    textDecoration: 'none',
    fontSize: '13px',
  },

  // ── 히어로
  hero: {
    background: 'linear-gradient(160deg, #0d1b2a 0%, #1B2838 45%, #1a3148 100%)',
    padding: '100px 24px 80px',
    textAlign: 'center' as const,
    borderBottom: '1px solid #2a3f5a',
  },
  heroInner: {
    maxWidth: '720px',
    margin: '0 auto',
  },
  badge: {
    display: 'inline-block',
    background: 'rgba(244,121,32,0.15)',
    border: '1px solid rgba(244,121,32,0.4)',
    color: '#F47920',
    borderRadius: '20px',
    padding: '6px 18px',
    fontSize: '13px',
    fontWeight: 600,
    marginBottom: '28px',
    letterSpacing: '0.5px',
  },
  heroTitle: {
    fontSize: '52px',
    fontWeight: 900,
    lineHeight: 1.2,
    margin: '0 0 20px',
    letterSpacing: '-1.5px',
  },
  heroAccent: {
    color: '#F47920',
  },
  heroDesc: {
    fontSize: '18px',
    color: '#A0AEC0',
    lineHeight: 1.8,
    margin: '0 0 40px',
  },
  heroBtns: {
    display: 'flex',
    gap: '14px',
    justifyContent: 'center',
    flexWrap: 'wrap' as const,
    marginBottom: '56px',
  },
  btnPrimary: {
    display: 'inline-block',
    padding: '16px 40px',
    background: '#F47920',
    color: 'white',
    borderRadius: '10px',
    textDecoration: 'none',
    fontSize: '16px',
    fontWeight: 700,
    boxShadow: '0 4px 16px rgba(244,121,32,0.4)',
  },
  btnOutline: {
    display: 'inline-block',
    padding: '15px 40px',
    border: '2px solid #5BA4D9',
    color: '#5BA4D9',
    borderRadius: '10px',
    textDecoration: 'none',
    fontSize: '16px',
    fontWeight: 600,
  },
  statBar: {
    display: 'flex',
    justifyContent: 'center',
    gap: '0',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(91,164,217,0.15)',
    borderRadius: '16px',
    overflow: 'hidden',
  },
  statItem: {
    flex: 1,
    padding: '20px 16px',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '4px',
    borderRight: '1px solid rgba(91,164,217,0.12)',
  },
  statNum: {
    fontSize: '22px',
    fontWeight: 800,
    color: '#F47920',
  },
  statLabel: {
    fontSize: '12px',
    color: '#A0AEC0',
  },

  // ── 섹션 공통
  section: {
    padding: '80px 24px',
    background: '#1B2838',
  },
  sectionInner: {
    maxWidth: '1100px',
    margin: '0 auto',
  },
  sectionEyebrow: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#F47920',
    letterSpacing: '1.5px',
    textTransform: 'uppercase' as const,
    textAlign: 'center' as const,
    marginBottom: '12px',
  },
  sectionTitle: {
    fontSize: '36px',
    fontWeight: 800,
    textAlign: 'center' as const,
    margin: '0 0 16px',
    letterSpacing: '-0.5px',
  },
  sectionDesc: {
    fontSize: '16px',
    color: '#A0AEC0',
    textAlign: 'center' as const,
    margin: '0 0 56px',
    lineHeight: 1.7,
  },

  // ── 기능 카드
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '20px',
  },
  featureCard: {
    background: '#243144',
    borderRadius: '16px',
    padding: '32px 28px',
    border: '1px solid rgba(91,164,217,0.12)',
    transition: 'transform 0.2s',
  },
  featureIconWrap: {
    width: '52px',
    height: '52px',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '18px',
  },
  featureIconText: {
    fontSize: '24px',
  },
  featureTitle: {
    fontSize: '17px',
    fontWeight: 700,
    marginBottom: '10px',
    margin: '0 0 10px',
  },
  featureDesc: {
    fontSize: '14px',
    color: '#A0AEC0',
    lineHeight: 1.7,
    margin: 0,
  },

  // ── 스텝
  stepGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '24px',
    position: 'relative' as const,
    marginTop: '48px',
  },
  stepCard: {
    background: '#1B2838',
    borderRadius: '16px',
    padding: '32px 24px',
    textAlign: 'center' as const,
    border: '1px solid rgba(91,164,217,0.12)',
    position: 'relative' as const,
  },
  stepLine: {
    display: 'none',
  },
  stepNumBadge: {
    display: 'inline-block',
    background: 'rgba(244,121,32,0.15)',
    border: '1px solid #F47920',
    color: '#F47920',
    borderRadius: '8px',
    padding: '4px 12px',
    fontSize: '12px',
    fontWeight: 800,
    letterSpacing: '1px',
    marginBottom: '16px',
  },
  stepIconWrap: {
    fontSize: '40px',
    marginBottom: '16px',
  },
  stepTitle: {
    fontSize: '16px',
    fontWeight: 700,
    margin: '0 0 10px',
  },
  stepDesc: {
    fontSize: '13px',
    color: '#A0AEC0',
    lineHeight: 1.7,
    whiteSpace: 'pre-line' as const,
    margin: 0,
  },

  // ── 실적 섹션
  trustSection: {
    padding: '80px 24px',
    background: '#1B2838',
    borderTop: '1px solid rgba(91,164,217,0.12)',
    borderBottom: '1px solid rgba(91,164,217,0.12)',
  },
  trustGrid: {
    maxWidth: '1100px',
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '60px',
    alignItems: 'center',
  },
  trustLeft: {},
  trustRight: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  },
  trustCard: {
    background: '#243144',
    border: '1px solid rgba(91,164,217,0.15)',
    borderRadius: '16px',
    padding: '28px 20px',
    textAlign: 'center' as const,
  },
  trustNum: {
    fontSize: '32px',
    fontWeight: 900,
    color: '#F47920',
    marginBottom: '8px',
  },
  trustLabel: {
    fontSize: '13px',
    color: '#A0AEC0',
  },

  // ── 주의사항
  noticeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '16px',
    marginTop: '48px',
  },
  noticeCard: {
    display: 'flex',
    gap: '16px',
    alignItems: 'flex-start',
    background: '#1B2838',
    border: '1px solid rgba(91,164,217,0.15)',
    borderRadius: '14px',
    padding: '22px 20px',
  },
  noticeIconCircle: {
    width: '44px',
    height: '44px',
    background: 'rgba(244,121,32,0.12)',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    flexShrink: 0,
  },
  noticeTitle: {
    fontSize: '15px',
    fontWeight: 700,
    marginBottom: '6px',
  },
  noticeDesc: {
    fontSize: '13px',
    color: '#A0AEC0',
    lineHeight: 1.6,
  },

  // ── CTA
  cta: {
    background: 'linear-gradient(135deg, #0d1b2a 0%, #1a2c42 100%)',
    padding: '100px 24px',
    textAlign: 'center' as const,
  },
  ctaInner: {
    maxWidth: '680px',
    margin: '0 auto',
  },
  ctaTitle: {
    fontSize: '44px',
    fontWeight: 900,
    lineHeight: 1.2,
    margin: '12px 0 20px',
    letterSpacing: '-1px',
  },
  ctaDesc: {
    fontSize: '16px',
    color: 'rgba(255,255,255,0.6)',
    margin: '0 0 40px',
    lineHeight: 1.7,
  },

  // ── 푸터
  footer: {
    background: '#1B2A4A',
    padding: '0',
    borderTop: '3px solid #F47920',
  },
  footerInner: {
    maxWidth: '1100px',
    margin: '0 auto',
    padding: '48px 24px 32px',
  },
  footerTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap' as const,
    gap: '32px',
    marginBottom: '32px',
  },
  footerBrand: {
    fontSize: '20px',
    fontWeight: 800,
    color: '#ffffff',
  },
  footerTagline: {
    fontSize: '13px',
    color: '#5BA4D9',
    fontWeight: 400,
    marginTop: '6px',
    margin: '6px 0 0',
  },
  footerLinks: {
    display: 'flex',
    gap: '24px',
    flexWrap: 'wrap' as const,
    alignItems: 'center',
  },
  footerLink: {
    color: '#A0AEC0',
    textDecoration: 'none',
    fontSize: '14px',
  },
  footerDivider: {
    height: '1px',
    background: 'rgba(255,255,255,0.08)',
    marginBottom: '24px',
  },
  footerBottom: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '13px',
    color: '#A0AEC0',
    flexWrap: 'wrap' as const,
    gap: '8px',
  },
}
