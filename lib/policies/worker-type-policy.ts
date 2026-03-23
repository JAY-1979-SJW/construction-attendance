/**
 * 근로자 유형 분류 정책 — 단일 진실 원천(Single Source of Truth)
 *
 * 모든 유형 분기는 이 파일의 함수와 상수를 통해서만 처리한다.
 * 코드 내에서 `employmentType === 'DAILY_CONSTRUCTION'` 같은 직접 비교를 하지 말 것.
 *
 * 유형 체계:
 *   - 일용직   : DAILY_CONSTRUCTION → 일 단위 공수 체계, 일용근로계약서
 *   - 상용직   : REGULAR            → 근태 관리, 상용 근로계약서
 *   - 기간제   : FIXED_TERM         → 근태 관리, 기간제 계약서, 계약기간 필수
 *   - 계속근로형: CONTINUOUS_SITE    → 현장 공수 허용, 독립 정책 가능
 *   - 사업소득 : BUSINESS_33         → 용역계약, 공수 미적용
 *   - 기타     : OTHER               → 운영자 수동 관리
 *
 * 소속 체계:
 *   - 직영     : DIRECT             → 자사 근로자, 급여/정산 대상
 *   - 협력사   : SUBCONTRACTOR      → 외주/협력팀, 급여정산 제외 권고
 */

// ─── 유형 분류 집합 ──────────────────────────────────────────────────────────

/** 일용직 공수 체계 적용 대상 EmploymentType */
export const DAILY_WORK_UNIT_TYPES = ['DAILY_CONSTRUCTION', 'CONTINUOUS_SITE'] as const
type DailyWorkUnitType = typeof DAILY_WORK_UNIT_TYPES[number]

/** 근태 관리 대상 EmploymentType (공수 체계 미적용) */
export const ATTENDANCE_MANAGED_TYPES = ['REGULAR', 'FIXED_TERM'] as const
type AttendanceManagedType = typeof ATTENDANCE_MANAGED_TYPES[number]

/** 비일용 근로자 유형 (일용직 문서/계산 규칙 미적용) */
export const NON_DAILY_EMPLOYMENT_TYPES = ['REGULAR', 'FIXED_TERM', 'CONTINUOUS_SITE', 'BUSINESS_33'] as const

/** 외주/협력팀 소속 OrganizationType */
export const OUTSOURCED_ORG_TYPES = ['SUBCONTRACTOR'] as const
type OutsourcedOrgType = typeof OUTSOURCED_ORG_TYPES[number]

/** 직영 소속 OrganizationType */
export const DIRECT_ORG_TYPES = ['DIRECT'] as const

// ─── 분류 함수 ───────────────────────────────────────────────────────────────

/** 일용직 공수 체계 적용 대상인지 */
export function isWorkUnitTarget(employmentType: string): employmentType is DailyWorkUnitType {
  return (DAILY_WORK_UNIT_TYPES as readonly string[]).includes(employmentType)
}

/** 일용직(건설 일용근로자)인지 */
export function isDailyConstruction(employmentType: string): boolean {
  return employmentType === 'DAILY_CONSTRUCTION'
}

/** 비일용 근로자인지 (상용직·기간제·계속근로형·사업소득) */
export function isNonDailyWorker(employmentType: string): boolean {
  return (NON_DAILY_EMPLOYMENT_TYPES as readonly string[]).includes(employmentType)
}

/** 근태 관리 대상(공수 체계 미적용)인지 */
export function isAttendanceManaged(employmentType: string): employmentType is AttendanceManagedType {
  return (ATTENDANCE_MANAGED_TYPES as readonly string[]).includes(employmentType)
}

/** 기간제 근로자인지 */
export function isFixedTerm(employmentType: string): boolean {
  return employmentType === 'FIXED_TERM'
}

/** 계속근로형 현장근로자인지 */
export function isContinuousSite(employmentType: string): boolean {
  return employmentType === 'CONTINUOUS_SITE'
}

/** 외주/협력팀 소속인지 */
export function isOutsourced(organizationType: string): organizationType is OutsourcedOrgType {
  return (OUTSOURCED_ORG_TYPES as readonly string[]).includes(organizationType)
}

/** 직영 소속인지 */
export function isDirect(organizationType: string): boolean {
  return (DIRECT_ORG_TYPES as readonly string[]).includes(organizationType)
}

// ─── 급여정산 대상 규칙 ────────────────────────────────────────────────────────

