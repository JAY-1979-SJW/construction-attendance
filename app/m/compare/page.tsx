import Link from 'next/link'

export default function ComparePage() {
  return (
    <div className="px-5 py-6 pb-10">
      <Link href="/m" className="text-[13px] text-gray-400 no-underline mb-4 block">← 메인</Link>
      <h1 className="text-[22px] font-bold text-gray-900 mb-1">수기 vs 전자</h1>
      <p className="text-[14px] text-gray-500 mb-6">기록 방식에 따라 보호 수준이 달라집니다</p>

      <div className="bg-orange-50 rounded-xl p-4 border border-orange-100 mb-3">
        <div className="text-[15px] font-bold text-orange-700 mb-3">수기 출석부</div>
        <div className="space-y-2">
          {[
            '대리 서명이 가능해 기록의 신뢰도가 낮습니다',
            '분쟁 시 사업주도 근로자도 증명이 어렵습니다',
            '정산 오류로 근로자가 정당한 임금을 못 받을 수 있습니다',
            '감독관 점검 시 보완을 요구받을 수 있습니다',
          ].map(t => (
            <div key={t} className="flex items-start gap-2">
              <span className="text-orange-500 shrink-0 mt-0.5">-</span>
              <span className="text-[13px] text-orange-700">{t}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-green-50 rounded-xl p-4 border border-green-100">
        <div className="text-[15px] font-bold text-green-700 mb-3">GPS 전자 출퇴근</div>
        <div className="space-y-2">
          {[
            'GPS + 시간 자동 기록으로 양측 모두 증명 가능합니다',
            '근로자는 본인 기록을 직접 확인하고, 사업주는 투명하게 관리합니다',
            '자동 집계로 정확한 급여를 보장하고 분쟁을 예방합니다',
            '법정 서류가 즉시 출력 가능해 점검에도 안심입니다',
          ].map(t => (
            <div key={t} className="flex items-start gap-2">
              <span className="text-green-600 shrink-0 mt-0.5">+</span>
              <span className="text-[13px] text-green-700">{t}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <Link href="/m/register" className="block w-full py-[14px] bg-orange-500 text-white rounded-2xl no-underline text-[15px] font-bold text-center active:bg-orange-600">무료 시작하기</Link>
      </div>
    </div>
  )
}
