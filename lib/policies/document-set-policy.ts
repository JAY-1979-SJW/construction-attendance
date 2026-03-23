/**
 * document-set-policy.ts
 *
 * 유형별 문서 세트 정의.
 * 관리자가 계약 유형을 선택하면 이 정책을 통해
 * - 생성 예정 문서 목록 (UI 미리보기)
 * - 허용 계약 템플릿 목록
 * - 차단 계약 템플릿 목록
 * - 외주 직접고용 차단 여부
 * 를 결정한다.
 *
 * 근거 지시문: 유형별 계약서/문서 세트 정리 지시문 (2026-03-23)
 */

// ─── 타입 정의 ───────────────────────────────────────────────

export interface DocumentItem {
  /** UI 표시 이름 */
  label: string
  /** 필수 여부 */
  required: boolean
  /** 메모 (선택 사항 설명) */
  note?: string
}

export interface DocumentSet {
  /** 유형 코드 */
  typeCode: 'DAILY' | 'REGULAR' | 'FIXED_TERM' | 'SUBCONTRACTOR'
  /** UI 표시 유형명 */
  typeLabel: string
  /** 생성 예정 문서 목록 (계약 생성 전 미리보기) */
  documents: DocumentItem[]
  /** 이 유형에서 허용되는 ContractTemplateType 값 목록 */
  allowedTemplates: string[]
  /**
   * 이 유형에서 사용 시 강하게 차단해야 하는 템플릿 목록
   * (경고가 아니라 저장 차단)
   */
  blockedTemplates: string[]
  /** 자사 직접 근로계약서 생성 금지 여부 (외주/협력팀: true) */
  blockDirectEmploymentContract: boolean
  /** 종료일 필수 여부 (기간제: true) */
  endDateRequired: boolean
}

// ─── 문서 세트 정의 ──────────────────────────────────────────

export const DOCUMENT_SETS: DocumentSet[] = [
  // ── A. 일용직 ──────────────────────────────────────────────
  {
    typeCode:  'DAILY',
    typeLabel: '일용직',
    documents: [
      { label: '일용직 근로계약서',       required: true  },
      { label: '개인정보 수집·이용 동의서', required: true  },
      { label: '근로조건 설명 확인서',     required: true  },
      { label: '현장 배치 확인 문서',      required: false, note: '현장 배치 시 추가 가능' },
      { label: '안전 관련 확인 문서',      required: false, note: '안전 모듈 연동 시 자동 추가' },
    ],
    allowedTemplates: [
      'DAILY_EMPLOYMENT',
      'MONTHLY_FIXED_EMPLOYMENT',
      'CONTINUOUS_EMPLOYMENT',
    ],
    blockedTemplates: [
      'REGULAR_EMPLOYMENT',
      'FIXED_TERM_EMPLOYMENT',
      'SUBCONTRACT_WITH_BIZ',
      'FREELANCER_SERVICE',
      'NONBUSINESS_TEAM_REVIEW',
    ],
    blockDirectEmploymentContract: false,
    endDateRequired: false,
  },

  // ── B. 상용직 ──────────────────────────────────────────────
  {
    typeCode:  'REGULAR',
    typeLabel: '상용직',
    documents: [
      { label: '상용직 근로계약서',                      required: true  },
      { label: '개인정보 수집·이용 동의서',               required: true  },
      { label: '근로조건 설명 확인서',                    required: true  },
      { label: '취업규칙·사내 운영 안내 확인서',          required: false, note: '취업규칙 있는 경우 추가' },
      { label: '임금·근무조건 확인서',                    required: false, note: '필요 시 추가 가능' },
    ],
    allowedTemplates: [
      'REGULAR_EMPLOYMENT',
    ],
    blockedTemplates: [
      'DAILY_EMPLOYMENT',
      'MONTHLY_FIXED_EMPLOYMENT',
      'CONTINUOUS_EMPLOYMENT',
      'FIXED_TERM_EMPLOYMENT',
      'SUBCONTRACT_WITH_BIZ',
      'FREELANCER_SERVICE',
      'NONBUSINESS_TEAM_REVIEW',
    ],
    blockDirectEmploymentContract: false,
    endDateRequired: false,
  },

  // ── C. 기간제 ──────────────────────────────────────────────
  {
    typeCode:  'FIXED_TERM',
    typeLabel: '기간제',
    documents: [
      { label: '기간제 근로계약서',                      required: true  },
      { label: '개인정보 수집·이용 동의서',               required: true  },
      { label: '근로조건 설명 확인서',                    required: true  },
      { label: '계약기간 종료일 재확인 문서',             required: true, note: '계약 종료일이 계약서 본문에 명기되어야 함' },
      { label: '계약기간 연장·변경 시 별도 확인서',       required: false, note: '연장 또는 재계약 시 추가' },
    ],
    allowedTemplates: [
      'FIXED_TERM_EMPLOYMENT',
    ],
    blockedTemplates: [
      'DAILY_EMPLOYMENT',
      'MONTHLY_FIXED_EMPLOYMENT',
      'CONTINUOUS_EMPLOYMENT',
      'REGULAR_EMPLOYMENT',
      'SUBCONTRACT_WITH_BIZ',
      'FREELANCER_SERVICE',
      'NONBUSINESS_TEAM_REVIEW',
    ],
    blockDirectEmploymentContract: false,
    endDateRequired: true,
  },

  // ── D. 외주/협력팀 ─────────────────────────────────────────
  {
    typeCode:  'SUBCONTRACTOR',
    typeLabel: '외주/협력팀',
    documents: [
      { label: '외주/협력팀 소속 확인 문서',              required: true  },
      { label: '현장 출입·작업자 등록 확인 문서',         required: true  },
      { label: '개인정보 수집·이용 동의서 (필요 범위)',    required: true  },
      { label: '협력업체 정보 확인서',                    required: false, note: '사업자 있는 경우 추가' },
      { label: '출입 준수사항 확인서',                    required: false, note: '현장 출입 시 추가' },
      { label: '안전 관련 제출 문서',                     required: false, note: '안전 모듈 연동 시 자동 추가' },
    ],
    allowedTemplates: [
      'SUBCONTRACT_WITH_BIZ',
      'FREELANCER_SERVICE',
      'NONBUSINESS_TEAM_REVIEW',
    ],
    // 직접고용 근로계약 템플릿 전체 차단
    blockedTemplates: [
      'DAILY_EMPLOYMENT',
      'MONTHLY_FIXED_EMPLOYMENT',
      'CONTINUOUS_EMPLOYMENT',
      'REGULAR_EMPLOYMENT',
      'FIXED_TERM_EMPLOYMENT',
    ],
    blockDirectEmploymentContract: true,
    endDateRequired: false,
  },
]

