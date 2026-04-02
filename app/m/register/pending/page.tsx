import Link from 'next/link'

export default function MobilePendingPage() {
  return (
    <div className="px-5 py-10 text-center">
      <div className="w-16 h-16 bg-green-50 border-2 border-green-200 rounded-full flex items-center justify-center text-[28px] mx-auto mb-5">✓</div>
      <h1 className="text-[22px] font-bold text-gray-900 mb-2">가입 완료</h1>
      <p className="text-[15px] text-gray-500 leading-[1.7] mb-7">
        <span className="text-orange-500 font-semibold">관리자 승인 후</span> 사용할 수 있습니다.
      </p>

      <div className="text-left mb-6 space-y-2.5">
        {[
          { icon: '✅', name: '개인정보 동의', note: '가입 시 완료', color: 'text-green-600' },
          { icon: '⏳', name: '근로계약서', note: '현장 배정 후 생성', color: 'text-gray-400' },
          { icon: '⏳', name: '안전교육 확인서', note: '현장 배정 후 생성', color: 'text-gray-400' },
          { icon: '📄', name: '건강 각서', note: '승인 후 제출', color: 'text-orange-500' },
        ].map(d => (
          <div key={d.name} className="flex items-start gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3.5">
            <span className="text-[18px] mt-0.5 shrink-0">{d.icon}</span>
            <div>
              <div className="text-[14px] font-semibold text-gray-900">{d.name}</div>
              <div className={`text-[12px] mt-0.5 ${d.color}`}>{d.note}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-gray-100 rounded-2xl px-4 py-3 mb-6 text-[13px] text-gray-500 leading-[1.7]">
        승인은 영업일 1~2일 이내 처리됩니다.
      </div>

      <Link href="/m/login" className="block w-full py-4 bg-orange-500 text-white rounded-2xl no-underline text-[16px] font-bold text-center active:bg-orange-600">
        로그인 화면으로
      </Link>
    </div>
  )
}
