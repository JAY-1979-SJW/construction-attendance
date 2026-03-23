'use client'

import { useState } from 'react'
import Link from 'next/link'

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
    <div style={pg.page}>
      {/* 상단 헤더 */}
      <header style={pg.header}>
        <Link href="/" style={pg.backLink}>← 돌아가기</Link>
        <span style={pg.headerTitle}>앱 사용 미리보기</span>
        <Link href="/login" style={pg.startBtn}>시작하기</Link>
      </header>

      <div style={pg.body}>
        {/* 스텝 탭 */}
        <div style={pg.tabs}>
          {STEPS.map((s, i) => (
            <button
              key={s.key}
              onClick={() => setStep(s.key)}
              style={{
                ...pg.tab,
                ...(s.key === step ? pg.tabActive : {}),
              }}
            >
              <span style={pg.tabLabel}>{s.label}</span>
              <span style={pg.tabDesc}>{s.desc}</span>
            </button>
          ))}
        </div>

        {/* 폰 프레임 + 화면 */}
        <div style={pg.phoneWrapper}>
          <div style={pg.phone}>
            <div style={pg.phoneSpeaker} />
            <div style={pg.phoneScreen}>
              <ScreenContent step={step} onNext={next} />
            </div>
            <div style={pg.phoneHome} />
          </div>

          {/* 이전/다음 버튼 */}
          <div style={pg.navRow}>
            <button onClick={prev} disabled={!canPrev} style={{ ...pg.navBtn, opacity: canPrev ? 1 : 0.3 }}>
              ← 이전
            </button>
            <span style={pg.navInfo}>
              {currentIdx + 1} / {STEPS.length}
            </span>
            <button onClick={next} disabled={!canNext} style={{ ...pg.navBtn, opacity: canNext ? 1 : 0.3 }}>
              다음 →
            </button>
          </div>
        </div>
      </div>

      {/* 하단 CTA */}
      <div style={pg.cta}>
        <p style={pg.ctaText}>직접 사용해 보려면?</p>
        <Link href="/login" style={pg.ctaBtn}>출퇴근 앱 시작하기</Link>
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
        <div style={sc.container}>
          <div style={sc.loginLogo}>해한<span style={{ color: '#F47920' }}>Ai</span></div>
          <div style={sc.loginSub}>현장 출퇴근 관리 시스템</div>
          <div style={sc.loginCard}>
            <div style={sc.loginLabel}>전화번호</div>
            <input
              style={sc.loginInput}
              defaultValue="010-1234-5678"
              readOnly
            />
            <button onClick={fakeProcess} style={sc.loginBtn} disabled={processing}>
              {processing ? '확인 중...' : '로그인'}
            </button>
            <div style={sc.loginHint}>
              ※ 처음 사용 시 관리자 기기 승인이 필요합니다.
            </div>
          </div>
        </div>
      )

    /* ── 2. 기기 승인 대기 ── */
    case 'pending':
      return (
        <div style={{ ...sc.container, justifyContent: 'center', alignItems: 'center', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>기기 승인 대기 중</div>
          <div style={{ fontSize: '13px', color: '#A0AEC0', textAlign: 'center', lineHeight: 1.7, marginBottom: '24px' }}>
            현장 관리자가 이 기기를<br />승인하면 자동으로 로그인됩니다.<br /><br />
            <strong>최초 1회만</strong> 필요합니다.
          </div>
          <div style={{ background: 'rgba(91,164,217,0.1)', borderRadius: '10px', padding: '14px 18px', fontSize: '13px', color: '#4A93C8', textAlign: 'center' }}>
            📱 승인 완료 후<br />다시 로그인하세요
          </div>
          <button onClick={onNext} style={{ ...sc.loginBtn, marginTop: '24px', background: '#555' }}>
            (승인됨 — 다음 보기)
          </button>
        </div>
      )

    /* ── 3. 홈 (출근 전) ── */
    case 'home-empty':
      return (
        <div style={sc.container}>
          <div style={sc.attHeader}>
            <div>
              <div style={sc.workerName}>홍길동</div>
              <div style={sc.workerInfo}>해한Ai Engineering · 철근공</div>
            </div>
            <button style={sc.logoutBtn}>로그아웃</button>
          </div>
          <div style={sc.card}>
            <div style={sc.dateLabel}>오늘의 출퇴근</div>
            <div style={{ textAlign: 'center', padding: '20px 0', color: '#A0AEC0' }}>
              <p>오늘 출근 기록이 없습니다.</p>
              <p style={{ fontSize: '13px', color: '#A0AEC0' }}>현장 QR코드를 스캔하여 출근하세요.</p>
            </div>
          </div>
          <div style={sc.guideCard}>
            <div style={sc.guideTitle}>출퇴근 방법</div>
            <div style={sc.guideStep}>1. 현장에 부착된 QR코드를 스캔하세요</div>
            <div style={sc.guideStep}>2. 위치 권한을 허용하세요</div>
            <div style={sc.guideStep}>3. 출근 / 퇴근 버튼을 누르세요</div>
          </div>
          <button onClick={onNext} style={sc.demoNext}>
            → QR 스캔 시뮬레이션
          </button>
        </div>
      )

    /* ── 4. QR 스캔 → 출근 ── */
    case 'checkin':
      return (
        <div style={sc.container}>
          <div style={sc.siteCard}>
            <div style={sc.siteLabel}>스캔한 현장</div>
            <div style={sc.siteName}>해한 A현장</div>
            <div style={sc.siteAddress}>서울시 강남구 테헤란로 123</div>
          </div>
          <div style={sc.actionCard}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🏗️</div>
            <div style={sc.actionTitle}>출근 처리</div>
            <div style={sc.actionDesc}>현재 위치를 확인 후 출근 처리합니다.</div>
            <button
              onClick={fakeProcess}
              disabled={processing}
              style={{ ...sc.checkInBtn, opacity: processing ? 0.6 : 1 }}
            >
              {processing ? '위치 확인 중...' : '출근하기'}
            </button>
          </div>
          <button style={sc.exceptionBtn}>GPS 오류 또는 예외 신청</button>
        </div>
      )

    /* ── 5. 홈 (근무 중) ── */
    case 'home-working':
      return (
        <div style={sc.container}>
          <div style={sc.attHeader}>
            <div>
              <div style={sc.workerName}>홍길동</div>
              <div style={sc.workerInfo}>해한Ai Engineering · 철근공</div>
            </div>
            <button style={sc.logoutBtn}>로그아웃</button>
          </div>
          <div style={sc.card}>
            <div style={sc.dateLabel}>오늘의 출퇴근</div>
            <div style={{ display: 'inline-block', background: '#2e7d32', color: 'white', fontSize: '13px', fontWeight: 700, padding: '4px 12px', borderRadius: '20px', marginBottom: '12px' }}>
              근무 중
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', marginBottom: '4px' }}>해한 A현장</div>
            <div style={{ fontSize: '13px', color: '#A0AEC0', marginBottom: '20px' }}>서울시 강남구 테헤란로 123</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#718096', marginBottom: '4px' }}>출근</div>
                <div style={{ fontSize: '22px', fontWeight: 700 }}>08:30</div>
                <div style={{ fontSize: '11px', color: '#aaa', marginTop: '4px' }}>45m</div>
              </div>
              <div style={{ fontSize: '18px', color: '#ccc' }}>→</div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#718096', marginBottom: '4px' }}>퇴근</div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#bbb' }}>--:--</div>
              </div>
            </div>
          </div>
          <div style={sc.guideCard}>
            <div style={sc.guideTitle}>출퇴근 방법</div>
            <div style={sc.guideStep}>1. 현장에 부착된 QR코드를 스캔하세요</div>
            <div style={sc.guideStep}>2. 위치 권한을 허용하세요</div>
            <div style={sc.guideStep}>3. 출근 / 퇴근 버튼을 누르세요</div>
          </div>
          <button onClick={onNext} style={sc.demoNext}>
            → 퇴근 QR 스캔 시뮬레이션
          </button>
        </div>
      )

    /* ── 6. QR 스캔 → 퇴근 ── */
    case 'checkout':
      return (
        <div style={sc.container}>
          <div style={sc.siteCard}>
            <div style={sc.siteLabel}>스캔한 현장</div>
            <div style={sc.siteName}>해한 A현장</div>
            <div style={sc.siteAddress}>서울시 강남구 테헤란로 123</div>
          </div>
          <div style={sc.actionCard}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🏠</div>
            <div style={sc.actionTitle}>퇴근 처리</div>
            <div style={sc.actionDesc}>현재 위치를 확인 후 퇴근 처리합니다.</div>
            <button
              onClick={fakeProcess}
              disabled={processing}
              style={{ ...sc.checkOutBtn, opacity: processing ? 0.6 : 1 }}
            >
              {processing ? '위치 확인 중...' : '퇴근하기'}
            </button>
          </div>
          <button style={sc.exceptionBtn}>GPS 오류 또는 예외 신청</button>
        </div>
      )

    /* ── 7. 퇴근 완료 ── */
    case 'completed':
      return (
        <div style={sc.container}>
          <div style={sc.siteCard}>
            <div style={sc.siteLabel}>스캔한 현장</div>
            <div style={sc.siteName}>해한 A현장</div>
            <div style={sc.siteAddress}>서울시 강남구 테헤란로 123</div>
          </div>
          <div style={sc.actionCard}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
            <div style={{ ...sc.actionTitle, color: '#2e7d32' }}>퇴근이 완료되었습니다.</div>
            <div style={sc.actionDesc}>현장까지 거리: 32m</div>
            <button style={sc.homeBtn}>내 출퇴근 현황 보기</button>
          </div>
          <div style={{ background: '#e8f5e9', borderRadius: '12px', padding: '16px', marginTop: '8px', textAlign: 'center', fontSize: '14px', color: '#2e7d32' }}>
            🎉 오늘 근무 완료!<br />
            <span style={{ fontSize: '13px', color: '#388e3c', fontWeight: 700 }}>08:30 → 17:45</span>
          </div>
        </div>
      )
  }
}

