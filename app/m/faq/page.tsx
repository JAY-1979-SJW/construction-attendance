'use client'

import { useState } from 'react'
import Link from 'next/link'

const FAQS = [
  { q: '앱스토어에서 못 찾겠어요', a: '앱스토어 다운로드가 아닙니다. 브라우저에서 접속 후 "홈 화면에 추가"를 해주세요.' },
  { q: '기기 승인이 안 돼요', a: '현장 관리자에게 직접 연락하세요. 보통 당일 내 처리됩니다.' },
  { q: '출근 버튼이 안 눌려요', a: '① 위치 서비스가 켜져 있는지 확인 ② 현장 100m 이내인지 확인 ③ 안 되면 "GPS 예외 신청" 버튼을 이용하세요.' },
  { q: '퇴근을 깜빡했어요', a: '새벽 4시에 자동 퇴근 처리됩니다. 다만 정확한 시간 기록을 위해 직접 퇴근 처리를 권장합니다.' },
  { q: '휴대폰을 바꿨어요', a: '새 휴대폰에서 로그인하면 "기기 변경 요청"이 관리자에게 전달됩니다. 승인 후 사용 가능합니다.' },
  { q: '작업일보를 수정하고 싶어요', a: '당일 내에 같은 화면에서 수정 후 저장하면 됩니다. 관리자 확정 전까지 수정 가능합니다.' },
  { q: '내 공수를 확인하고 싶어요', a: '앱 하단 "공수/급여" 탭에서 월별 캘린더로 확인할 수 있습니다.' },
]

export default function FaqPage() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <div className="px-5 py-6 pb-10">
      <Link href="/m" className="text-[13px] text-gray-400 no-underline mb-4 block">← 메인</Link>
      <h1 className="text-[22px] font-bold text-gray-900 mb-1">자주 묻는 질문</h1>
      <p className="text-[14px] text-gray-500 mb-6">설치, 승인, GPS, 기기변경</p>

      <div className="space-y-2">
        {FAQS.map((f, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <button onClick={() => setOpen(open === i ? null : i)}
              className="flex items-center w-full px-4 py-3.5 bg-transparent border-none cursor-pointer text-left active:bg-gray-50 gap-2">
              <span className="flex-1 text-[14px] font-semibold text-gray-900">{f.q}</span>
              <span className={`text-gray-400 text-[12px] shrink-0 transition-transform ${open === i ? 'rotate-180' : ''}`}>▾</span>
            </button>
            {open === i && (
              <div className="px-4 pb-4 text-[13px] text-gray-500 leading-[1.7]">{f.a}</div>
            )}
          </div>
        ))}
      </div>

      <div className="bg-orange-50 rounded-xl p-4 text-center mt-5">
        <p className="text-[13px] font-bold text-orange-600 mb-1 m-0">더 궁금한 점이 있으면?</p>
        <p className="text-[12px] text-gray-600 m-0">02-562-6652 | jay@haehan-ai.kr</p>
      </div>

      <div className="mt-6">
        <Link href="/m/register" className="block w-full py-[14px] bg-orange-500 text-white rounded-2xl no-underline text-[15px] font-bold text-center active:bg-orange-600">무료 시작하기</Link>
      </div>
    </div>
  )
}
