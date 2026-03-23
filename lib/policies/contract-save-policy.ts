/**
 * contract-save-policy.ts
 *
 * 유형별 필수 입력값 및 3단계 저장 검증 정책.
 *
 * 3단계 상태:
 *   SAVEABLE   — 임시저장 가능. 기본 필수값 충족.
 *   GENERATABLE — 문서 생성 가능. 유형별 필수값 + 문서 세트 조건 충족.
 *   SIGNABLE    — 서명 가능. 문서 생성 가능 + 근로자 확인 + 최종 체크 완료.
 *
 * 근거 지시문: 유형별 필수 입력값/저장 검증 로직 정리 지시문 (2026-03-23)
 */

// ─── 타입 정의 ───────────────────────────────────────────────

export type ContractStage = 'SAVEABLE' | 'GENERATABLE' | 'SIGNABLE'

export interface ValidationError {
  /** 차단 여부: true = 저장/생성 차단, false = 경고만 */
  blocking: boolean
  message: string
  /** 어느 필드를 가리키는지 (UI 하이라이트용, optional) */
  field?: string
}

export interface StageValidationResult {
  /** 도달 가능한 최고 단계 */
  stage: ContractStage
  /** 차단 오류 목록 (차단: 현재 동작 불가) */
  errors: ValidationError[]
  /** 경고 목록 (차단하지 않지만 확인 권장) */
  warnings: ValidationError[]
}

/** 검증에 필요한 계약 입력 필드 요약 */
export interface ContractFields {
  // 공통
  laborRelation:        string   // 'DIRECT_EMPLOYEE' | 'SUBCONTRACT_BIZ' | 'TEAM_NONBIZ_REVIEW'
  contractTemplateType: string
  workerId:             string
  startDate:            string
  endDate:              string

  // 임금
  dailyWage:      string | number
  monthlySalary:  string | number
  serviceFee:     string | number

  // 상용직/기간제
  checkInTime:    string
  checkOutTime:   string

  // 외주
  businessRegistrationNo: string
  contractorName:         string

  // 근로자 확인 (서명 단계)
  workerViewConfirmed:    boolean
  workerPresignConfirmed: boolean
}

// ─── 내부 헬퍼 ───────────────────────────────────────────────

function hasWage(f: Pick<ContractFields, 'dailyWage' | 'monthlySalary' | 'serviceFee'>): boolean {
  return !!(
    (typeof f.dailyWage === 'number' ? f.dailyWage > 0 : !!f.dailyWage) ||
    (typeof f.monthlySalary === 'number' ? f.monthlySalary > 0 : !!f.monthlySalary) ||
    (typeof f.serviceFee === 'number' ? f.serviceFee > 0 : !!f.serviceFee)
  )
}

const DAILY_TEMPLATES   = ['DAILY_EMPLOYMENT', 'MONTHLY_FIXED_EMPLOYMENT', 'CONTINUOUS_EMPLOYMENT']
const REGULAR_TEMPLATES = ['REGULAR_EMPLOYMENT']
const FIXED_TERM_TEMPLATES = ['FIXED_TERM_EMPLOYMENT']
const SUBCON_TEMPLATES  = ['SUBCONTRACT_WITH_BIZ', 'FREELANCER_SERVICE', 'NONBUSINESS_TEAM_REVIEW']

// ─── 임시저장 검증 ────────────────────────────────────────────

/**
 * 임시저장 가능 여부 검증.
 * 가장 느슨한 단계 — 공통 필수값만 확인.
 */
export function validateForSave(f: ContractFields): ValidationError[] {
  const errors: ValidationError[] = []

  if (!f.workerId) {
    errors.push({ blocking: true, message: '근로자를 선택하세요.', field: 'workerId' })
  }
  if (!f.contractTemplateType) {
    errors.push({ blocking: true, message: '계약 유형을 먼저 선택하세요.', field: 'contractTemplateType' })
  }
  if (!f.startDate) {
    errors.push({ blocking: true, message: '계약 시작일을 입력하세요.', field: 'startDate' })
  }

  // 외주/협력팀인데 직접고용 템플릿 선택 → 저장 단계부터 차단
  const isSubcon = ['SUBCONTRACT_BIZ', 'TEAM_NONBIZ_REVIEW'].includes(f.laborRelation)
  if (isSubcon && DAILY_TEMPLATES.concat(REGULAR_TEMPLATES, FIXED_TERM_TEMPLATES).includes(f.contractTemplateType)) {
    errors.push({
      blocking: true,
      message:  '외주/협력팀 유형은 자사 직접 근로계약서 생성 대상이 아닙니다.',
      field:    'contractTemplateType',
    })
  }

  return errors
}

