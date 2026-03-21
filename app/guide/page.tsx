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
          <div style={sc.loginLogo}>해한건설</div>
          <div style={sc.loginSub}>출퇴근 관리 시스템</div>
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
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#1a1a2e', marginBottom: '8px' }}>기기 승인 대기 중</div>
          <div style={{ fontSize: '13px', color: '#666', textAlign: 'center', lineHeight: 1.7, marginBottom: '24px' }}>
            현장 관리자가 이 기기를<br />승인하면 자동으로 로그인됩니다.<br /><br />
            <strong>최초 1회만</strong> 필요합니다.
          </div>
          <div style={{ background: '#e3f2fd', borderRadius: '10px', padding: '14px 18px', fontSize: '13px', color: '#1565c0', textAlign: 'center' }}>
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
              <div style={sc.workerInfo}>해한건설 · 철근공</div>
            </div>
            <button style={sc.logoutBtn}>로그아웃</button>
          </div>
          <div style={sc.card}>
            <div style={sc.dateLabel}>오늘의 출퇴근</div>
            <div style={{ textAlign: 'center', padding: '20px 0', color: '#555' }}>
              <p>오늘 출근 기록이 없습니다.</p>
              <p style={{ fontSize: '13px', color: '#888' }}>현장 QR코드를 스캔하여 출근하세요.</p>
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
              <div style={sc.workerInfo}>해한건설 · 철근공</div>
            </div>
            <button style={sc.logoutBtn}>로그아웃</button>
          </div>
          <div style={sc.card}>
            <div style={sc.dateLabel}>오늘의 출퇴근</div>
            <div style={{ display: 'inline-block', background: '#2e7d32', color: 'white', fontSize: '13px', fontWeight: 700, padding: '4px 12px', borderRadius: '20px', marginBottom: '12px' }}>
              근무 중
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#1a1a2e', marginBottom: '4px' }}>해한 A현장</div>
            <div style={{ fontSize: '13px', color: '#888', marginBottom: '20px' }}>서울시 강남구 테헤란로 123</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>출근</div>
                <div style={{ fontSize: '22px', fontWeight: 700 }}>08:30</div>
                <div style={{ fontSize: '11px', color: '#aaa', marginTop: '4px' }}>45m</div>
              </div>
              <div style={{ fontSize: '18px', color: '#ccc' }}>→</div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>퇴근</div>
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
  page:        { fontFamily: '"Malgun Gothic","Apple SD Gothic Neo",sans-serif', color: '#1a1a2e', minHeight: '100vh', background: '#f0f4f8' },
  header:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', background: 'white', borderBottom: '1px solid #eee', position: 'sticky' as const, top: 0, zIndex: 10 },
  backLink:    { fontSize: '14px', color: '#555', textDecoration: 'none' },
  headerTitle: { fontSize: '16px', fontWeight: 700 },
  startBtn:    { padding: '8px 18px', background: '#1976d2', color: 'white', borderRadius: '8px', textDecoration: 'none', fontSize: '13px', fontWeight: 600 },

  body:        { display: 'flex', gap: '24px', padding: '24px', maxWidth: '1100px', margin: '0 auto', flexWrap: 'wrap' as const },

  tabs:        { display: 'flex', flexDirection: 'column' as const, gap: '8px', minWidth: '180px', flex: '0 0 auto' },
  tab:         { background: 'white', border: '2px solid #e0e0e0', borderRadius: '10px', padding: '12px 16px', cursor: 'pointer', textAlign: 'left' as const, transition: 'all 0.15s' },
  tabActive:   { borderColor: '#1976d2', background: '#e3f2fd' },
  tabLabel:    { display: 'block', fontSize: '13px', fontWeight: 700, color: '#1a1a2e', marginBottom: '2px' },
  tabDesc:     { display: 'block', fontSize: '11px', color: '#888' },

  phoneWrapper: { flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '16px' },
  phone:        {
    width: '320px',
    background: '#1a1a2e',
    borderRadius: '40px',
    padding: '16px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
  },
  phoneSpeaker: { width: '60px', height: '6px', background: '#333', borderRadius: '3px', margin: '0 auto 12px' },
  phoneScreen:  { background: '#f5f5f5', borderRadius: '24px', minHeight: '560px', overflow: 'hidden', position: 'relative' as const },
  phoneHome:    { width: '40px', height: '40px', background: '#333', borderRadius: '50%', margin: '12px auto 0' },

  navRow:  { display: 'flex', alignItems: 'center', gap: '16px' },
  navBtn:  { padding: '8px 20px', background: '#1976d2', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 },
  navInfo: { fontSize: '14px', color: '#666' },

  cta:     { textAlign: 'center' as const, padding: '40px 24px', background: '#1a1a2e' },
  ctaText: { color: 'rgba(255,255,255,0.7)', marginBottom: '16px', fontSize: '16px' },
  ctaBtn:  { display: 'inline-block', padding: '16px 40px', background: '#1976d2', color: 'white', borderRadius: '12px', textDecoration: 'none', fontSize: '18px', fontWeight: 700 },
}

