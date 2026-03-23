'use client'

import Link from 'next/link'

export default function RegisterPendingPage() {
  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.icon}>⏳</div>
        <h1 style={s.title}>가입 신청 완료</h1>
        <p style={s.desc}>
          회원가입 신청이 접수되었습니다.<br />
          <strong>관리자 승인 후</strong> 로그인 및 출퇴근이 가능합니다.
        </p>

        <div style={s.stepsBox}>
          <div style={s.stepItem}>
            <span style={{ ...s.stepDot, background: '#4caf50' }}>✓</span>
            <div>
              <div style={s.stepTitle}>회원가입 신청</div>
              <div style={s.stepSub}>완료되었습니다.</div>
            </div>
          </div>
          <div style={s.stepItem}>
            <span style={{ ...s.stepDot, background: '#ff9800' }}>2</span>
            <div>
              <div style={s.stepTitle}>관리자 계정 승인</div>
              <div style={s.stepSub}>승인 대기 중입니다.</div>
            </div>
          </div>
          <div style={s.stepItem}>
            <span style={{ ...s.stepDot, background: '#ccc' }}>3</span>
            <div>
              <div style={s.stepTitle}>기기 승인</div>
              <div style={s.stepSub}>계정 승인 후 진행됩니다.</div>
            </div>
          </div>
          <div style={s.stepItem}>
            <span style={{ ...s.stepDot, background: '#ccc' }}>4</span>
            <div>
              <div style={s.stepTitle}>현장 참여 신청 및 승인</div>
              <div style={s.stepSub}>계정 승인 후 신청 가능합니다.</div>
            </div>
          </div>
          <div style={s.stepItem}>
            <span style={{ ...s.stepDot, background: '#ccc' }}>5</span>
            <div>
              <div style={s.stepTitle}>출퇴근 가능</div>
              <div style={s.stepSub}>모든 승인 완료 후 사용 가능합니다.</div>
            </div>
          </div>
        </div>

        <div style={s.notice}>
          승인 소요 시간: 영업일 기준 1~2일 이내<br />
          문의: 현장 관리자 또는 담당자에게 연락해 주세요.
        </div>

        <Link href="/login" style={s.btn}>로그인 화면으로</Link>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page:      { minHeight: '100vh', background: '#f5f6fa', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' },
  card:      { background: 'white', borderRadius: '16px', padding: '40px 32px', width: '100%', maxWidth: '440px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', textAlign: 'center' as const },
  icon:      { fontSize: '56px', marginBottom: '16px' },
  title:     { fontSize: '24px', fontWeight: 700, margin: '0 0 12px', color: '#1a1a2e' },
  desc:      { fontSize: '15px', color: '#444', lineHeight: 1.7, margin: '0 0 28px' },
  stepsBox:  { textAlign: 'left' as const, margin: '0 0 24px' },
  stepItem:  { display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '14px' },
  stepDot:   { width: '28px', height: '28px', borderRadius: '50%', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, flexShrink: 0, marginTop: '2px' },
  stepTitle: { fontSize: '14px', fontWeight: 600, color: '#222' },
  stepSub:   { fontSize: '12px', color: '#888', marginTop: '2px' },
  notice:    { background: '#fff8e1', borderRadius: '8px', padding: '14px 16px', fontSize: '13px', color: '#795548', lineHeight: 1.7, marginBottom: '24px', textAlign: 'left' as const },
  btn:       { display: 'inline-block', padding: '14px 32px', background: '#1976d2', color: 'white', borderRadius: '10px', textDecoration: 'none', fontSize: '15px', fontWeight: 700 },
}