// ─── 헬퍼 함수 ───────────────────────────────────────────────

/**
 * laborRelationType + contractTemplateType 으로 문서 세트 조회
 */
export function getDocumentSet(laborRelation: string, templateType?: string): DocumentSet | null {
  // 외주/협력팀
  if (['SUBCONTRACT_BIZ', 'TEAM_NONBIZ_REVIEW'].includes(laborRelation)) {
    return DOCUMENT_SETS.find(s => s.typeCode === 'SUBCONTRACTOR') ?? null
  }
  // 직접고용 — 템플릿으로 분기
  if (templateType === 'REGULAR_EMPLOYMENT') {
    return DOCUMENT_SETS.find(s => s.typeCode === 'REGULAR') ?? null
  }
  if (templateType === 'FIXED_TERM_EMPLOYMENT') {
    return DOCUMENT_SETS.find(s => s.typeCode === 'FIXED_TERM') ?? null
  }
  // 일용직 계열
  return DOCUMENT_SETS.find(s => s.typeCode === 'DAILY') ?? null
}

/**
 * 주어진 계약 템플릿이 해당 문서 세트에서 차단 대상인지 확인.
 * 차단이면 오류 메시지를 반환하고, 허용이면 null을 반환한다.
 */
export function checkTemplateBlocked(
  documentSet: DocumentSet,
  templateType: string,
): string | null {
  if (documentSet.blockedTemplates.includes(templateType)) {
    if (documentSet.blockDirectEmploymentContract) {
      return `외주/협력팀 유형은 자사 직접 근로계약서(${templateType}) 생성 대상이 아닙니다. 외주/협력팀 전용 문서를 선택하세요.`
    }
    return `현재 선택한 유형(${documentSet.typeLabel})과 계약서 종류(${templateType})가 일치하지 않습니다. 유형 또는 문서를 다시 확인하세요.`
  }
  return null
}

/**
 * 필수 문서 항목 중 required: true 인 것만 반환
 */
export function getRequiredDocuments(set: DocumentSet): DocumentItem[] {
  return set.documents.filter(d => d.required)
}
