'use client'

/**
 * WorkerDisclaimerBanner
 *
 * 근로자 화면 상단 고정 문구.
 * "본 앱은 출퇴근·문서 확인용입니다."
 * 임금/계약/인사 문의는 관리자를 통하도록 안내.
 */
export default function WorkerDisclaimerBanner() {
  return (
    <div
      style={{
        background: 'rgba(244,121,32,0.08)',
        borderBottom: '1px solid rgba(244,121,32,0.2)',
        padding: '8px 16px',
        fontSize: '12px',
        color: '#E8A870',
        lineHeight: '1.5',
        textAlign: 'center',
      }}
    >
      본 앱은 <strong style={{ color: '#F47920' }}>출퇴근·문서 확인</strong>용입니다.
      임금·계약·인사 관련 문의는 <strong style={{ color: '#F47920' }}>소속 관리자</strong>에게 직접 확인해 주세요.
    </div>
  )
}
