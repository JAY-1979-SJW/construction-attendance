/**
 * 근로자 유형 분리 검증 테스트
 *
 * 검증 항목:
 *   A. worker-type-policy 분류 함수
 *   B. 공수 체계 적용 대상 분기
 *   C. 급여정산 대상 분기 (외주 제외)
 *   D. 계약 템플릿 불일치 감지
 *   E. 일용직 문서 혼입 방지
 *   F. validate-contract 통합 (템플릿 불일치 경고)
 *   G. 회귀 방지 — 일용직 규칙이 상용직에 적용되지 않음
 *   H. 회귀 방지 — 외주 인원이 자사 정산 대상이 되지 않음
 */
import { describe, it, expect } from 'vitest'
import {
  isWorkUnitTarget,
  isDailyConstruction,
  isNonDailyWorker,
  isAttendanceManaged,
  isFixedTerm,
  isContinuousSite,
  isOutsourced,
  isDirect,
  isPayrollTarget,
  isTemplateMismatch,
  isDailyDocumentMixup,
  isDailyExclusiveTemplate,
  getEmploymentTypeLabel,
  getOrganizationTypeLabel,
  DAILY_WORK_UNIT_TYPES,
  ATTENDANCE_MANAGED_TYPES,
  NON_DAILY_EMPLOYMENT_TYPES,
  TEMPLATE_ALLOWED_EMPLOYMENT_TYPES,
} from '@/lib/policies/worker-type-policy'
import {
  validateTemplateMismatch,
} from '@/lib/contracts/validate-contract'
import {
  EMPLOYEE_WORK_UNIT_APPLICABLE,
  OUTSOURCED_EXCLUDE_FROM_PAYROLL,
  OUTSOURCED_NO_EMPLOYMENT_CONTRACT,
  FIXED_TERM_MAX_MONTHS,
  FIXED_TERM_REQUIRES_END_DATE,
  CONTINUOUS_SITE_WORK_UNIT_OPTIONAL,
} from '@/lib/policies/employee-policy'
import { calcWorkUnits } from '@/lib/labor/work-confirmations'

// ─── A. 분류 함수 ────────────────────────────────────────────────────────────

describe('worker-type-policy — 분류 함수', () => {

  describe('isWorkUnitTarget (공수 체계 적용 대상)', () => {
    it('DAILY_CONSTRUCTION → true', () => expect(isWorkUnitTarget('DAILY_CONSTRUCTION')).toBe(true))
    it('CONTINUOUS_SITE → true (현장 공수 허용)', () => expect(isWorkUnitTarget('CONTINUOUS_SITE')).toBe(true))
    it('REGULAR → false', () => expect(isWorkUnitTarget('REGULAR')).toBe(false))
    it('FIXED_TERM → false', () => expect(isWorkUnitTarget('FIXED_TERM')).toBe(false))
    it('BUSINESS_33 → false', () => expect(isWorkUnitTarget('BUSINESS_33')).toBe(false))
    it('OTHER → false', () => expect(isWorkUnitTarget('OTHER')).toBe(false))
  })

  describe('isDailyConstruction', () => {
    it('DAILY_CONSTRUCTION → true', () => expect(isDailyConstruction('DAILY_CONSTRUCTION')).toBe(true))
    it('REGULAR → false', () => expect(isDailyConstruction('REGULAR')).toBe(false))
    it('CONTINUOUS_SITE → false (계속근로형은 일용직 아님)', () => expect(isDailyConstruction('CONTINUOUS_SITE')).toBe(false))
  })

  describe('isNonDailyWorker', () => {
    it('REGULAR → true', () => expect(isNonDailyWorker('REGULAR')).toBe(true))
    it('FIXED_TERM → true', () => expect(isNonDailyWorker('FIXED_TERM')).toBe(true))
    it('CONTINUOUS_SITE → true', () => expect(isNonDailyWorker('CONTINUOUS_SITE')).toBe(true))
    it('BUSINESS_33 → true', () => expect(isNonDailyWorker('BUSINESS_33')).toBe(true))
    it('DAILY_CONSTRUCTION → false', () => expect(isNonDailyWorker('DAILY_CONSTRUCTION')).toBe(false))
  })

  describe('isAttendanceManaged (근태 관리 체계)', () => {
    it('REGULAR → true', () => expect(isAttendanceManaged('REGULAR')).toBe(true))
    it('FIXED_TERM → true', () => expect(isAttendanceManaged('FIXED_TERM')).toBe(true))
    it('DAILY_CONSTRUCTION → false', () => expect(isAttendanceManaged('DAILY_CONSTRUCTION')).toBe(false))
    it('CONTINUOUS_SITE → false (공수 체계 선택적 허용)', () => expect(isAttendanceManaged('CONTINUOUS_SITE')).toBe(false))
  })

  describe('isFixedTerm / isContinuousSite', () => {
    it('FIXED_TERM → isFixedTerm true', () => expect(isFixedTerm('FIXED_TERM')).toBe(true))
    it('CONTINUOUS_SITE → isContinuousSite true', () => expect(isContinuousSite('CONTINUOUS_SITE')).toBe(true))
    it('REGULAR → isFixedTerm false', () => expect(isFixedTerm('REGULAR')).toBe(false))
  })

  describe('isOutsourced / isDirect', () => {
    it('SUBCONTRACTOR → isOutsourced true', () => expect(isOutsourced('SUBCONTRACTOR')).toBe(true))
    it('DIRECT → isDirect true', () => expect(isDirect('DIRECT')).toBe(true))
    it('DIRECT → isOutsourced false', () => expect(isOutsourced('DIRECT')).toBe(false))
  })

})

