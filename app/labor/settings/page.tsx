'use client'

const PLANNED_SETTINGS = [
  {
    title: '노임 단가 기본값',
    desc: '근로형태별(일용직·상용직·3.3%용역) 기본 일당 단가를 설정합니다. 근로자 등록 시 자동 적용.',
    badge: '준비중',
  },
  {
    title: '4대보험 가입 기준 설정',
    desc: '월 최소 근무일수, 월 최소 소득액 등 보험 가입 판정 기준값을 회사 단위로 조정합니다.',
    badge: '준비중',
  },
  {
    title: '노임 확정 알림',
    desc: '월마감 전 미확정 노임 건수가 기준값 이상이면 관리자에게 알림을 발송하는 규칙을 설정합니다.',
    badge: '준비중',
  },
  {
    title: '서류 만료 알림',
    desc: '신분증·계약서 만료 N일 전 자동 알림 발송 설정. 현재 알림 채널: 관리자 포털 내 알림.',
    badge: '준비중',
  },
]

export default function LaborSettingsPage() {
  return (
    <div className="p-6 max-w-[860px]">
      <div className="mb-5">
        <h1 className="text-[20px] font-bold text-title-brand">설정</h1>
        <p className="text-[13px] text-muted-brand mt-0.5">노무관리 앱 전용 설정</p>
      </div>

      {/* 현재 상태 안내 */}
      <div
        className="rounded-[10px] px-4 py-3 mb-5 text-[12px] text-body-brand"
        style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}
      >
        <strong className="text-[#C2410C]">구현 전 단계입니다.</strong>
        {' '}시스템 기본값으로 운영 중입니다. 아래 항목은 운영 안정화 이후 순차적으로 활성화됩니다.
      </div>

      <div className="flex flex-col gap-3">
        {PLANNED_SETTINGS.map((item) => (
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
              <p className="text-[13px] font-semibold text-title-brand mb-0.5">{item.title}</p>
              <p className="text-[12px] text-muted-brand leading-relaxed">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
