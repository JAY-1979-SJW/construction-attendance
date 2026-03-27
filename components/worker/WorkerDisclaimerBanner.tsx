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
    <div className="bg-[#FFF7ED] border-b border-[#FDBA74] px-4 py-2 text-[12px] text-[#9A3412] leading-[1.5] text-center">
      본 앱은 <strong className="text-[#EA580C]">출퇴근·문서 확인</strong>용입니다.
      임금·계약·인사 관련 문의는 <strong className="text-[#EA580C]">소속 관리자</strong>에게 직접 확인해 주세요.
    </div>
  )
}
