const BADGE_MAP: Record<string, { label: string; cls: string }> = {
  // 출퇴근 상태
  WORKING:          { label: '근무중',   cls: 'bg-green-light text-status-working border-[#A7F3D0]' },
  COMPLETED:        { label: '완료',     cls: 'bg-footer text-muted-brand border-[#D1D5DB]' },
  MISSING_CHECKOUT: { label: '미퇴근',   cls: 'bg-red-light text-status-missing border-[#F87171]' },
  EXCEPTION:        { label: '예외',     cls: 'bg-yellow-light text-status-exception border-yellow' },
  ADJUSTED:         { label: '보정',     cls: 'bg-[#F3E8FF] text-status-adjusted border-purple' },
  // 승인 상태
  PENDING:              { label: '대기',      cls: 'bg-yellow-light text-status-pending border-yellow' },
  APPROVED:             { label: '승인',      cls: 'bg-[#D1FAE5] text-status-approved border-[#6EE7B7]' },
  REJECTED:             { label: '반려',      cls: 'bg-red-light text-status-rejected border-[#F87171]' },
  // 계정/현장 상태
  ACTIVE:               { label: '활성',      cls: 'bg-[#D1FAE5] text-status-approved border-[#6EE7B7]' },
  INACTIVE:             { label: '비활성',    cls: 'bg-footer text-muted-brand border-[#D1D5DB]' },
  PENDING_VERIFICATION: { label: '인증 대기', cls: 'bg-yellow-light text-status-pending border-yellow' },
  VERIFIED:             { label: '인증 완료', cls: 'bg-[#D1FAE5] text-status-approved border-[#6EE7B7]' },
  DRAFT:                { label: '미제출',    cls: 'bg-footer text-muted-brand border-[#D1D5DB]' },
  // 작업일보 상태
  WRITTEN:              { label: '작성완료',  cls: 'bg-blue-light text-status-info border-[#93C5FD]' },
  CONFIRMED:            { label: '확인완료',  cls: 'bg-green-light text-status-working border-[#A7F3D0]' },
  // 소속 구분
  SUBCONTRACTOR:        { label: '협력사',    cls: 'bg-accent-light text-accent-hover border-accent-light' },
  DIRECT:               { label: '직영',      cls: 'bg-footer text-body-brand border-[#D1D5DB]' },
  // 자격/보험 상태
  ELIGIBLE:             { label: '적격',      cls: 'bg-green-light text-status-working border-[#A7F3D0]' },
  INELIGIBLE:           { label: '부적격',    cls: 'bg-red-light text-status-missing border-[#F87171]' },
  NOT_STARTED:          { label: '미시작',    cls: 'bg-footer text-muted-brand border-[#D1D5DB]' },
  IN_PROGRESS:          { label: '진행중',    cls: 'bg-yellow-light text-status-pending border-yellow' },
  READY:                { label: '준비완료',  cls: 'bg-blue-light text-status-info border-[#93C5FD]' },
  EXEMPT:               { label: '해당없음',  cls: 'bg-footer text-muted2-brand border-brand' },
  // 서류 상태
  ISSUED:               { label: '발행',      cls: 'bg-blue-light text-status-info border-[#93C5FD]' },
  SIGNED:               { label: '서명완료',  cls: 'bg-green-light text-status-working border-[#A7F3D0]' },
  ENDED:                { label: '종료',      cls: 'bg-footer text-muted-brand border-[#D1D5DB]' },
  // 출근/미출근
  CHECKED_IN:           { label: '출근',      cls: 'bg-green-light text-status-working border-[#A7F3D0]' },
  NOT_CHECKED_IN:       { label: '미출근',    cls: 'bg-red-light text-status-missing border-[#F87171]' },
  NOT_ASSIGNED:         { label: '미배정',    cls: 'bg-yellow-light text-status-pending border-yellow' },
  // 기기 상태
  DEVICE_APPROVED:      { label: '기기승인',  cls: 'bg-[#D1FAE5] text-status-approved border-[#6EE7B7]' },
  DEVICE_PENDING:       { label: '기기대기',  cls: 'bg-yellow-light text-status-pending border-yellow' },
  NO_DEVICE:            { label: '미등록',    cls: 'bg-footer text-muted2-brand border-brand' },
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const s = BADGE_MAP[status] ?? { label: label ?? status, cls: 'bg-footer text-muted-brand border-[#D1D5DB]' }
  return (
    <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full border ${s.cls}`}>
      {label ?? s.label}
    </span>
  )
}
