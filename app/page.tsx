'use client'

import Link from 'next/link'

export default function LandingPage() {
  return (
    <div style={s.page}>
      {/* 헤더 */}
      <header style={s.header}>
        <span style={s.headerLogo}>해한건설</span>
        <Link href="/login" style={s.headerLogin}>로그인</Link>
      </header>

      {/* 히어로 */}
      <section style={s.hero}>
        <div style={s.heroInner}>
          <div style={s.badge}>현장 출퇴근 관리 시스템</div>
          <h1 style={s.heroTitle}>
            QR 한 번으로<br />출퇴근 끝
          </h1>
          <p style={s.heroSub}>
            현장에 붙어있는 QR을 스캔하면<br />
            출근·이동·퇴근이 자동으로 기록됩니다.
          </p>
          <Link href="/login" style={s.startBtn}>시작하기</Link>
        </div>
      </section>

      {/* 사용 방법 */}
      <section style={s.section}>
        <h2 style={s.sectionTitle}>이렇게 사용하세요</h2>
        <div style={s.steps}>
          {[
            { num: '1', icon: '📱', title: '앱 접속 · 로그인', desc: '휴대폰 번호를 입력하고\n관리자 승인을 받으세요.' },
            { num: '2', icon: '✅', title: '출근 QR 스캔', desc: '현장에 도착하면\n출근 QR을 스캔하세요.' },
            { num: '3', icon: '🚶', title: '현장 이동 (선택)', desc: '다른 현장으로 이동 시\n해당 현장 QR을 스캔하세요.' },
            { num: '4', icon: '🏠', title: '퇴근 QR 스캔', desc: '퇴근 전 반드시\n마지막 현장 QR을 스캔하세요.' },
          ].map((step) => (
            <div key={step.num} style={s.stepCard}>
              <div style={s.stepNum}>{step.num}</div>
              <div style={s.stepIcon}>{step.icon}</div>
              <div style={s.stepTitle}>{step.title}</div>
              <div style={s.stepDesc}>{step.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 특징 */}
      <section style={{ ...s.section, background: '#f8f9fa' }}>
        <h2 style={s.sectionTitle}>주요 특징</h2>
        <div style={s.features}>
          {[
            { icon: '📍', title: 'GPS 위치 확인', desc: '현장 반경 내에서만 출퇴근 가능. 허위 기록 방지.' },
            { icon: '🔒', title: '관리자 승인 방식', desc: '등록된 기기·근로자만 사용 가능. 보안 유지.' },
            { icon: '📊', title: '실시간 현황', desc: '관리자가 출근 현황을 실시간으로 확인.' },
            { icon: '🔄', title: '자동 퇴근 처리', desc: '퇴근 누락 시 다음날 자동으로 미퇴근 처리.' },
          ].map((f) => (
            <div key={f.title} style={s.featureCard}>
              <div style={s.featureIcon}>{f.icon}</div>
              <div style={s.featureTitle}>{f.title}</div>
              <div style={s.featureDesc}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 주의사항 */}
      <section style={s.section}>
        <h2 style={s.sectionTitle}>사용 전 확인사항</h2>
        <div style={s.notices}>
          {[
            '휴대폰 GPS(위치) 권한을 허용해야 합니다.',
            '최초 1회 관리자 기기 승인이 필요합니다.',
            '퇴근 스캔을 빠뜨리면 미퇴근으로 처리됩니다.',
            '문제 발생 시 현장 관리자에게 바로 알려주세요.',
          ].map((notice) => (
            <div key={notice} style={s.noticeItem}>
              <span style={s.noticeIcon}>⚠️</span>
              <span>{notice}</span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={s.cta}>
        <h2 style={s.ctaTitle}>지금 바로 시작하세요</h2>
        <p style={s.ctaSub}>전화번호 입력만으로 등록 가능합니다.</p>
        <Link href="/login" style={s.ctaBtn}>출퇴근 앱 시작하기</Link>
      </section>

      {/* 푸터 */}
      <footer style={s.footer}>
        <span>© 2026 해한건설</span>
        <Link href="/admin" style={s.footerAdmin}>관리자 로그인</Link>
      </footer>
    </div>
  )
}

// ── 스타일 ────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  page:          { fontFamily: '"Malgun Gothic","Apple SD Gothic Neo",sans-serif', color: '#1a1a2e', minHeight: '100vh' },

  // 헤더
  header:        { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', background: 'white', borderBottom: '1px solid #eee', position: 'sticky' as const, top: 0, zIndex: 10 },
  headerLogo:    { fontSize: '18px', fontWeight: 700, color: '#1a1a2e' },
  headerLogin:   { padding: '8px 20px', background: '#1976d2', color: 'white', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: 600 },

  // 히어로
  hero:          { background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)', padding: '80px 24px', textAlign: 'center' as const },
  heroInner:     { maxWidth: '560px', margin: '0 auto' },
  badge:         { display: 'inline-block', background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)', borderRadius: '20px', padding: '6px 16px', fontSize: '13px', marginBottom: '24px' },
  heroTitle:     { fontSize: '48px', fontWeight: 900, color: 'white', margin: '0 0 20px', lineHeight: 1.2 },
  heroSub:       { fontSize: '18px', color: 'rgba(255,255,255,0.75)', margin: '0 0 40px', lineHeight: 1.7 },
  startBtn:      { display: 'inline-block', padding: '18px 48px', background: '#1976d2', color: 'white', borderRadius: '12px', textDecoration: 'none', fontSize: '18px', fontWeight: 700 },

  // 섹션 공통
  section:       { padding: '64px 24px', background: 'white' },
  sectionTitle:  { fontSize: '28px', fontWeight: 700, textAlign: 'center' as const, margin: '0 0 40px' },

  // 스텝
  steps:         { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', maxWidth: '900px', margin: '0 auto' },
  stepCard:      { background: '#f8f9fa', borderRadius: '16px', padding: '28px 20px', textAlign: 'center' as const },
  stepNum:       { display: 'inline-block', width: '28px', height: '28px', background: '#1976d2', color: 'white', borderRadius: '50%', fontSize: '14px', fontWeight: 700, lineHeight: '28px', textAlign: 'center' as const, marginBottom: '12px' },
  stepIcon:      { fontSize: '36px', marginBottom: '12px' },
  stepTitle:     { fontSize: '16px', fontWeight: 700, marginBottom: '8px' },
  stepDesc:      { fontSize: '13px', color: '#666', lineHeight: 1.6, whiteSpace: 'pre-line' as const },

  // 특징
  features:      { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', maxWidth: '900px', margin: '0 auto' },
  featureCard:   { background: 'white', borderRadius: '16px', padding: '28px 20px', textAlign: 'center' as const, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  featureIcon:   { fontSize: '36px', marginBottom: '12px' },
  featureTitle:  { fontSize: '16px', fontWeight: 700, marginBottom: '8px' },
  featureDesc:   { fontSize: '13px', color: '#666', lineHeight: 1.6 },

  // 주의사항
  notices:       { maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column' as const, gap: '12px' },
  noticeItem:    { display: 'flex', alignItems: 'flex-start', gap: '12px', background: '#fff8e1', borderRadius: '10px', padding: '14px 18px', fontSize: '15px', lineHeight: 1.6 },
  noticeIcon:    { flexShrink: 0, fontSize: '18px' },

  // CTA
  cta:           { background: '#1a1a2e', padding: '80px 24px', textAlign: 'center' as const },
  ctaTitle:      { fontSize: '32px', fontWeight: 700, color: 'white', margin: '0 0 12px' },
  ctaSub:        { fontSize: '16px', color: 'rgba(255,255,255,0.65)', margin: '0 0 32px' },
  ctaBtn:        { display: 'inline-block', padding: '18px 48px', background: '#1976d2', color: 'white', borderRadius: '12px', textDecoration: 'none', fontSize: '18px', fontWeight: 700 },

  // 푸터
  footer:        { background: '#111', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: '#666' },
  footerAdmin:   { color: '#555', textDecoration: 'none', fontSize: '12px' },
}
