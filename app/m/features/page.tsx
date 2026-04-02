import Link from 'next/link'

const FEATURES = [
  { icon: '📍', name: 'GPS 출퇴근', desc: '현장 도착 시 버튼 하나로 출근, GPS로 위치 자동 확인' },
  { icon: '📋', name: '작업일보', desc: '공종, 위치, 사진과 함께 일일 작업 내용 기록' },
  { icon: '💰', name: '공수·급여 자동계산', desc: '출퇴근 기록 기반으로 공수 집계, 급여 자동 산출' },
  { icon: '📄', name: '전자 계약·서명', desc: '근로계약서를 모바일에서 확인하고 전자서명' },
  { icon: '🛡️', name: '안전교육 확인', desc: '안전교육 확인서, 보호구 지급서 전자서명 처리' },
  { icon: '📊', name: '4대보험 자동집계', desc: '고용보험, 산재보험, 퇴직공제 요율 기반 자동 계산' },
  { icon: '📅', name: '근무 캘린더', desc: '월별 출퇴근과 공수를 캘린더로 한눈에 확인' },
  { icon: '🔔', name: '체류확인 알림', desc: '현장 재실 여부를 푸시 알림으로 확인' },
  { icon: '📦', name: '자재 청구', desc: '현장에서 바로 자재 요청, 관리자 승인 처리' },
]

export default function FeaturesPage() {
  return (
    <div className="px-5 py-6 pb-10">
      <Link href="/m" className="text-[13px] text-gray-400 no-underline mb-4 block">← 메인</Link>
      <h1 className="text-[22px] font-bold text-gray-900 mb-1">핵심 기능</h1>
      <p className="text-[14px] text-gray-500 mb-6">출퇴근부터 급여까지 한번에 관리합니다</p>
      <div className="space-y-2">
        {FEATURES.map(f => (
          <div key={f.name} className="flex items-start gap-3 bg-white rounded-xl px-4 py-3.5 border border-gray-100">
            <span className="text-[20px] shrink-0 mt-0.5">{f.icon}</span>
            <div className="min-w-0">
              <div className="text-[14px] font-bold text-gray-900">{f.name}</div>
              <div className="text-[12px] text-gray-500 mt-0.5">{f.desc}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6">
        <Link href="/m/register" className="block w-full py-[14px] bg-orange-500 text-white rounded-2xl no-underline text-[15px] font-bold text-center active:bg-orange-600">무료 시작하기</Link>
      </div>
    </div>
  )
}
