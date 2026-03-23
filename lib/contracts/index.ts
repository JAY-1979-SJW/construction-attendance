export * from './templates'
export * from './safety-docs'
export * from './subcontract-docs'
export * from './team-docs'

// 문서 패키지 정의
export const DOC_PACKAGES = {
  /** A. 원청 직접고용 패키지 */
  DIRECT_EMPLOYEE: [
    { type: 'CONTRACT',                    label: '근로계약서',                required: true },
    { type: 'WORK_CONDITIONS_RECEIPT',     label: '근로조건 설명 확인서',      required: true },
    { type: 'PRIVACY_CONSENT',             label: '개인정보 수집·이용 동의서', required: true },
    { type: 'BASIC_SAFETY_EDU_CONFIRM',    label: '건설업 기초안전보건교육 확인서', required: true },
    { type: 'SITE_SAFETY_RULES_CONFIRM',   label: '현장 안전수칙 준수 확인서', required: true },
    { type: 'SITE_ASSIGNMENT',             label: '현장배치 확인서',           required: false },
    { type: 'WORK_CONDITION_CHANGE',       label: '근로조건 변경확인서',       required: false },
    { type: 'SAFETY_EDUCATION_NEW_HIRE',   label: '신규채용 안전보건교육 확인서', required: false },
    { type: 'SAFETY_EDUCATION_TASK_CHANGE',label: '작업변경 교육 확인서',      required: false },
    { type: 'PPE_PROVISION',               label: '보호구 지급 확인서',        required: false },
    { type: 'SAFETY_PLEDGE',               label: '안전수칙 준수 서약서',      required: false },
  ],
  /** B. 원청 하도급/외주 패키지 */
  SUBCONTRACT_BIZ: [
    { type: 'SUBCONTRACT_CONTRACT',        label: '하도급·도급·용역계약서',    required: true },
    { type: 'SUBCONTRACT_SCOPE',           label: '[별첨1] 공정범위 별첨',     required: true },
    { type: 'SUBCONTRACT_PAYMENT_TERMS',   label: '[별첨2] 기성·정산 기준',    required: true },
    { type: 'SUBCONTRACT_SAFETY_PROTOCOL', label: '[별첨3] 안전보건 책임 별첨', required: true },
    { type: 'SUBCONTRACT_DOCUMENT_LIST',   label: '[별첨4] 제출서류 목록',     required: true },
    { type: 'SUBCONTRACT_DISTRIBUTION_REF',label: '[참고] 배분 참고자료 양식', required: false },
  ],
  /** C. 사업자 없는 팀장형 예외 세트 */
  TEAM_NONBIZ_REVIEW: [
    { type: 'TEAM_LEADER_RESPONSIBILITY',  label: '팀장 책임확인서',           required: true },
    { type: 'TEAM_SCOPE_CONFIRMATION',     label: '공정수행 범위 확인서',      required: true },
    { type: 'TEAM_SAFETY_COMPLIANCE',      label: '안전보건 준수확인서',       required: true },
    { type: 'TEAM_DISTRIBUTION_SUBMISSION',label: '배분 참고자료 제출서',      required: false },
    { type: 'TEAM_RECLASSIFICATION_WARNING',label: '직접고용 재분류 경고서',   required: false },
  ],
  /** D. 상용직/기간제 직접고용 패키지 */
  REGULAR_EMPLOYEE: [
    { type: 'CONTRACT',                         label: '근로계약서',                      required: true },
    { type: 'WORK_CONDITIONS_RECEIPT_REGULAR',  label: '근로조건 설명 확인서 (상용직)',   required: true },
    { type: 'PRIVACY_CONSENT',                  label: '개인정보 수집·이용 동의서',       required: true },
    { type: 'BASIC_SAFETY_EDU_CONFIRM',         label: '건설업 기초안전보건교육 확인서',  required: true },
    { type: 'SITE_SAFETY_RULES_CONFIRM',        label: '현장 안전수칙 준수 확인서',       required: true },
    { type: 'SITE_ASSIGNMENT',                  label: '현장배치 확인서',                 required: false },
    { type: 'SAFETY_EDUCATION_NEW_HIRE',        label: '신규채용 안전보건교육 확인서',    required: false },
    { type: 'PPE_PROVISION',                    label: '보호구 지급 확인서',              required: false },
    { type: 'SAFETY_PLEDGE',                    label: '안전수칙 준수 서약서',            required: false },
  ],
  /** 안전관리 공통 (원청 내부 보관) */
  SAFETY_MANAGEMENT: [
    { type: 'SAFETY_COUNCIL_MINUTES',        label: '안전보건협의체 회의록',     required: false },
    { type: 'SITE_INSPECTION_RECORD',        label: '순회점검 기록',            required: false },
    { type: 'SUBCONTRACTOR_EDUCATION_RECORD',label: '수급인 교육실시 확인 기록', required: false },
  ],
} as const

export type DocPackageKey = keyof typeof DOC_PACKAGES
export type DocType = (typeof DOC_PACKAGES)[DocPackageKey][number]['type']

/** laborRelationType → 문서 패키지 매핑 */
export function getDocPackageKey(laborRelationType: string | null | undefined): DocPackageKey {
  switch (laborRelationType) {
    case 'SUBCONTRACT_BIZ':    return 'SUBCONTRACT_BIZ'
    case 'TEAM_NONBIZ_REVIEW': return 'TEAM_NONBIZ_REVIEW'
    default:                   return 'DIRECT_EMPLOYEE'
  }
}

/** contractTemplateType → 문서 패키지 매핑 (상용직/일용직 분리용) */
export function getDocPackageForTemplate(templateType: string | null | undefined): DocPackageKey {
  switch (templateType) {
    case 'REGULAR_EMPLOYMENT':
    case 'FIXED_TERM_EMPLOYMENT':
    case 'CONTINUOUS_EMPLOYMENT':
      return 'REGULAR_EMPLOYEE'
    case 'SUBCONTRACT_WITH_BIZ':
    case 'FREELANCER_SERVICE':
      return 'SUBCONTRACT_BIZ'
    case 'NONBUSINESS_TEAM_REVIEW':
      return 'TEAM_NONBIZ_REVIEW'
    default:
      return 'DIRECT_EMPLOYEE'  // DAILY_EMPLOYMENT, MONTHLY_FIXED_EMPLOYMENT 포함
  }
}
