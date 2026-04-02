import Link from 'next/link'

const STEPS = [
  { n: '1', title: '가입', desc: '이메일 또는 Google/카카오로 간편하게 가입합니다. 약 2분이면 완료됩니다.' },
  { n: '2', title: '현장 배정', desc: '관리자가 현장을 배정하면 알림이 옵니다. 현장 정보와 주소를 확인할 수 있습니다.' },
  { n: '3', title: '출퇴근', desc: '현장 100m 이내에서 출근 버튼을 누르면 GPS로 자동 확인됩니다. 퇴근도 같은 방식입니다.' },
  { n: '4', title: '작업일보 작성', desc: '퇴근 전에 오늘 한 작업을 기록합니다. 어제 작업을 자동으로 불러와 수정할 수 있습니다.' },
  { n: '5', title: '공수 확인', desc: '캘린더에서 월별 출퇴근과 공수를 확인합니다. 급여 명세도 함께 볼 수 있습니다.' },
]

export default function FlowPage() {
  return (
    <div className="px-5 py-6 pb-10">
      <Link href="/m" className="text-[13px] text-gray-400 no-underline mb-4 block">← 메인</Link>
      <h1 className="text-[22px] font-bold text-gray-900 mb-1">이렇게 사용합니다</h1>
      <p className="text-[14px] text-gray-500 mb-6">가입부터 공수 확인까지 5단계</p>
      <div className="space-y-4">
        {STEPS.map(s => (
          <div key={s.n} className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-orange-500 text-white text-[14px] font-bold flex items-center justify-center shrink-0">{s.n}</div>
            <div className="bg-white rounded-xl p-4 border border-gray-100 flex-1">
              <div className="text-[15px] font-bold text-gray-900 mb-1">{s.title}</div>
              <div className="text-[13px] text-gray-500 leading-[1.7]">{s.desc}</div>
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