// ─── 문서 생성 검증 ───────────────────────────────────────────

/**
 * 문서(계약서 PDF 등) 생성 가능 여부 검증.
 * 임시저장보다 엄격 — 유형별 필수값 + 문서 세트 조건.
 */
export function validateForGenerate(f: ContractFields): ValidationError[] {
  // 임시저장 기본 검증 먼저
  const errors: ValidationError[] = validateForSave(f)

  const isDirectEmployment = f.laborRelation === 'DIRECT_EMPLOYEE'
  const isSubcon = ['SUBCONTRACT_BIZ', 'TEAM_NONBIZ_REVIEW'].includes(f.laborRelation)

  // ── A. 일용직 ─────────────────────────────────────────────
  if (isDirectEmployment && DAILY_TEMPLATES.includes(f.contractTemplateType)) {
    if (!hasWage(f)) {
      errors.push({
        blocking: true,
        message:  '일용직은 일당 또는 공수 계산 기준(일당)을 입력해야 계약서를 생성할 수 있습니다.',
        field:    'dailyWage',
      })
    }
    // 종료일이 들어가도 운영상 의미 모호하면 경고 (차단 아님)
    if (f.endDate && REGULAR_TEMPLATES.includes(f.contractTemplateType)) {
      errors.push({
        blocking: false,
        message:  '일용직은 일반적으로 종료일을 별도로 지정하지 않습니다. 기간제 계약서가 맞는지 확인하세요.',
        field:    'endDate',
      })
    }
  }

  // ── B. 상용직 ─────────────────────────────────────────────
  if (isDirectEmployment && REGULAR_TEMPLATES.includes(f.contractTemplateType)) {
    if (!hasWage(f)) {
      errors.push({
        blocking: true,
        message:  '상용직은 월급 또는 임금 기준을 입력해야 계약서를 생성할 수 있습니다.',
        field:    'monthlySalary',
      })
    }
    if (!f.checkInTime || !f.checkOutTime) {
      errors.push({
        blocking: true,
        message:  '상용직은 소정근로시간(시업·종업 시각)을 입력해야 계약서를 생성할 수 있습니다.',
        field:    'checkInTime',
      })
    }
    // 상용직인데 종료일 입력 시 경고 (차단 아님)
    if (f.endDate) {
      errors.push({
        blocking: false,
        message:  '상용직은 일반적으로 종료일 없는 구조입니다. 종료일이 입력되었습니다. 기간제가 맞는 경우 유형을 변경하세요.',
        field:    'endDate',
      })
    }
    // 상용직인데 기간제 템플릿 연결 차단
    if (FIXED_TERM_TEMPLATES.includes(f.contractTemplateType)) {
      errors.push({
        blocking: true,
        message:  '상용직 유형에는 기간제 계약서를 사용할 수 없습니다.',
        field:    'contractTemplateType',
      })
    }
  }

  // ── C. 기간제 ─────────────────────────────────────────────
  if (isDirectEmployment && FIXED_TERM_TEMPLATES.includes(f.contractTemplateType)) {
    if (!f.endDate) {
      errors.push({
        blocking: true,
        message:  '기간제 계약서는 계약 종료일 입력이 필요합니다. 종료일을 입력하세요.',
        field:    'endDate',
      })
    } else if (f.startDate && f.endDate <= f.startDate) {
      errors.push({
        blocking: true,
        message:  '계약 종료일은 시작일보다 빠를 수 없습니다.',
        field:    'endDate',
      })
    }
    if (!hasWage(f)) {
      errors.push({
        blocking: true,
        message:  '기간제는 임금(월급 또는 일당) 입력이 필요합니다.',
        field:    'monthlySalary',
      })
    }
    // 기간제인데 상용직 템플릿 → 차단
    if (REGULAR_TEMPLATES.includes(f.contractTemplateType)) {
      errors.push({
        blocking: true,
        message:  '기간제 유형에는 상용직 근로계약서를 사용할 수 없습니다.',
        field:    'contractTemplateType',
      })
    }
  }

  // ── D. 외주/협력팀 ────────────────────────────────────────
  if (isSubcon) {
    // 직접고용 계약서 차단은 validateForSave 에서 이미 처리
    if (!f.contractorName && f.laborRelation === 'SUBCONTRACT_BIZ') {
      errors.push({
        blocking: true,
        message:  '외주/협력팀 계약은 소속업체명 입력이 필요합니다.',
        field:    'contractorName',
      })
    }
    if (f.laborRelation === 'SUBCONTRACT_BIZ' && !f.businessRegistrationNo) {
      errors.push({
        blocking: false,
        message:  '사업자 있는 외주팀은 사업자등록번호 입력을 권장합니다.',
        field:    'businessRegistrationNo',
      })
    }
  }

  return errors
}