// 화면 내부 스타일 (실제 앱과 동일)
const sc: Record<string, React.CSSProperties> = {
  container:   { maxWidth: '480px', margin: '0 auto', padding: '20px', minHeight: '560px', background: '#f5f5f5' },

  // 로그인
  loginLogo:   { fontSize: '28px', fontWeight: 900, color: '#1a1a2e', textAlign: 'center' as const, paddingTop: '40px', marginBottom: '4px' },
  loginSub:    { fontSize: '13px', color: '#888', textAlign: 'center' as const, marginBottom: '32px' },
  loginCard:   { background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  loginLabel:  { fontSize: '13px', color: '#555', marginBottom: '6px' },
  loginInput:  { width: '100%', padding: '12px', fontSize: '16px', border: '1px solid #e0e0e0', borderRadius: '8px', boxSizing: 'border-box' as const, marginBottom: '12px', background: '#f9f9f9' },
  loginBtn:    { width: '100%', padding: '14px', fontSize: '16px', fontWeight: 700, background: '#1976d2', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', marginBottom: '12px' },
  loginHint:   { fontSize: '12px', color: '#aaa', textAlign: 'center' as const, lineHeight: 1.5 },

  // 출퇴근 홈
  attHeader:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingTop: '8px' },
  workerName:  { fontSize: '16px', fontWeight: 700, color: '#1a1a2e' },
  workerInfo:  { fontSize: '12px', color: '#666', marginTop: '2px' },
  logoutBtn:   { background: 'none', border: '1px solid #e0e0e0', borderRadius: '6px', padding: '5px 10px', fontSize: '12px', cursor: 'pointer', color: '#666' },
  card:        { background: 'white', borderRadius: '14px', padding: '20px', marginBottom: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  dateLabel:   { fontSize: '12px', color: '#888', marginBottom: '10px' },
  guideCard:   { background: '#e3f2fd', borderRadius: '10px', padding: '16px', marginBottom: '12px' },
  guideTitle:  { fontSize: '13px', fontWeight: 700, color: '#1565c0', marginBottom: '10px' },
  guideStep:   { fontSize: '12px', color: '#1976d2', marginBottom: '5px' },

  // QR 화면
  siteCard:    { background: 'white', borderRadius: '10px', padding: '16px', marginBottom: '12px', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' },
  siteLabel:   { fontSize: '11px', color: '#999', marginBottom: '4px' },
  siteName:    { fontSize: '18px', fontWeight: 700, color: '#1a1a2e', marginBottom: '3px' },
  siteAddress: { fontSize: '12px', color: '#888' },
  actionCard:  { background: 'white', borderRadius: '14px', padding: '32px 24px', textAlign: 'center' as const, boxShadow: '0 2px 10px rgba(0,0,0,0.07)', marginBottom: '12px' },
  actionTitle: { fontSize: '20px', fontWeight: 700, color: '#1a1a2e', marginBottom: '6px' },
  actionDesc:  { fontSize: '13px', color: '#666', marginBottom: '20px' },
  checkInBtn:  { width: '100%', padding: '16px', fontSize: '18px', fontWeight: 700, background: '#2e7d32', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer' },
  checkOutBtn: { width: '100%', padding: '16px', fontSize: '18px', fontWeight: 700, background: '#1565c0', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer' },
  homeBtn:     { width: '100%', padding: '14px', fontSize: '15px', fontWeight: 600, background: '#f5f5f5', color: '#333', border: 'none', borderRadius: '10px', cursor: 'pointer' },
  exceptionBtn:{ width: '100%', padding: '11px', fontSize: '12px', background: 'none', border: '1px solid #e0e0e0', borderRadius: '9px', cursor: 'pointer', color: '#888' },

  demoNext:    { width: '100%', padding: '12px', fontSize: '13px', background: '#e3f2fd', color: '#1565c0', border: '1px solid #90caf9', borderRadius: '9px', cursor: 'pointer', fontWeight: 600 },
}
