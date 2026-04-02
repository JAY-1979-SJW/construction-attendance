import Link from 'next/link'

export default function UsersPage() {
  return (
    <div className="px-5 py-6 pb-10">
      <Link href="/m" className="text-[13px] text-gray-400 no-underline mb-4 block">← 메인</Link>
      <h1 className="text-[22px] font-bold text-gray-900 mb-1">누가 사용하나요</h1>
      <p className="text-[14px] text-gray-500 mb-6">근로자와 사업자 각각의 기능</p>

      <div className="bg-orange-50 rounded-xl p-4 border border-orange-100 mb-3">
        <div className="text-[15px] font-bold text-gray-900 mb-3">근로자</div>
        {['GPS로 간편 출퇴근', '내 공수와 급여를 캘린더로 확인', '작업일보 작성 및 사진 첨부', '근로계약서·안전교육 전자서명', '자재 청구 요청'].map(t => (
          <div key={t} className="flex items-center gap-2 mb-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
            <span className="text-[13px] text-gray-700">{t}</span>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
        <div className="text-[15px] font-bold text-gray-900 mb-3">사업자 (관리자)</div>
        {['현장별 출근 현황 실시간 확인', '공수·급여 자동 정산', '4대보험·퇴직공제 자동 집계', '노임대장·세금계산표 엑셀 출력', '근로자 승인·현장 배정 관리', '작업일보 검토 및 확정'].map(t => (
          <div key={t} className="flex items-center gap-2 mb-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
            <span className="text-[13px] text-gray-700">{t}</span>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <Link href="/m/register" className="block w-full py-[14px] bg-orange-500 text-white rounded-2xl no-underline text-[15px] font-bold text-center active:bg-orange-600">무료 시작하기</Link>
      </div>
    </div>
  )
}