// ─── 서명 전 검증 ─────────────────────────────────────────────

/**
 * 전자서명 가능 여부 검증.
 * 가장 엄격한 단계 — 문서 생성 가능 조건 + 근로자 확인 완료.
 */
export function validateForSign(f: ContractFields): ValidationError[] {
  const errors: ValidationError[] = validateForGenerate(f)

  if (!f.workerViewConfirmed) {
    errors.push({
      blocking: true,
      message:  '근로자의 계약 내용 열람 확인이 완료되지 않았습니다.',
      field:    'workerViewConfirmed',
    })
  }
  if (!f.workerPresignConfirmed) {
    errors.push({
      blocking: true,
      message:  '근로자의 서명 전 최종 확인이 완료되지 않았습니다.',
      field:    'workerPresignConfirmed',
    })
  }

  // 유형별 최종 표시 재확인 (차단 아닌 경고)
  const isFixed = FIXED_TERM_TEMPLATES.includes(f.contractTemplateType)
  const isSubcon = ['SUBCONTRACT_BIZ', 'TEAM_NONBIZ_REVIEW'].includes(f.laborRelation)

  if (isFixed && f.endDate) {
    // 종료일 최종 재확인 안내 (정보성)
    errors.push({
      blocking: false,
      message:  `기간제 계약 — 종료일 ${f.endDate} 최종 확인 완료`,
    })
  }
  if (isSubcon && f.contractorName) {
    errors.push({
      blocking: false,
      message:  `외주/협력팀 — 소속업체 "${f.contractorName}" 최종 확인 완료`,
    })
  }

  return errors
}

// ─── 단계 계산 헬퍼 ──────────────────────────────────────────

/**
 * 현재 필드 상태를 기준으로 도달 가능한 최고 단계를 반환한다.
 */
export function resolveContractStage(f: ContractFields): StageValidationResult {
  const saveErrors     = validateForSave(f)
  const generateErrors = validateForGenerate(f)
  const signErrors     = validateForSign(f)

  const hasBlockingSave     = saveErrors.some(e => e.blocking)
  const hasBlockingGenerate = generateErrors.some(e => e.blocking)
  const hasBlockingSign     = signErrors.some(e => e.blocking)

  let stage: ContractStage
  if (hasBlockingSave)     stage = 'SAVEABLE'        // 저장도 불가 → 실제론 입력 부족 상태
  else if (hasBlockingGenerate) stage = 'SAVEABLE'   // 저장은 가능, 생성은 불가
  else if (hasBlockingSign) stage = 'GENERATABLE'    // 생성 가능, 서명 불가
  else                      stage = 'SIGNABLE'

  const blocking = generateErrors.filter(e => e.blocking)
  const warnings = generateErrors.filter(e => !e.blocking)

  return { stage, errors: blocking, warnings }
}

// ─── 스테이지 라벨 헬퍼 ──────────────────────────────────────

export const STAGE_LABELS: Record<ContractStage, { label: string; color: string }> = {
  SAVEABLE:    { label: '임시저장 가능',    color: '#999'    },
  GENERATABLE: { label: '문서 생성 가능',   color: '#1976d2' },
  SIGNABLE:    { label: '서명 진행 가능',   color: '#2e7d32' },
}