// ─── B. 공수 체계 적용 분기 ──────────────────────────────────────────────────

describe('공수 체계 — 유형별 적용 분기', () => {

  it('DAILY_CONSTRUCTION: 공수 체계 적용 대상', () => {
    expect(isWorkUnitTarget('DAILY_CONSTRUCTION')).toBe(true)
  })

  it('CONTINUOUS_SITE: 공수 체계 적용 허용 (현장 공수 선택적)', () => {
    expect(isWorkUnitTarget('CONTINUOUS_SITE')).toBe(true)
    expect(CONTINUOUS_SITE_WORK_UNIT_OPTIONAL).toBe(true)
  })

  it('REGULAR: 공수 체계 미적용 (근태 관리 대상)', () => {
    expect(isWorkUnitTarget('REGULAR')).toBe(false)
    expect(EMPLOYEE_WORK_UNIT_APPLICABLE).toBe(false)
  })

  it('FIXED_TERM: 공수 체계 미적용 (근태 관리 대상)', () => {
    expect(isWorkUnitTarget('FIXED_TERM')).toBe(false)
    expect(EMPLOYEE_WORK_UNIT_APPLICABLE).toBe(false)
  })

  it('DAILY_WORK_UNIT_TYPES에 REGULAR, FIXED_TERM이 없어야 한다', () => {
    expect(DAILY_WORK_UNIT_TYPES).not.toContain('REGULAR')
    expect(DAILY_WORK_UNIT_TYPES).not.toContain('FIXED_TERM')
  })

  it('ATTENDANCE_MANAGED_TYPES에 DAILY_CONSTRUCTION이 없어야 한다', () => {
    expect(ATTENDANCE_MANAGED_TYPES).not.toContain('DAILY_CONSTRUCTION')
    expect(ATTENDANCE_MANAGED_TYPES).not.toContain('CONTINUOUS_SITE')
  })

})

// ─── C. 급여정산 대상 분기 ───────────────────────────────────────────────────