/* ──────────────────────────────────────────────
   스타일
────────────────────────────────────────────── */
const pg: Record<string, React.CSSProperties> = {
  page:        { fontFamily: "'Pretendard', 'Pretendard Variable', system-ui, sans-serif", color: '#ffffff', minHeight: '100vh', background: '#1B2838' },
  header:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 24px', height: '60px', background: '#243144', borderBottom: '1px solid rgba(255,255,255,0.08)', position: 'sticky' as const, top: 0, zIndex: 10, boxShadow: '0 2px 12px rgba(0,0,0,0.2)' },
  backLink:    { fontSize: '14px', color: '#A0AEC0', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' },
  headerTitle: { fontSize: '16px', fontWeight: 700, color: '#ffffff' },
  startBtn:    { padding: '9px 20px', background: '#F47920', color: 'white', borderRadius: '8px', textDecoration: 'none', fontSize: '13px', fontWeight: 700, boxShadow: '0 2px 8px rgba(244,121,32,0.3)' },

  body:        { display: 'flex', gap: '28px', padding: '28px 24px', maxWidth: '1100px', margin: '0 auto', flexWrap: 'wrap' as const },

  tabs:        { display: 'flex', flexDirection: 'column' as const, gap: '6px', minWidth: '190px', flex: '0 0 auto' },
  tab:         { background: '#1B2838', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '12px 16px', cursor: 'pointer', textAlign: 'left' as const, transition: 'all 0.15s' },
  tabActive:   { borderColor: '#F47920', background: 'rgba(244,121,32,0.1)', borderLeft: '3px solid #F47920' },
  tabLabel:    { display: 'block', fontSize: '13px', fontWeight: 700, color: '#ffffff', marginBottom: '2px' },
  tabDesc:     { display: 'block', fontSize: '11px', color: '#718096' },

  phoneWrapper: { flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '20px' },
  phone:        {
    width: '300px',
    background: '#0d1520',
    borderRadius: '40px',
    padding: '14px',
    boxShadow: '0 24px 60px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  phoneSpeaker: { width: '50px', height: '5px', background: '#222', borderRadius: '3px', margin: '0 auto 10px' },
  phoneScreen:  { background: '#1B2838', borderRadius: '28px', minHeight: '540px', overflow: 'hidden', position: 'relative' as const },
  phoneHome:    { width: '36px', height: '36px', background: '#222', borderRadius: '50%', margin: '10px auto 0', border: '1px solid #333' },

  navRow:  { display: 'flex', alignItems: 'center', gap: '16px' },
  navBtn:  { padding: '10px 24px', background: '#F47920', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: 700, boxShadow: '0 3px 10px rgba(244,121,32,0.3)' },
  navInfo: { fontSize: '14px', color: '#718096', minWidth: '48px', textAlign: 'center' as const },

  cta:     { textAlign: 'center' as const, padding: '48px 24px', background: 'linear-gradient(135deg, #0d1b2a 0%, #1a2c42 100%)' },
  ctaText: { color: '#A0AEC0', marginBottom: '20px', fontSize: '16px' },
  ctaBtn:  { display: 'inline-block', padding: '16px 44px', background: '#F47920', color: 'white', borderRadius: '12px', textDecoration: 'none', fontSize: '17px', fontWeight: 700, boxShadow: '0 4px 16px rgba(244,121,32,0.4)' },
}

// 화면 내부 스타일 (실제 앱과 동일)
const sc: Record<string, React.CSSProperties> = {
  container:   { maxWidth: '480px', margin: '0 auto', padding: '20px', minHeight: '540px', background: '#1B2838' },

  // 로그인
  loginLogo:   { fontSize: '30px', fontWeight: 900, color: '#ffffff', textAlign: 'center' as const, paddingTop: '40px', marginBottom: '6px', letterSpacing: '-1px' },
  loginSub:    { fontSize: '12px', color: '#718096', textAlign: 'center' as const, marginBottom: '28px' },
  loginCard:   { background: '#243144', borderRadius: '16px', padding: '22px', border: '1px solid rgba(255,255,255,0.08)' },
  loginLabel:  { fontSize: '12px', color: '#A0AEC0', marginBottom: '6px' },
  loginInput:  { width: '100%', padding: '12px', fontSize: '15px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', boxSizing: 'border-box' as const, marginBottom: '12px', background: 'rgba(255,255,255,0.06)', color: '#ffffff' },
  loginBtn:    { width: '100%', padding: '13px', fontSize: '15px', fontWeight: 700, background: '#F47920', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', marginBottom: '12px', boxShadow: '0 3px 10px rgba(244,121,32,0.3)' },
  loginHint:   { fontSize: '11px', color: '#5a6a7e', textAlign: 'center' as const, lineHeight: 1.5 },

  // 출퇴근 홈
  attHeader:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingTop: '8px' },
  workerName:  { fontSize: '16px', fontWeight: 700, color: '#ffffff' },
  workerInfo:  { fontSize: '11px', color: '#718096', marginTop: '2px' },
  logoutBtn:   { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', cursor: 'pointer', color: '#A0AEC0' },
  card:        { background: '#243144', borderRadius: '14px', padding: '18px', marginBottom: '10px', border: '1px solid rgba(255,255,255,0.07)' },
  dateLabel:   { fontSize: '11px', color: '#718096', marginBottom: '10px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' },
  guideCard:   { background: 'rgba(91,164,217,0.08)', border: '1px solid rgba(91,164,217,0.2)', borderRadius: '12px', padding: '14px', marginBottom: '10px' },
  guideTitle:  { fontSize: '12px', fontWeight: 700, color: '#5BA4D9', marginBottom: '8px' },
  guideStep:   { fontSize: '11px', color: '#4A93C8', marginBottom: '4px', display: 'flex', gap: '6px' },

  // QR 화면
  siteCard:    { background: '#243144', borderRadius: '12px', padding: '14px', marginBottom: '10px', border: '1px solid rgba(255,255,255,0.07)' },
  siteLabel:   { fontSize: '10px', color: '#5a6a7e', marginBottom: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' },
  siteName:    { fontSize: '17px', fontWeight: 700, color: '#ffffff', marginBottom: '3px' },
  siteAddress: { fontSize: '12px', color: '#A0AEC0' },
  actionCard:  { background: '#243144', borderRadius: '14px', padding: '28px 20px', textAlign: 'center' as const, border: '1px solid rgba(255,255,255,0.07)', marginBottom: '10px' },
  actionTitle: { fontSize: '18px', fontWeight: 700, color: '#ffffff', marginBottom: '6px' },
  actionDesc:  { fontSize: '13px', color: '#A0AEC0', marginBottom: '18px' },
  checkInBtn:  { width: '100%', padding: '15px', fontSize: '16px', fontWeight: 700, background: 'linear-gradient(135deg, #2e7d32, #43a047)', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', boxShadow: '0 3px 10px rgba(46,125,50,0.3)' },
  checkOutBtn: { width: '100%', padding: '15px', fontSize: '16px', fontWeight: 700, background: 'linear-gradient(135deg, #E06810, #F47920)', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', boxShadow: '0 3px 10px rgba(244,121,32,0.3)' },
  homeBtn:     { width: '100%', padding: '13px', fontSize: '14px', fontWeight: 600, background: 'rgba(255,255,255,0.06)', color: '#CBD5E0', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', cursor: 'pointer' },
  exceptionBtn:{ width: '100%', padding: '10px', fontSize: '12px', background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '9px', cursor: 'pointer', color: '#718096' },

  demoNext:    { width: '100%', padding: '11px', fontSize: '12px', background: 'rgba(244,121,32,0.1)', color: '#F47920', border: '1px solid rgba(244,121,32,0.3)', borderRadius: '9px', cursor: 'pointer', fontWeight: 600 },
}
