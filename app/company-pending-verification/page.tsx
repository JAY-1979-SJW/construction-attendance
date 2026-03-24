// 외부회사 인증 대기 안내 페이지 (ops layout 밖에 위치)
// EXTERNAL_SITE_ADMIN이 소속 회사 인증 전 /ops 접근 시 리다이렉트됨
export default function CompanyPendingVerificationPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f6f8] font-sans">
      <div className="bg-card border border-[#e5e7eb] rounded-2xl px-10 py-12 max-w-[480px] w-full text-center">
        <div className="text-[48px] mb-4">🔒</div>
        <h1 className="text-[20px] font-bold text-[#111827] mb-3">
          회사 인증 대기 중
        </h1>
        <p className="text-[14px] text-[#6b7280] leading-relaxed mb-6">
          소속 회사의 사업자 인증이 완료되지 않았습니다.
          <br />
          인증이 완료되면 현장 운영 기능을 이용하실 수 있습니다.
        </p>
        <div className="bg-[#fef9c3] border border-[#fde047] rounded-lg px-4 py-3 mb-6 text-[13px] text-[#713f12]">
          담당 관리자에게 인증 처리를 요청해주세요.
        </div>
        <a
          href="/admin/login"
          className="inline-block px-6 py-[10px] bg-[#1e3a5f] text-white rounded-lg no-underline text-[14px]"
        >
          로그인 페이지로 이동
        </a>
      </div>
    </div>
  )
}
