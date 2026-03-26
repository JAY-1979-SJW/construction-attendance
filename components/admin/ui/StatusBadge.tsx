const BADGE_MAP: Record<string, { label: string; cls: string }> = {
  // 출퇴근 상태
  WORKING:          { label: '근무중',   cls: 'bg-[#ECFDF5] text-[#16A34A] border-[#A7F3D0]' },
  COMPLETED:        { label: '완료',     cls: 'bg-[#F3F4F6] text-[#6B7280] border-[#D1D5DB]' },
  MISSING_CHECKOUT: { label: '미퇴근',   cls: 'bg-[#FEE2E2] text-[#B91C1C] border-[#F87171]' },
  EXCEPTION:        { label: '예외',     cls: 'bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]' },
  ADJUSTED:         { label: '보정',     cls: 'bg-[#F3E8FF] text-[#7C3AED] border-[#DDD6FE]' },
  // 승인 상태
  PENDING:              { label: '대기',      cls: 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]' },
  APPROVED:             { label: '승인',      cls: 'bg-[#D1FAE5] text-[#065F46] border-[#6EE7B7]' },
  REJECTED:             { label: '반려',      cls: 'bg-[#FEE2E2] text-[#991B1B] border-[#F87171]' },
  // 계정/현장 상태
  ACTIVE:               { label: '활성',      cls: 'bg-[#D1FAE5] text-[#065F46] border-[#6EE7B7]' },
  INACTIVE:             { label: '비활성',    cls: 'bg-[#F3F4F6] text-[#6B7280] border-[#D1D5DB]' },
  PENDING_VERIFICATION: { label: '인증 대기', cls: 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]' },
  VERIFIED:             { label: '인증 완료', cls: 'bg-[#D1FAE5] text-[#065F46] border-[#6EE7B7]' },
  DRAFT:                { label: '미제출',    cls: 'bg-[#F3F4F6] text-[#6B7280] border-[#D1D5DB]' },
  // 작업일보 상태
  WRITTEN:              { label: '작성완료',  cls: 'bg-[#EFF6FF] text-[#2563EB] border-[#93C5FD]' },
  CONFIRMED:            { label: '확인완료',  cls: 'bg-[#ECFDF5] text-[#16A34A] border-[#A7F3D0]' },
  // 소속 구분
  SUBCONTRACTOR:        { label: '협력사',    cls: 'bg-[#FFF7ED] text-[#EA580C] border-[#FDBA74]' },
  DIRECT:               { label: '직영',      cls: 'bg-[#F3F4F6] text-[#374151] border-[#D1D5DB]' },
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const s = BADGE_MAP[status] ?? { label: label ?? status, cls: 'bg-[#F3F4F6] text-[#6B7280] border-[#D1D5DB]' }
  return (
    <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full border ${s.cls}`}>
      {label ?? s.label}
    </span>
  )
}
