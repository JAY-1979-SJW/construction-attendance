/**
 * resolveContractDocumentData
 *
 * PDF · DOC · 화면 미리보기 모두 동일한 원천을 사용하기 위한 공통 resolver.
 *
 * 우선순위 원칙:
 *   1. ContractVersion.snapshotJson 에 담긴 값 (계약 당시 캡처본)
 *   2. 계약 레코드 자체에 저장된 값 (change-terms 이전까지 불변)
 *   3. 현재 Worker/Site 마스터 값 (fallback — 최초 생성 시에만 해당)
 *
 * Worker 마스터(name, phone)는 언제든 변경될 수 있으므로 반드시 snapshot을 우선한다.
 * 다른 계약 필드(임금, 기간, 장소 등)는 계약 레코드에 저장되므로 별도 snapshot 추출 불필요.
 */
import type { ContractData } from './templates'

// ─── 스냅샷 추출 헬퍼 ───────────────────────────────────────────────────────

/**
 * ContractVersion.snapshotJson에서 Worker 관련 필드를 추출한다.
 * snapshotJson 구조: { ...contractRecord, worker: { id, name, phone }, site: { ... } }
 */
function extractSnapshotWorker(snapshotJson: unknown): {
  name:  string | undefined
  phone: string | undefined
} {
  if (!snapshotJson || typeof snapshotJson !== 'object') {
    return { name: undefined, phone: undefined }
  }
  const snap   = snapshotJson as Record<string, unknown>
  const worker = snap.worker
  if (!worker || typeof worker !== 'object') {
    return { name: undefined, phone: undefined }
  }
  const w    = worker as Record<string, unknown>
  const name = typeof w.name  === 'string' ? w.name  : undefined
  const phone = typeof w.phone === 'string' ? w.phone : undefined
  return { name, phone }
}

// ─── 공통 resolver ─────────────────────────────────────────────────────────

/**
 * 계약 DB 레코드 + 버전 스냅샷을 받아 문서 출력용 ContractData를 반환한다.
 *
 * @param contract  prisma.workerContract 레코드 (worker / site include 포함)
 * @param worker    contract.worker (id, name, phone)
 * @param site      contract.site (nullable)
 * @param snapshotJson  ContractVersion.snapshotJson (없으면 null/undefined)
 * @param today     문서 작성일 'YYYY-MM-DD'
 */
export function resolveContractDocumentData(
  contract:     Record<string, unknown>,
  worker:       { name: string; phone?: string | null },
  site:         { name: string; address?: string | null } | null,
  snapshotJson: unknown,
  today:        string,
): ContractData {
  // snapshot-first: Worker 마스터가 바뀌어도 과거 계약 문서는 계약 당시 이름/연락처 유지
  const snap       = extractSnapshotWorker(snapshotJson)
  const workerName  = snap.name  ?? worker.name
  const workerPhone = snap.phone ?? worker.phone ?? undefined

  return {
    // ── 사업주 정보 ────────────────────────────────────────────
    companyName:    (contract.companyName    as string) || '주식회사 해한',
    companyCeo:     (contract.companyRepName as string) || '대표이사',
    companyAddress: (contract.companyAddress as string) || '서울특별시',
    companyBizNo:   contract.companyBizNo   as string | undefined,
    companyPhone:   contract.companyPhone   as string | undefined,

    // ── 근로자 정보 (snapshot 우선) ────────────────────────────
    workerName,
    workerPhone,
    workerBirthDate: contract.workerBirthDate as string | undefined,
    workerAddress:   contract.workerAddress   as string | undefined,
    workerBankName:        contract.workerBankName        as string | undefined,
    workerAccountNumber:   contract.workerAccountNumber   as string | undefined,
    workerAccountHolder:   contract.workerAccountHolder   as string | undefined,

    // ── 현장 정보 ─────────────────────────────────────────────
    siteName:    site?.name    || (contract.siteName    as string) || '미정',
    siteAddress: (contract.siteAddress as string | undefined) || site?.address as string | undefined,
    projectName: contract.projectName as string | undefined,

    // ── 직종 / 업무 ───────────────────────────────────────────
    jobTitle:        (contract.notes as string) || '건설일용직',
    taskDescription: contract.taskDescription as string | undefined,
    workType:        contract.workType        as string | undefined,
    workTypeSub:     contract.workTypeSub     as string | undefined,
    jobCategory:     contract.jobCategory     as string | undefined,
    jobCategorySub:  contract.jobCategorySub  as string | undefined,
    contractForm:    contract.contractForm    as string | undefined,

    // ── 계약 기간 ─────────────────────────────────────────────
    startDate:    contract.startDate as string,
    endDate:      contract.endDate   as string | undefined,
    contractDate: today,
    workDate:     contract.workDate  as string | undefined,

    // ── 근로시간 ──────────────────────────────────────────────
    checkInTime:    contract.checkInTime    as string | undefined,
    checkOutTime:   contract.checkOutTime   as string | undefined,
    breakStartTime: contract.breakStartTime as string | undefined,
    breakEndTime:   contract.breakEndTime   as string | undefined,
    breakHours:     Number(contract.breakHours) || undefined,
    workDays:       contract.workDays       as string | undefined,
    weeklyWorkDays: contract.weeklyWorkDays as number | undefined,
    weeklyWorkHours: contract.weeklyWorkHours ? Number(contract.weeklyWorkHours) : undefined,

    // ── 휴일 / 연차 ───────────────────────────────────────────
    holidayRule:    contract.holidayRule    as string | undefined,
    annualLeaveRule: contract.annualLeaveRule as string | undefined,

    // ── 임금 ──────────────────────────────────────────────────
    paymentMethod:  contract.paymentMethod  as string | undefined,
    dailyWage:      contract.dailyWage      as number | undefined,
    monthlySalary:  contract.monthlySalary  as number | undefined,
    serviceFee:     contract.serviceFee     as number | undefined,
    paymentDay:     contract.paymentDay     as number | undefined,
    allowanceJson:  contract.allowanceJson  as { name: string; amount: number }[] | undefined,

    // ── 수습 ──────────────────────────────────────────────────
    probationYn:     contract.probationYn     as boolean | undefined,
    probationMonths: contract.probationMonths as number  | undefined,

    // ── 현장 특약 ─────────────────────────────────────────────
    attendanceVerificationMethod: contract.attendanceVerificationMethod as string | undefined,
    workUnitRule:     contract.workUnitRule     as string  | undefined,
    rainDayRule:      contract.rainDayRule      as string  | undefined,
    siteStopRule:     contract.siteStopRule     as string  | undefined,
    siteChangeAllowed: contract.siteChangeAllowed as boolean | undefined,

    // ── 용역 / 외주 ───────────────────────────────────────────
    businessRegistrationNo: contract.businessRegistrationNo as string | undefined,
    contractorName:         contract.contractorName         as string | undefined,

    // ── 4대보험 ───────────────────────────────────────────────
    nationalPensionYn:     (contract.nationalPensionYn     as boolean) ?? false,
    healthInsuranceYn:     (contract.healthInsuranceYn     as boolean) ?? false,
    employmentInsuranceYn: (contract.employmentInsuranceYn as boolean) ?? false,
    industrialAccidentYn:  (contract.industrialAccidentYn  as boolean) ?? true,
    retirementMutualYn:    (contract.retirementMutualYn    as boolean) ?? false,

    // ── 안전 / 특약 ───────────────────────────────────────────
    safetyClauseYn: (contract.safetyClauseYn as boolean) ?? true,
    specialTerms:    contract.specialTerms as string | undefined,
    managerName:     contract.managerName  as string | undefined,
  }
}