/**
 * 급여정산(월마감) 대상 근로자인지 판단
 *
 * 외주/협력팀(SUBCONTRACTOR)은 자사 정산 대상에서 원칙적으로 제외.
 * 단, organizationType이 SUBCONTRACTOR이더라도
 * 사용처에서 명시적으로 포함 결정을 내릴 경우 별도 처리.
 */
export function isPayrollTarget(
  employmentType: string,
  organizationType: string,
): boolean {
  // 외주 인원: 자사 급여정산 대상 아님
  if (isOutsourced(organizationType)) return false
  // 3.3% 사업소득: 원천징수 대상이지만 급여대장 방식 아님
  if (employmentType === 'BUSINESS_33') return false
  return true
}

// ─── 계약 템플릿 허용 규칙 ───────────────────────────────────────────────────

/**
 * 계약 템플릿 → 적합한 EmploymentType 매핑
 *
 * 이 매핑은 "어떤 템플릿이 어떤 근로자 유형에 적합한지" 를 정의한다.
 * 불일치 시 경고 또는 차단에 사용한다.
 */
export const TEMPLATE_ALLOWED_EMPLOYMENT_TYPES: Record<string, readonly string[]> = {
  // 일용직 전용 템플릿
  DAILY_EMPLOYMENT:        ['DAILY_CONSTRUCTION'],
  // 상용직/기간제/계속근로형 근로계약 템플릿
  REGULAR_EMPLOYMENT:      ['REGULAR', 'CONTINUOUS_SITE'],
  FIXED_TERM_EMPLOYMENT:   ['FIXED_TERM', 'CONTINUOUS_SITE'],
  CONTINUOUS_EMPLOYMENT:   ['CONTINUOUS_SITE', 'REGULAR'],
  MONTHLY_FIXED_EMPLOYMENT:['REGULAR', 'FIXED_TERM'],
  OFFICE_SERVICE:          ['REGULAR', 'FIXED_TERM', 'BUSINESS_33'],
  // 외주/사업소득 전용 템플릿
  SUBCONTRACT_WITH_BIZ:    ['BUSINESS_33'],       // 소속 무관, 사업자 있는 외주
  FREELANCER_SERVICE:      ['BUSINESS_33'],
  NONBUSINESS_TEAM_REVIEW: ['BUSINESS_33', 'DAILY_CONSTRUCTION'], // 팀장형, 검토 대상
} as const

/**
 * 계약 템플릿과 근로자 유형이 맞지 않는지 확인
 *
 * @returns true이면 불일치 경고 필요
 */
export function isTemplateMismatch(
  templateType: string,
  employmentType: string,
): boolean {
  const allowed = TEMPLATE_ALLOWED_EMPLOYMENT_TYPES[templateType]
  if (!allowed) return false // 알 수 없는 템플릿 — 검증 생략
  return !allowed.includes(employmentType)
}

/**
 * 일용직 전용 문서가 비일용 근로자에게 적용되려는 경우 감지
 *
 * 일용직 계약서/근로조건 확인서 등 일용직 전용 문서 유형이
 * 비일용 근로자에게 생성되는 것을 방지.
 */
export const DAILY_WORKER_EXCLUSIVE_TEMPLATES = [
  'DAILY_EMPLOYMENT',
] as const

export function isDailyExclusiveTemplate(templateType: string): boolean {
  return (DAILY_WORKER_EXCLUSIVE_TEMPLATES as readonly string[]).includes(templateType)
}

/**
 * 비일용 근로자에게 일용직 전용 문서를 발급하려는 혼입 상황인지
 */
export function isDailyDocumentMixup(
  templateType: string,
  employmentType: string,
): boolean {
  return isDailyExclusiveTemplate(templateType) && isNonDailyWorker(employmentType)
}

// ─── 표시명 ─────────────────────────────────────────────────────────────────

export const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  DAILY_CONSTRUCTION: '건설일용',
  REGULAR:            '상용직',
  FIXED_TERM:         '기간제',
  CONTINUOUS_SITE:    '계속근로형',
  BUSINESS_33:        '3.3%사업소득',
  OTHER:              '기타',
}

export const ORGANIZATION_TYPE_LABELS: Record<string, string> = {
  DIRECT:       '직영',
  SUBCONTRACTOR:'협력사',
}

export function getEmploymentTypeLabel(type: string): string {
  return EMPLOYMENT_TYPE_LABELS[type] ?? type
}

export function getOrganizationTypeLabel(type: string): string {
  return ORGANIZATION_TYPE_LABELS[type] ?? type
}