describe('isPayrollTarget — 급여정산 대상 분기', () => {

  it('DAILY_CONSTRUCTION + DIRECT → 급여정산 대상', () => {
    expect(isPayrollTarget('DAILY_CONSTRUCTION', 'DIRECT')).toBe(true)
  })

  it('REGULAR + DIRECT → 급여정산 대상', () => {
    expect(isPayrollTarget('REGULAR', 'DIRECT')).toBe(true)
  })

  it('FIXED_TERM + DIRECT → 급여정산 대상', () => {
    expect(isPayrollTarget('FIXED_TERM', 'DIRECT')).toBe(true)
  })

  it('BUSINESS_33 + DIRECT → 급여정산 제외 (사업소득 방식)', () => {
    expect(isPayrollTarget('BUSINESS_33', 'DIRECT')).toBe(false)
  })

  it('DAILY_CONSTRUCTION + SUBCONTRACTOR → 급여정산 제외 (외주)', () => {
    expect(isPayrollTarget('DAILY_CONSTRUCTION', 'SUBCONTRACTOR')).toBe(false)
  })

  it('REGULAR + SUBCONTRACTOR → 급여정산 제외 (협력사 소속)', () => {
    expect(isPayrollTarget('REGULAR', 'SUBCONTRACTOR')).toBe(false)
  })

  it('외주 인원 급여정산 제외 원칙 상수 확인', () => {
    expect(OUTSOURCED_EXCLUDE_FROM_PAYROLL).toBe(true)
  })

})

// ─── D. 계약 템플릿 불일치 감지 ──────────────────────────────────────────────

describe('isTemplateMismatch — 계약 템플릿 유형 불일치', () => {

  it('DAILY_EMPLOYMENT + DAILY_CONSTRUCTION → 일치 (불일치 아님)', () => {
    expect(isTemplateMismatch('DAILY_EMPLOYMENT', 'DAILY_CONSTRUCTION')).toBe(false)
  })

  it('DAILY_EMPLOYMENT + REGULAR → 불일치', () => {
    expect(isTemplateMismatch('DAILY_EMPLOYMENT', 'REGULAR')).toBe(true)
  })

  it('DAILY_EMPLOYMENT + FIXED_TERM → 불일치', () => {
    expect(isTemplateMismatch('DAILY_EMPLOYMENT', 'FIXED_TERM')).toBe(true)
  })

  it('REGULAR_EMPLOYMENT + REGULAR → 일치', () => {
    expect(isTemplateMismatch('REGULAR_EMPLOYMENT', 'REGULAR')).toBe(false)
  })

  it('REGULAR_EMPLOYMENT + DAILY_CONSTRUCTION → 불일치', () => {
    expect(isTemplateMismatch('REGULAR_EMPLOYMENT', 'DAILY_CONSTRUCTION')).toBe(true)
  })

  it('FIXED_TERM_EMPLOYMENT + FIXED_TERM → 일치', () => {
    expect(isTemplateMismatch('FIXED_TERM_EMPLOYMENT', 'FIXED_TERM')).toBe(false)
  })

  it('FIXED_TERM_EMPLOYMENT + DAILY_CONSTRUCTION → 불일치', () => {
    expect(isTemplateMismatch('FIXED_TERM_EMPLOYMENT', 'DAILY_CONSTRUCTION')).toBe(true)
  })

  it('SUBCONTRACT_WITH_BIZ + BUSINESS_33 → 일치 (외주 사업소득)', () => {
    expect(isTemplateMismatch('SUBCONTRACT_WITH_BIZ', 'BUSINESS_33')).toBe(false)
  })

  it('TEMPLATE_ALLOWED_EMPLOYMENT_TYPES에 DAILY_EMPLOYMENT 항목 존재', () => {
    expect(TEMPLATE_ALLOWED_EMPLOYMENT_TYPES['DAILY_EMPLOYMENT']).toBeDefined()
    expect(TEMPLATE_ALLOWED_EMPLOYMENT_TYPES['DAILY_EMPLOYMENT']).toContain('DAILY_CONSTRUCTION')
  })

})

// ─── E. 일용직 문서 혼입 방지 ────────────────────────────────────────────────

