'use client'

import Link from 'next/link'
import Image from 'next/image'

export default function RegisterPendingPage() {
  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={{ marginBottom: '20px' }}>
          <Image src="/logo/logo_dark_1x.png" alt="해한Ai Engineering" width={150} height={30} style={{ height: '30px', width: 'auto', margin: '0 auto' }} priority />
        </div>
        <div style={s.iconWrap}>
          <div style={s.iconCircle}>⏳</div>
        </div>
        <h1 style={s.title}>가입 신청 완료</h1>
        <p style={s.desc}>
          회원가입 신청이 접수되었습니다.<br />
          <span style={s.highlight}>관리자 승인 후</span> 로그인 및 출퇴근이 가능합니다.
        </p>

        <div style={s.stepsBox}>
          {[
            { num: '✓',  color: '#4caf50', bg: 'rgba(76,175,80,0.15)',  border: 'rgba(76,175,80,0.4)',  title: '회원가입 신청', sub: '완료되었습니다.' },
            { num: '2',  color: '#F47920', bg: 'rgba(244,121,32,0.15)', border: 'rgba(244,121,32,0.4)', title: '관리자 계정 승인', sub: '승인 대기 중입니다.' },
            { num: '3',  color: '#A0AEC0', bg: 'rgba(160,174,192,0.1)', border: 'rgba(160,174,192,0.2)', title: '기기 승인', sub: '계정 승인 후 진행됩니다.' },
            { num: '4',  color: '#A0AEC0', bg: 'rgba(160,174,192,0.1)', border: 'rgba(160,174,192,0.2)', title: '현장 참여 신청 및 승인', sub: '계정 승인 후 신청 가능합니다.' },
            { num: '5',  color: '#A0AEC0', bg: 'rgba(160,174,192,0.1)', border: 'rgba(160,174,192,0.2)', title: '출퇴근 가능', sub: '모든 승인 완료 후 사용 가능합니다.' },
          ].map((step) => (
            <div key={step.num} style={s.stepItem}>
              <span style={{ ...s.stepDot, color: step.color, background: step.bg, border: `1px solid ${step.border}` }}>
                {step.num}
              </span>
              <div>
                <div style={{ ...s.stepTitle, color: step.num === '✓' ? '#ffffff' : step.num === '2' ? '#ffffff' : '#718096' }}>
                  {step.title}
                </div>
                <div style={s.stepSub}>{step.sub}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={s.notice}>
          <span style={s.noticeIcon}>ℹ️</span>
          <div>
            <div style={s.noticeTitle}>승인 안내</div>
            <div style={s.noticeText}>승인 소요 시간: 영업일 기준 1~2일 이내<br />문의: 현장 관리자 또는 담당자에게 연락해 주세요.</div>
          </div>
        </div>

        <Link href="/login" style={s.btn}>로그인 화면으로</Link>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page:      { minHeight: '100vh', background: 'linear-gradient(160deg, #0d1b2a 0%, #1B2838 60%, #141E2A 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' },
  card:      { background: '#243144', borderRadius: '20px', padding: '44px 36px', width: '100%', maxWidth: '460px', boxShadow: '0 8px 40px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)', borderTop: '3px solid #F47920', textAlign: 'center' as const },
  iconWrap:  { marginBottom: '20px' },
  iconCircle: { width: '72px', height: '72px', background: 'rgba(244,121,32,0.12)', border: '1px solid rgba(244,121,32,0.3)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', margin: '0 auto' },
  title:     { fontSize: '24px', fontWeight: 800, margin: '0 0 12px', color: '#ffffff', letterSpacing: '-0.5px' },
  desc:      { fontSize: '15px', color: '#A0AEC0', lineHeight: 1.7, margin: '0 0 28px' },
  highlight: { color: '#F47920', fontWeight: 700 },
  stepsBox:  { textAlign: 'left' as const, margin: '0 0 24px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '16px 20px' },
  stepItem:  { display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '14px' },
  stepDot:   { width: '30px', height: '30px', minWidth: '30px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, marginTop: '2px' },
  stepTitle: { fontSize: '14px', fontWeight: 600, marginBottom: '2px' },
  stepSub:   { fontSize: '12px', color: '#718096' },
  notice:    { background: 'rgba(91,164,217,0.08)', border: '1px solid rgba(91,164,217,0.25)', borderRadius: '12px', padding: '14px 16px', marginBottom: '24px', textAlign: 'left' as const, display: 'flex', gap: '12px', alignItems: 'flex-start' },
  noticeIcon: { fontSize: '18px', flexShrink: 0 },
  noticeTitle: { fontSize: '13px', fontWeight: 700, color: '#5BA4D9', marginBottom: '4px' },
  noticeText: { fontSize: '13px', color: '#A0AEC0', lineHeight: 1.6 },
  btn:       { display: 'inline-block', padding: '15px 40px', background: '#F47920', color: 'white', borderRadius: '10px', textDecoration: 'none', fontSize: '15px', fontWeight: 700, boxShadow: '0 4px 14px rgba(244,121,32,0.35)' },
}
