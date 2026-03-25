'use client'

const PLANNED_ITEMS = [
  {
    title: '근로자 출근부',
    desc: '근로감독 현장 점검 시 제출하는 근로자별 출퇴근 기록 원본. 날짜·입출입 시각·현장명 포함.',
    badge: '준비중',
  },
  {
    title: '임금대장',
    desc: '월별 근로자 노임 지급 내역서. 기본급·수당·공제·실수령액 항목 포함. 고용노동부 표준 양식 기준.',
    badge: '준비중',
  },
  {
    title: '4대보험 신고 이력',
    desc: '취득·상실 신고 제출 이력과 처리 결과를 기간별로 출력. 분쟁 대응 및 자체 감사 용도.',
    badge: '준비중',
  },
  {
    title: '근로계약서 묶음 출력',
    desc: '현장·기간 조건으로 근로계약서를 일괄 조회하고 PDF 출력. 감독관 현장 제시용.',
    badge: '준비중',
  },
  {
    title: '노동분쟁 대응 자료 패키지',
    desc: '특정 근로자에 대한 출근·노임·계약·보험 기록을 한 묶음으로 내려받는 기능. 행정심판·소송 대응.',
    badge: '준비중',
  },
]

export default function ReportsPage() {
  return (
    <div className="p-6 max-w-[860px]">
      <div className="mb-5">
        <h1 className="text-[20px] font-bold text-[#0F172A]">노동부 대응자료</h1>
        <p className="text-[13px] text-[#6B7280] mt-0.5">근로감독·노무분쟁 대응을 위한 자료 출력</p>
      </div>

      {/* 현재 상태 안내 */}
      <div
        className="rounded-[10px] px-4 py-3 mb-5 text-[12px] text-[#374151]"
        style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}
      >
        <strong className="text-[#C2410C]">구현 전 단계입니다.</strong>
        {' '}출근부·임금대장 등 원시 데이터는 출퇴근관리·노임관리 메뉴에서 조회 가능합니다.
        아래 기능은 운영 안정화 이후 순차적으로 추가됩니다.
      </div>

      {/* 예정 기능 카드 목록 */}
      <div className="flex flex-col gap-3">
        {PLANNED_ITEMS.map((item) => (
          <div
            key={item.title}
            className="rounded-[10px] px-4 py-3.5 flex items-start gap-3"
            style={{ border: '1px solid #E5E7EB', background: '#FFFFFF' }}
          >
            <div
              className="mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: '#F3F4F6', color: '#9CA3AF' }}
            >
              {item.badge}
            </div>
            <div>
              <p className="text-[13px] font-semibold text-[#0F172A] mb-0.5">{item.title}</p>
              <p className="text-[12px] text-[#6B7280] leading-relaxed">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