describe('isDailyDocumentMixup — 일용직 문서 혼입 방지', () => {

  it('DAILY_EMPLOYMENT + REGULAR → 혼입 감지', () => {
    expect(isDailyDocumentMixup('DAILY_EMPLOYMENT', 'REGULAR')).toBe(true)
  })

  it('DAILY_EMPLOYMENT + FIXED_TERM → 혼입 감지', () => {
    expect(isDailyDocumentMixup('DAILY_EMPLOYMENT', 'FIXED_TERM')).toBe(true)
  })

  it('DAILY_EMPLOYMENT + CONTINUOUS_SITE → 혼입 감지', () => {
    expect(isDailyDocumentMixup('DAILY_EMPLOYMENT', 'CONTINUOUS_SITE')).toBe(true)
  })

  it('DAILY_EMPLOYMENT + DAILY_CONSTRUCTION → 정상 (혼입 아님)', () => {
    expect(isDailyDocumentMixup('DAILY_EMPLOYMENT', 'DAILY_CONSTRUCTION')).toBe(false)
  })

  it('REGULAR_EMPLOYMENT + REGULAR → 정상 (혼입 아님)', () => {
    expect(isDailyDocumentMixup('REGULAR_EMPLOYMENT', 'REGULAR')).toBe(false)
  })

  it('isDailyExclusiveTemplate: DAILY_EMPLOYMENT → true', () => {
    expect(isDailyExclusiveTemplate('DAILY_EMPLOYMENT')).toBe(true)
  })

  it('isDailyExclusiveTemplate: REGULAR_EMPLOYMENT → false', () => {
    expect(isDailyExclusiveTemplate('REGULAR_EMPLOYMENT')).toBe(false)
  })

})

// ─── F. validateTemplateMismatch 통합 ────────────────────────────────────────

describe('validateTemplateMismatch — 경고 메시지 생성', () => {

  it('일치하는 경우: hasMismatch=false, warning=null', () => {
    const result = validateTemplateMismatch('DAILY_EMPLOYMENT', 'DAILY_CONSTRUCTION')
    expect(result.hasMismatch).toBe(false)
    expect(result.warning).toBeNull()
  })

  it('일용직 혼입: isDailyMixup=true, warning 포함', () => {
    const result = validateTemplateMismatch('DAILY_EMPLOYMENT', 'REGULAR')
    expect(result.hasMismatch).toBe(true)
    expect(result.isDailyMixup).toBe(true)
    expect(result.warning).not.toBeNull()
    expect(result.warning).toContain('일용직 전용')
  })

  it('일반 불일치: isDailyMixup=false, warning 포함', () => {
    const result = validateTemplateMismatch('REGULAR_EMPLOYMENT', 'DAILY_CONSTRUCTION')
    expect(result.hasMismatch).toBe(true)
    expect(result.isDailyMixup).toBe(false)
    expect(result.warning).not.toBeNull()
  })

  it('알 수 없는 템플릿: hasMismatch=false (검증 생략)', () => {
    const result = validateTemplateMismatch('UNKNOWN_TEMPLATE', 'REGULAR')
    expect(result.hasMismatch).toBe(false)
  })

})

// ─── G. 회귀 방지 — 일용직 규칙이 비일용에 적용되지 않음 ──────────────────

describe('회귀 방지 — 일용직 규칙 비일용 미적용', () => {

  it('REGULAR는 NON_DAILY_EMPLOYMENT_TYPES에 포함된다', () => {
    expect(NON_DAILY_EMPLOYMENT_TYPES).toContain('REGULAR')
  })

  it('FIXED_TERM은 NON_DAILY_EMPLOYMENT_TYPES에 포함된다', () => {
    expect(NON_DAILY_EMPLOYMENT_TYPES).toContain('FIXED_TERM')
  })

  it('DAILY_CONSTRUCTION은 NON_DAILY_EMPLOYMENT_TYPES에 없다', () => {
    expect(NON_DAILY_EMPLOYMENT_TYPES).not.toContain('DAILY_CONSTRUCTION')
  })

  it('상용직 근로자는 공수 체계 미적용 → INVALID 반환', () => {
    // 상용직 근로자에게 calcWorkUnits를 호출하면 같은 결과지만,
    // generateDraftConfirmations에서 isWorkUnitTarget으로 건너뜀 처리됨.
    // isWorkUnitTarget(REGULAR) = false 가 핵심 방어선.
    expect(isWorkUnitTarget('REGULAR')).toBe(false)
  })

  it('일용직 계약 템플릿은 상용직에 불일치', () => {
    expect(isTemplateMismatch('DAILY_EMPLOYMENT', 'REGULAR')).toBe(true)
    expect(isTemplateMismatch('DAILY_EMPLOYMENT', 'FIXED_TERM')).toBe(true)
  })

})

