// 외부회사 인증 대기 안내 페이지 (ops layout 밖에 위치)
// EXTERNAL_SITE_ADMIN이 소속 회사 인증 전 /ops 접근 시 리다이렉트됨
export default function CompanyPendingVerificationPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f5f6f8',
      fontFamily: 'sans-serif',
    }}>
      <div style={{
        background: '#243144',
        border: '1px solid #e5e7eb',
        borderRadius: '16px',
        padding: '48px 40px',
        maxWidth: '480px',
        width: '100%',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', marginBottom: '12px' }}>
          회사 인증 대기 중
        </h1>
        <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.6, marginBottom: '24px' }}>
          소속 회사의 사업자 인증이 완료되지 않았습니다.
          <br />
          인증이 완료되면 현장 운영 기능을 이용하실 수 있습니다.
        </p>
        <div style={{
          background: '#fef9c3',
          border: '1px solid #fde047',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '24px',
          fontSize: '13px',
          color: '#713f12',
        }}>
          담당 관리자에게 인증 처리를 요청해주세요.
        </div>
        <a
          href="/admin/login"
          style={{
            display: 'inline-block',
            padding: '10px 24px',
            background: '#1e3a5f',
            color: 'white',
            borderRadius: '8px',
            textDecoration: 'none',
            fontSize: '14px',
          }}
        >
          로그인 페이지로 이동
        </a>
      </div>
    </div>
  )
}
