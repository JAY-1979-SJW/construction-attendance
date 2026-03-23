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
        background: '#fff8e1',
        borderBottom: '1px solid #ffe082',
        padding: '8px 16px',
        fontSize: '12px',
        color: '#795548',
        lineHeight: '1.5',
        textAlign: 'center',
      }}
    >
      본 앱은 <strong>출퇴근·문서 확인</strong>용입니다.
      임금·계약·인사 관련 문의는 <strong>소속 관리자</strong>에게 직접 확인해 주세요.
    </div>
  )
}