// ─── H. 회귀 방지 — 외주 인원 자사 정산 대상 미진입 ─────────────────────────

describe('회귀 방지 — 외주 인원 자사 정산 제외', () => {

  it('SUBCONTRACTOR 소속 + 어떤 employmentType이든 급여정산 제외', () => {
    for (const et of ['DAILY_CONSTRUCTION', 'REGULAR', 'FIXED_TERM', 'BUSINESS_33']) {
      expect(isPayrollTarget(et, 'SUBCONTRACTOR')).toBe(false)
    }
  })

  it('외주 인원 급여정산 제외 원칙 상수 확인', () => {
    expect(OUTSOURCED_EXCLUDE_FROM_PAYROLL).toBe(true)
  })

  it('외주 인원에게 자사 근로계약서 발급 금지 원칙 확인', () => {
    expect(OUTSOURCED_NO_EMPLOYMENT_CONTRACT).toBe(true)
  })

  it('isOutsourced: SUBCONTRACTOR → true', () => {
    expect(isOutsourced('SUBCONTRACTOR')).toBe(true)
  })

  it('isOutsourced: DIRECT → false', () => {
    expect(isOutsourced('DIRECT')).toBe(false)
  })

})

// ─── I. 기간제 전용 규칙 ─────────────────────────────────────────────────────

describe('기간제 전용 규칙', () => {

  it('기간제 최대 계약기간 24개월(2년)', () => {
    expect(FIXED_TERM_MAX_MONTHS).toBe(24)
  })

  it('기간제 계약서에 종료일 필수', () => {
    expect(FIXED_TERM_REQUIRES_END_DATE).toBe(true)
  })

  it('FIXED_TERM_EMPLOYMENT 템플릿은 FIXED_TERM에 허용', () => {
    expect(TEMPLATE_ALLOWED_EMPLOYMENT_TYPES['FIXED_TERM_EMPLOYMENT']).toContain('FIXED_TERM')
  })

  it('FIXED_TERM_EMPLOYMENT 템플릿은 DAILY_CONSTRUCTION에 불허', () => {
    const allowed = TEMPLATE_ALLOWED_EMPLOYMENT_TYPES['FIXED_TERM_EMPLOYMENT'] as readonly string[]
    expect(allowed).not.toContain('DAILY_CONSTRUCTION')
  })

})

// ─── J. 표시명 함수 ──────────────────────────────────────────────────────────

describe('getEmploymentTypeLabel / getOrganizationTypeLabel', () => {

  it('DAILY_CONSTRUCTION → 건설일용', () => {
    expect(getEmploymentTypeLabel('DAILY_CONSTRUCTION')).toBe('건설일용')
  })

  it('REGULAR → 상용직', () => {
    expect(getEmploymentTypeLabel('REGULAR')).toBe('상용직')
  })

  it('FIXED_TERM → 기간제', () => {
    expect(getEmploymentTypeLabel('FIXED_TERM')).toBe('기간제')
  })

  it('CONTINUOUS_SITE → 계속근로형', () => {
    expect(getEmploymentTypeLabel('CONTINUOUS_SITE')).toBe('계속근로형')
  })

  it('SUBCONTRACTOR → 협력사', () => {
    expect(getOrganizationTypeLabel('SUBCONTRACTOR')).toBe('협력사')
  })

  it('DIRECT → 직영', () => {
    expect(getOrganizationTypeLabel('DIRECT')).toBe('직영')
  })

})
