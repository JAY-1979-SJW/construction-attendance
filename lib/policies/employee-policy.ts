/**
 * 비일용 근로자(상용직·기간제·계속근로형) 운영 정책
 *
 * 이 파일은 일용직이 아닌 근로자 유형에 대한 운영 기준을 정의한다.
 * 일용직 정책(attendance-policy.ts)과 혼용하지 말 것.
 *
 * 원칙:
 *   1. 상용직/기간제는 공수(工數) 체계가 아니라 근태(勤怠) 관리 체계
 *   2. 기간제는 2년 제한(기간제법) → 계약기간 필수 표시
 *   3. 계속근로형은 일용직과 상용직 중간 → 공수 체계 선택적 적용
 *   4. 외주 인원은 별도 소속·책임 주체 명시 필요
 */

// ─── 상용직/기간제 근태 관리 원칙 ────────────────────────────────────────────

/** 상용직/기간제는 일용직 공수 체계 미적용 */
export const EMPLOYEE_WORK_UNIT_APPLICABLE = false

/** 상용직/기간제는 출퇴근 근태 관리 대상 */
export const EMPLOYEE_ATTENDANCE_TRACKING = true

/** 재직 개념 존재 (입사일~퇴사일) */
export const EMPLOYEE_HAS_TENURE = true

/** 소정근로시간 설정 필요 */
export const EMPLOYEE_REQUIRES_STANDARD_WORK_HOURS = true

// ─── 기간제 전용 규칙 ────────────────────────────────────────────────────────

/** 기간제법 최대 계약 기간 (개월): 2년 */
export const FIXED_TERM_MAX_MONTHS = 24

/** 기간제 계약서에 계약기간 표시 필수 */
export const FIXED_TERM_REQUIRES_END_DATE = true

/** 기간제→정규직 전환 여부 명시 권고 */
export const FIXED_TERM_CONVERSION_CLAUSE_RECOMMENDED = true

// ─── 계속근로형 현장근로자 정책 ────────────────────────────────────────────

/** 계속근로형은 현장 단위 공수 체계 적용 가능 */
export const CONTINUOUS_SITE_WORK_UNIT_OPTIONAL = true

/** 계속근로형 계약기간 갱신 허용 */
export const CONTINUOUS_SITE_CONTRACT_RENEWABLE = true

/** 계속근로형은 현장별 근무시간 정책(SiteAttendancePolicy) 적용 권고 */
export const CONTINUOUS_SITE_USE_SITE_POLICY = true

// ─── 외주/협력팀 원칙 ────────────────────────────────────────────────────────

/**
 * 외주/협력팀 인원에 대한 자사 급여대장 포함 금지 원칙
 * true = 자사 급여대장에 포함하지 않음
 */
export const OUTSOURCED_EXCLUDE_FROM_PAYROLL = true

/** 외주 인원의 계좌/급여 정보는 원칙적으로 미수집 */
export const OUTSOURCED_SKIP_BANK_INFO = true

/** 외주 인원의 개인정보 수집 범위 최소화 */
export const OUTSOURCED_MINIMAL_PERSONAL_INFO = true

/** 외주 인원에게 자사 근로계약서 발급 금지 */
export const OUTSOURCED_NO_EMPLOYMENT_CONTRACT = true

// ─── 비일용 근로자 계약 필수 필드 ──────────────────────────────────────────

/** 상용직 계약 필수 필드 */
export const REGULAR_CONTRACT_REQUIRED_FIELDS = [
  'monthlySalary',
  'standardWorkHours',
  'startDate',
] as const

/** 기간제 계약 필수 필드 (endDate 추가) */
export const FIXED_TERM_CONTRACT_REQUIRED_FIELDS = [
  'monthlySalary',
  'standardWorkHours',
  'startDate',
  'endDate',
] as const

// ─── 위험 문구 목록 (비일용 계약서) ──────────────────────────────────────────

/**
 * 상용직/기간제 계약서에 들어가면 안 되는 일용직 전용 문구 패턴
 * (일용직 문구 혼입 방지)
 */
export const EMPLOYEE_CONTRACT_DAILY_INTRUSION_PATTERNS: RegExp[] = [
  /일용직/,
  /일용근로/,
  /1일 단위.*계약/,
  /당일.*근로계약/,
  /일당.*기준으로\s*지급/,
]

/**
 * 일용직 계약서에 들어가면 안 되는 비일용 전용 문구 패턴
 * (상용직 문구 혼입 방지)
 */
export const DAILY_CONTRACT_EMPLOYEE_INTRUSION_PATTERNS: RegExp[] = [
  /연차유급휴가/,
  /소정근로시간.*주\s*\d+시간/,
  /정규직\s*전환/,
  /기간의\s*정함이\s*없는/,
  /퇴직금/,
]
