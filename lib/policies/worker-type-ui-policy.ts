/**
 * 근로유형 선택 UI 정책 — 설명 문구 단일 원천
 *
 * 모든 UI의 유형 설명 문구는 이 파일에서 가져온다.
 * 각 페이지에 하드코딩 금지.
 *
 * 포함 항목:
 *   - 유형별 설명 카드 데이터
 *   - 비교표 데이터
 *   - 추천 질문/답변 트리
 *   - 오선택 조합 경고 규칙
 *   - 공식 표기 (용어 통일)
 */

// ─── 유형 설명 카드 ──────────────────────────────────────────────────────────

export interface WorkerTypeCard {
  /** 내부 코드 (EmploymentType 또는 OrganizationType 기준) */
  code: string
  /** 공식 표시명 (이 명칭으로 UI 전역 통일) */
  label: string
  /** 아이콘 이모지 */
  icon: string
  /** 한 줄 정의 (법률 용어 아닌 실무 언어) */
  shortDef: string
  /** 이런 경우 선택 (관리자 판단 기준) */
  whenToUse: string[]
  /** 이런 경우 선택 금지 */
  whenNotToUse: string[]
  /** 적용 문서 목록 */
  appliedDocuments: string[]
  /** 계산 방식 요약 */
  calcMethod: string
  /** 주의사항 (선택 전 필독) */
  warnings?: string[]
  /** 카드 강조 색상 (hex) */
  accentColor: string
}

export const WORKER_TYPE_CARDS: WorkerTypeCard[] = [
  {
    code:         'DAILY_CONSTRUCTION',
    label:        '건설일용',
    icon:         '🏗️',
    accentColor:  '#1976d2',
    shortDef:     '하루 단위로 출역하고 일당을 받는 건설 현장 근로자',
    whenToUse: [
      '하루씩 출근하고 일당을 받는 경우',
      '단기 또는 비정기적으로 현장에 투입되는 경우',
      '건설 현장 공수(工數) 기준으로 정산하는 경우',
    ],
    whenNotToUse: [
      '매달 고정 월급을 받는 경우 → 상용직 선택',
      '계약 종료일이 있고 월급제인 경우 → 기간제 선택',
      '우리 회사 소속이 아닌 경우 → 외주/협력팀 선택',
    ],
    appliedDocuments: ['일용근로자 근로계약서', '근로조건 설명 확인서', '개인정보 수집 동의서'],
    calcMethod:    '1일 출역 = 1공수(1.0), 반일 = 0.5공수, 미퇴근 = 0공수 (일당 × 공수 = 지급액)',
    warnings:     ['일용직 계약서에는 계속 고용 보장 문구 삽입 불가', '일당 기준 — 월급제 직원에게 잘못 적용 시 정산 오류 발생'],
  },
  {
    code:         'REGULAR',
    label:        '상용직',
    icon:         '👔',
    accentColor:  '#2e7d32',
    shortDef:     '재직 개념이 있는 일반 직원. 고정 월급 또는 시급제.',
    whenToUse: [
      '정해진 종료일 없이 재직하는 일반 직원',
      '매달 고정 월급을 받는 경우',
      '입사일부터 퇴사일까지 재직이 연속되는 경우',
    ],
    whenNotToUse: [
      '종료일이 정해진 계약이면 → 기간제 선택',
      '하루 단위 일당 중심이면 → 건설일용 선택',
      '우리 회사 소속이 아니면 → 외주/협력팀 선택',
    ],
    appliedDocuments: ['상용직 근로계약서', '4대보험 적용'],
    calcMethod:    '근태 관리 중심 (출근일수·시간 기록). 공수 체계 미적용. 월급 ÷ 소정근로일 = 일 단위 환산.',
    warnings:     ['잘못 선택 시 일용직 공수 계산 시스템에 포함되어 급여 오산 발생 가능'],
  },
  {
    code:         'FIXED_TERM',
    label:        '기간제',
    icon:         '📅',
    accentColor:  '#e65100',
    shortDef:     '종료일이 정해진 계약 근로자. 기간제법 적용 (최대 2년).',
    whenToUse: [
      '계약 만료일이 명확하게 정해진 경우',
      '특정 프로젝트 기간 동안 채용하는 경우',
      '출산휴가·육아휴직 대체 인원',
    ],
    whenNotToUse: [
      '종료일이 없는 일반 재직자면 → 상용직 선택',
      '하루 단위 일당 중심이면 → 건설일용 선택',
      '2년 초과 예정이면 → 기간만료 후 전환 검토 필요',
    ],
    appliedDocuments: ['기간제 근로계약서 (종료일 필수 표시)', '4대보험 적용'],
    calcMethod:    '근태 관리 중심. 공수 체계 미적용. 계약기간 명시 필수.',
    warnings:     ['기간제법: 동일 업무 2년 초과 시 무기계약 전환 의무', '계약 종료일을 반드시 입력해야 함'],
  },
  {
    code:         'CONTINUOUS_SITE',
    label:        '계속근로형',
    icon:         '🔄',
    accentColor:  '#6a1b9a',
    shortDef:     '현장에 장기 배치되는 근로자. 일용직과 상용직의 중간 형태.',
    whenToUse: [
      '한 현장에 장기간 배치되어 지속 근무하는 경우',
      '일당 또는 공수 기준이지만 장기 재직이 예상되는 경우',
      '현장 계속 근로로 인해 일용직 계약이 반복되는 경우',
    ],
    whenNotToUse: [
      '단기/단발성 현장이면 → 건설일용 선택',
      '완전한 월급제 재직이면 → 상용직 선택',
    ],
    appliedDocuments: ['계속근로형 근로계약서', '현장별 공수/근태 선택 적용'],
    calcMethod:    '공수 체계 선택 적용 가능 (현장 정책에 따름). 장기 재직 시 퇴직공제 등 고려.',
    warnings:     ['별도 세부 정책 확정 필요. 운영 담당자와 협의 후 선택 권장.'],
  },
  {
    code:         'SUBCONTRACTOR',  // organizationType
    label:        '외주/협력팀',
    icon:         '🤝',
    accentColor:  '#f57f17',
    shortDef:     '자사 근로자가 아닌 외부 업체·팀 소속 인원.',
    whenToUse: [
      '우리 회사 소속이 아닌 외부 업체 직원',
      '협력업체가 보낸 기술 인력',
      '출입·안전관리만 필요하고 자사 급여 대상이 아닌 경우',
    ],
    whenNotToUse: [
      '우리 회사가 직접 채용한 경우 → 직영 유형(일용직/상용직/기간제) 선택',
      '자사 근로계약서를 발급해야 하는 경우 → 직영 선택',
    ],
    appliedDocuments: ['도급·용역계약서 (사업자 있는 경우)', '팀장 책임확인서 (사업자 없는 경우)'],
    calcMethod:    '자사 급여정산 제외. 출입·안전서류 관리 목적. 업체 단위 정산이 원칙.',
    warnings:     ['외주 인원에게 자사 근로계약서 발급 금지', '자사 급여대장에 포함 금지'],
  },
  {
    code:         'BUSINESS_33',
    label:        '3.3%사업소득',
    icon:         '🧾',
    accentColor:  '#555',
    shortDef:     '사업소득 원천징수 3.3% 대상. 프리랜서·용역 계약.',
    whenToUse: [
      '프리랜서 계약 또는 용역 계약으로 일하는 경우',
      '사업소득세 3.3%를 원천징수하는 경우',
    ],
    whenNotToUse: [
      '건설 현장 일용 근로라면 → 건설일용 선택 (세금 코드가 다름)',
      '4대보험 적용 대상이면 → 상용직/기간제 선택',
    ],
    appliedDocuments: ['프리랜서 용역계약서', '3.3% 원천징수영수증'],
    calcMethod:    '공수 체계 미적용. 용역비 × (1-3.3%) = 실수령액.',
    warnings:     ['건설일용과 세금 코드(과세 방식)가 다름. 잘못 선택 시 세금 신고 오류.'],
  },
]

// ─── 비교표 ──────────────────────────────────────────────────────────────────

export interface ComparisonRow {
  criterion: string   // 비교 항목
  values: Record<string, string>  // code → 표시값
}

/** 유형 비교표 데이터 */
export const WORKER_TYPE_COMPARISON: ComparisonRow[] = [
  {
    criterion: '자사 소속',
    values: {
      DAILY_CONSTRUCTION: '✅ 직영',
      REGULAR:            '✅ 직영',
      FIXED_TERM:         '✅ 직영',
      CONTINUOUS_SITE:    '✅ 직영',
      SUBCONTRACTOR:      '❌ 외부소속',
      BUSINESS_33:        '협의',
    },
  },
  {
    criterion: '계약 종료일',
    values: {
      DAILY_CONSTRUCTION: '매일 종료',
      REGULAR:            '없음 (무기)',
      FIXED_TERM:         '✅ 반드시 있음',
      CONTINUOUS_SITE:    '선택적',
      SUBCONTRACTOR:      '계약기간',
      BUSINESS_33:        '계약기간',
    },
  },
  {
    criterion: '급여 방식',
    values: {
      DAILY_CONSTRUCTION: '일당 (공수)',
      REGULAR:            '월급',
      FIXED_TERM:         '월급',
      CONTINUOUS_SITE:    '일당 또는 월급',
      SUBCONTRACTOR:      '도급/용역',
      BUSINESS_33:        '용역비',
    },
  },
  {
    criterion: '공수 계산 적용',
    values: {
      DAILY_CONSTRUCTION: '✅ 적용',
      REGULAR:            '❌ 미적용',
      FIXED_TERM:         '❌ 미적용',
      CONTINUOUS_SITE:    '선택 가능',
      SUBCONTRACTOR:      '❌ 미적용',
      BUSINESS_33:        '❌ 미적용',
    },
  },
  {
    criterion: '자사 급여정산 대상',
    values: {
      DAILY_CONSTRUCTION: '✅',
      REGULAR:            '✅',
      FIXED_TERM:         '✅',
      CONTINUOUS_SITE:    '✅',
      SUBCONTRACTOR:      '❌ 제외',
      BUSINESS_33:        '원천징수만',
    },
  },
  {
    criterion: '4대보험 적용',
    values: {
      DAILY_CONSTRUCTION: '조건부',
      REGULAR:            '✅ 전체',
      FIXED_TERM:         '✅ 전체',
      CONTINUOUS_SITE:    '조건부',
      SUBCONTRACTOR:      '❌ 해당없음',
      BUSINESS_33:        '❌ 해당없음',
    },
  },
  {
    criterion: '자사 근로계약서',
    values: {
      DAILY_CONSTRUCTION: '일용 계약서',
      REGULAR:            '상용 계약서',
      FIXED_TERM:         '기간제 계약서',
      CONTINUOUS_SITE:    '계속근로 계약서',
      SUBCONTRACTOR:      '❌ 발급 금지',
      BUSINESS_33:        '용역계약서',
    },
  },
]

// ─── 추천 질문 (3-step quiz) ─────────────────────────────────────────────────

export interface QuizQuestion {
  id: string
  text: string
  yesLabel: string
  noLabel: string
}

export const RECOMMENDATION_QUIZ: QuizQuestion[] = [
  {
    id:       'isInternal',
    text:     '이 근로자는 우리 회사(자사) 소속으로 직접 채용합니까?',
    yesLabel: '예 — 자사 직접 채용',
    noLabel:  '아니오 — 외부 업체·협력팀 소속',
  },
  {
    id:       'isDailyWage',
    text:     '매일 출역할 때마다 일당을 받는 방식입니까? (일당/공수 중심)',
    yesLabel: '예 — 일당/공수 방식',
    noLabel:  '아니오 — 월급 또는 용역비 방식',
  },
  {
    id:       'hasEndDate',
    text:     '계약 종료일(만료일)이 미리 정해져 있습니까?',
    yesLabel: '예 — 종료일 있음',
    noLabel:  '아니오 — 종료일 없는 재직',
  },
]

/** quiz 답변에서 추천 유형 코드 결정 */
export function resolveRecommendedType(answers: Record<string, boolean>): string {
  const { isInternal, isDailyWage, hasEndDate } = answers

  // 자사 소속 아님 → 외주/협력팀
  if (isInternal === false) return 'SUBCONTRACTOR'

  // 자사 소속 + 일당/공수 → 건설일용
  if (isInternal && isDailyWage) return 'DAILY_CONSTRUCTION'

  // 자사 소속 + 월급제 + 종료일 있음 → 기간제
  if (isInternal && !isDailyWage && hasEndDate) return 'FIXED_TERM'

  // 자사 소속 + 월급제 + 종료일 없음 → 상용직
  if (isInternal && !isDailyWage && hasEndDate === false) return 'REGULAR'

  // 아직 모든 답변이 완료되지 않은 경우
  return ''
}

// ─── 오선택 경고 조합 ─────────────────────────────────────────────────────────

export interface MismatchWarning {
  /** 내부 판별 코드 */
  code: string
  /** 경고 메시지 (관리자 언어) */
  message: string
  /** 차단 수준: 'WARN' = 경고만, 'BLOCK' = 진행 차단 */
  level: 'WARN' | 'BLOCK'
}

/**
 * 고용형태와 소속구분의 오선택 조합 감지
 * (근로자 등록 시 적용)
 */
export function detectEmploymentMismatch(
  employmentType: string,
  organizationType: string,
): MismatchWarning | null {
  // 외주 소속인데 자사 근로자 유형 선택
  if (organizationType === 'SUBCONTRACTOR' &&
      ['REGULAR', 'FIXED_TERM', 'CONTINUOUS_SITE'].includes(employmentType)) {
    return {
      code:    'OUTSOURCED_WITH_EMPLOYMENT_TYPE',
      message: '협력사 소속 인원에게 자사 상용직/기간제 유형을 선택했습니다. 외주 인원은 자사 근로자 처우를 받지 않습니다. 계속 진행하시겠습니까?',
      level:   'WARN',
    }
  }

  // 외주 소속인데 건설일용 선택 (출입 목적이라면 허용하되 경고)
  if (organizationType === 'SUBCONTRACTOR' && employmentType === 'DAILY_CONSTRUCTION') {
    return {
      code:    'OUTSOURCED_DAILY_CONSTRUCTION',
      message: '협력사 소속 인원에게 건설일용 고용형태를 선택했습니다. 자사 급여정산 대상이 아님을 확인하세요.',
      level:   'WARN',
    }
  }

  return null
}

// ─── 계약 유형 분기 안내 ────────────────────────────────────────────────────

export interface LaborRelationGuide {
  code: string
  label: string
  icon: string
  shortDef: string
  whenToUse: string[]
  whenNotToUse: string[]
  templateOptions: { value: string; label: string; desc: string }[]
  warningChecklist?: string[]  // 선택 전 확인 질문
}

export const LABOR_RELATION_GUIDES: LaborRelationGuide[] = [
  {
    code:      'DIRECT_EMPLOYEE',
    label:     '직접고용',
    icon:      '🏢',
    shortDef:  '회사가 출퇴근·급여·계약을 직접 관리하는 자사 근로자',
    whenToUse: [
      '우리 회사가 직접 채용한 근로자',
      '출퇴근을 회사 시스템으로 관리하는 경우',
      '회사가 개인에게 직접 급여를 지급하는 경우',
    ],
    whenNotToUse: [
      '외부 업체 소속이면 → 외주팀 선택',
      '팀장이 팀원 급여를 대신 수령하면 → 팀장형 선택 (검토 필요)',
    ],
    templateOptions: [
      { value: 'DAILY_EMPLOYMENT',      label: '건설일용 근로계약서', desc: '하루 단위 출역/일당 기준. 가장 많이 쓰이는 기본 계약서.' },
      { value: 'REGULAR_EMPLOYMENT',    label: '상용직 근로계약서',   desc: '재직 개념 있는 월급제 직원. 4대보험 전체 적용.' },
      { value: 'FIXED_TERM_EMPLOYMENT', label: '기간제 근로계약서',   desc: '종료일이 있는 계약 근로자. 기간제법 적용 (2년 제한).' },
      { value: 'CONTINUOUS_EMPLOYMENT', label: '계속근로형 계약서',   desc: '장기 현장 배치 근로자. 일용직과 상용직 중간 형태.' },
      { value: 'OFFICE_SERVICE',        label: '사무보조 용역계약서', desc: '사무보조 역할로 용역비 지급. 사업소득 3.3% 적용.' },
    ],
    warningChecklist: [
      '이 근로자는 우리 회사 소속입니까?',
      '회사가 개인별 출퇴근을 직접 관리합니까?',
      '회사가 개인에게 직접 급여를 지급합니까?',
    ],
  },
  {
    code:      'SUBCONTRACT_BIZ',
    label:     '외주팀 (사업자 있음)',
    icon:      '🏗️',
    shortDef:  '사업자등록이 있는 외주업체·팀. 공정·성과 기준으로 정산.',
    whenToUse: [
      '사업자등록증이 있는 외주업체',
      '공정 단위 또는 성과 기준으로 대금을 지급하는 경우',
      '업체 팀장이 팀원 급여를 자체 지급하는 경우',
    ],
    whenNotToUse: [
      '사업자등록증이 없는 경우 → 팀장형(사업자 없음) 선택',
      '개인별 출퇴근을 우리 회사가 직접 관리하면 → 직접고용',
    ],
    templateOptions: [
      { value: 'SUBCONTRACT_WITH_BIZ', label: '도급·용역계약서',    desc: '사업자 있는 외주업체와의 공정 도급계약.' },
      { value: 'FREELANCER_SERVICE',   label: '프리랜서 용역계약서', desc: '3.3% 원천징수 방식 용역 계약.' },
    ],
    warningChecklist: [
      '사업자등록번호를 확인했습니까?',
      '회사(원청)가 팀원 개인별 급여를 직접 지급하지 않습니까?',
    ],
  },
  {
    code:      'TEAM_NONBIZ_REVIEW',
    label:     '팀장형 (사업자 없음) ⚠',
    icon:      '⚠️',
    shortDef:  '사업자 없는 팀장이 팀원을 모아 작업. 직접고용 재분류 위험.',
    whenToUse: [
      '팀장이 팀원을 직접 모아 공사하고 원청에 청구하는 구조',
      '사업자등록증이 없어서 외주팀 계약이 불가한 경우',
    ],
    whenNotToUse: [
      '회사가 개인별 출퇴근을 직접 관리하는 경우 → 직접고용으로 전환',
      '회사가 개인 금액을 직접 결정하는 경우 → 직접고용으로 전환',
      '회사가 개인에게 직접 지급하는 경우 → 직접고용으로 전환',
    ],
    templateOptions: [
      { value: 'NONBUSINESS_TEAM_REVIEW', label: '팀장 책임확인서 세트', desc: '검토 필요 상태로 등록. 직접고용 재분류 위험 문서 포함.' },
    ],
    warningChecklist: [
      '회사가 팀원 개인별 출퇴근을 직접 관리합니까? → 해당하면 직접고용으로 전환',
      '회사가 팀원 개인 금액을 직접 결정합니까? → 해당하면 직접고용으로 전환',
      '회사가 팀원 개인에게 직접 송금합니까? → 해당하면 직접고용으로 전환',
    ],
  },
]

/** 계약 생성 시 labor relation과 template 조합의 추천 가이드 텍스트 */
export function getTemplateSummary(templateType: string): string {
  for (const guide of LABOR_RELATION_GUIDES) {
    const t = guide.templateOptions.find(o => o.value === templateType)
    if (t) return t.desc
  }
  return ''
}

// ─── 용어 통일 공식 표기 ─────────────────────────────────────────────────────

/**
 * 공식 표기 기준 — 전체 UI에서 이 이름으로만 사용
 * 유사어(기간의 정함 있는, 계약직, 외주인력 등)는 내부적으로 매핑하되 UI 표시는 아래로 통일
 */
export const OFFICIAL_TYPE_NAMES: Record<string, string> = {
  DAILY_CONSTRUCTION: '건설일용',
  REGULAR:            '상용직',
  FIXED_TERM:         '기간제',
  CONTINUOUS_SITE:    '계속근로형',
  SUBCONTRACTOR:      '외주/협력팀',
  BUSINESS_33:        '3.3%사업소득',
  DIRECT:             '직영',
  // 계약 분류
  DIRECT_EMPLOYEE:    '직접고용',
  SUBCONTRACT_BIZ:    '외주팀(사업자)',
  TEAM_NONBIZ_REVIEW: '팀장형(검토)',
}

export function getOfficialName(code: string): string {
  return OFFICIAL_TYPE_NAMES[code] ?? code
}

// ─── 관리자 안내표 (4대 유형) ─────────────────────────────────────────────────

export interface AdminTypeGuide {
  /** 내부 코드 (EmploymentType 또는 'SUBCONTRACTOR' for orgType) */
  code: string
  /** 화면 표시명 */
  label: string
  /** 아이콘 이모지 */
  icon: string
  /** 비교표 행 데이터 */
  tableRow: {
    whenToSelect: string
    endDateConcept: string
    calcBasis: string
    documents: string
  }
  /** 카드 본문 설명 */
  detail: string
  /** 이 유형이 맞는 경우 */
  whenItFits: string[]
  /** 주의사항 */
  caution: string
  /** 진행 버튼 문구 */
  buttonLabel: string
  /** 강조 색상 */
  accentColor: string
  /** 계약 생성 화면에서 이 유형 선택 시 자동 설정값 */
  contractMapping: {
    laborRelation: string
    templateType: string
  }
  /**
   * 계약서 생성에 필요한 수동 입력 필수값 목록.
   * 이 값이 누락되면 계약서 생성이 차단된다.
   */
  requiredFields: { field: string; label: string; note?: string }[]
  /**
   * 회사/현장/근로자 프로필에서 자동 채워지는 항목 목록.
   * 관리자가 별도로 입력하지 않아도 되는 값이다.
   */
  autoFields: string[]
  /**
   * 계약서 생성 차단 조건 (요약).
   * 앱 계약 생성 버튼 비활성화/차단 규칙 설명.
   */
  blockingConditions: string[]
}

export const ADMIN_TYPE_GUIDES: AdminTypeGuide[] = [
  {
    code: 'DAILY_CONSTRUCTION',
    label: '일용직',
    icon: '📅',
    tableRow: {
      whenToSelect: '하루 단위 또는 단기간 현장 근무, 일당 중심으로 관리하는 경우',
      endDateConcept: '보통 고정 종료일 없이 단기 운용 또는 짧은 기간',
      calcBasis: '공수 중심, 일당 중심',
      documents: '일용직 근로계약서 및 일용직 관련 서류',
    },
    detail: '하루 단위 또는 단기간 현장근무를 전제로 사용하는 유형입니다. 주로 일당, 공수, 출근일수 중심으로 관리합니다. 단기·호출형 인력에만 적합합니다.',
    whenItFits: ['현장 인력을 단기 투입하는 경우', '일당 기준으로 관리하는 경우', '일별 투입 관리가 중심인 경우'],
    caution: '일 단위 임금 계산이더라도 계약기간이 1개월 이상이거나 고정 반복 운영이라면 상용직 검토 대상입니다. 장기 고정근무자에 일용직을 계속 사용하면 실제 근로관계와 계약 문구가 충돌할 수 있습니다.',
    buttonLabel: '일용직으로 진행',
    accentColor: '#1976d2',
    contractMapping: { laborRelation: 'DIRECT_EMPLOYEE', templateType: 'DAILY_EMPLOYMENT' },
    requiredFields: [
      { field: 'workerId',   label: '근로자 선택',  note: '반드시 근로자를 먼저 선택해야 합니다.' },
      { field: 'startDate',  label: '근로일',        note: '이 계약이 적용될 근로일 (workDate)' },
      { field: 'siteName',   label: '현장명' },
      { field: 'dailyWage',  label: '일당',          note: '일급 미입력 시 계약서 생성 차단' },
    ],
    autoFields: [
      '회사명 (companyName)',
      '대표자 (companyCeo)',
      '회사 주소 (companyAddress)',
      '사업자등록번호 (companyBizNo)',
      '근로자 성명 (workerName)',
      '근로자 생년월일 (workerBirthDate)',
      '현장 주소 (siteAddress)',
      '공사명 (projectName)',
    ],
    blockingConditions: [
      '근로자 미선택 → 저장 차단',
      '근로일(startDate) 미입력 → 저장 차단',
      '일당(dailyWage) 미입력 → 계약서 생성 차단',
      '외주/협력팀 유형인데 이 계약 선택 → 생성 차단',
    ],
  },
  {
    code: 'REGULAR',
    label: '상용직 (정규직 포함)',
    icon: '👔',
    tableRow: {
      whenToSelect: '계속 근무를 전제로 재직 관리하는 직원. 일반적으로 정규직으로 운영하는 인력 포함.',
      endDateConcept: '없음 (기간의 정함 없음)',
      calcBasis: '출퇴근/근태 중심, 지속 근무 관리',
      documents: '상용직 근로계약서 (기간의 정함이 없는 근로계약)',
    },
    detail: '계속 근무를 전제로 재직 관리하는 직원 유형입니다. 일반적으로 정규직으로 운영하는 현장 고정 인력도 이 유형을 선택합니다. 계약기간을 따로 정하지 않는 무기계약 구조입니다.',
    whenItFits: ['회사 소속으로 계속 근무하는 직원', '정규직으로 운영하는 현장 고정 인력', '현장 배치가 바뀌어도 재직 개념이 유지되는 경우', '일당보다 일반 근태관리 성격이 강한 경우'],
    caution: '종료일이 확정된 인력은 기간제가 더 적절합니다. 정규직이라는 이유만으로 종료일을 같이 입력하지 마세요.',
    buttonLabel: '상용직(정규직 포함)으로 진행',
    accentColor: '#2e7d32',
    contractMapping: { laborRelation: 'DIRECT_EMPLOYEE', templateType: 'REGULAR_EMPLOYMENT' },
    requiredFields: [
      { field: 'workerId',      label: '근로자 선택' },
      { field: 'startDate',     label: '근로개시일' },
      { field: 'checkInTime',   label: '시업 시각',   note: '소정근로시간 계산에 사용' },
      { field: 'checkOutTime',  label: '종업 시각',   note: '소정근로시간 계산에 사용' },
      { field: 'monthlySalary', label: '월급 또는 임금',  note: 'dailyWage로 대체 가능' },
    ],
    autoFields: [
      '회사명·대표자·주소·사업자등록번호',
      '근로자 성명·생년월일',
      '현장명·주소·공사명',
      '기본 직종/직무 (jobCategory, jobTitle)',
    ],
    blockingConditions: [
      '근로자 미선택 → 저장 차단',
      '시작일 미입력 → 저장 차단',
      '임금(monthlySalary 또는 dailyWage) 미입력 → 생성 차단',
      '시업·종업 시각 미입력 → 생성 차단',
      '종료일 입력 시 → 경고 표시 (차단 아님)',
      '기간제 템플릿 선택 시 → 생성 차단',
    ],
  },
  {
    code: 'FIXED_TERM',
    label: '기간제',
    icon: '⏰',
    tableRow: {
      whenToSelect: '근로 시작일과 종료일이 명확한 근로자',
      endDateConcept: '있음 (필수 입력)',
      calcBasis: '근태 중심, 기간 관리 포함',
      documents: '기간제 근로계약서',
    },
    detail: '근로기간의 시작일과 종료일이 정해진 근로자 유형입니다. 종료일이 계약상 명확할 때 선택합니다.',
    whenItFits: ['근로 종료일이 정해져 있는 경우', '특정 기간 동안만 근무하는 경우', '계약기간 관리가 중요한 경우'],
    caution: '단순히 현장 근무라는 이유만으로 기간제를 선택하면 안 됩니다. 종료일이 없으면 상용직 또는 다른 유형이 더 적절합니다.',
    buttonLabel: '기간제로 진행',
    accentColor: '#e65100',
    contractMapping: { laborRelation: 'DIRECT_EMPLOYEE', templateType: 'FIXED_TERM_EMPLOYMENT' },
    requiredFields: [
      { field: 'workerId',      label: '근로자 선택' },
      { field: 'startDate',     label: '계약 시작일' },
      { field: 'endDate',       label: '계약 종료일',  note: '종료일 미입력 시 계약서 생성 차단' },
      { field: 'checkInTime',   label: '시업 시각' },
      { field: 'checkOutTime',  label: '종업 시각' },
      { field: 'monthlySalary', label: '임금 (월급 또는 일당)', note: 'dailyWage로 대체 가능' },
    ],
    autoFields: [
      '회사명·대표자·주소·사업자등록번호',
      '근로자 성명·생년월일',
      '현장명·주소·공사명',
    ],
    blockingConditions: [
      '근로자 미선택 → 저장 차단',
      '시작일 미입력 → 저장 차단',
      '종료일 미입력 → 생성 차단',
      '종료일 < 시작일 → 생성 차단',
      '임금 미입력 → 생성 차단',
      '상용직 템플릿 선택 시 → 생성 차단',
    ],
  },
  {
    code: 'SUBCONTRACTOR',
    label: '외주/협력팀',
    icon: '🤝',
    tableRow: {
      whenToSelect: '자사 직접 고용이 아닌 외부 업체 소속 인원',
      endDateConcept: '상황별',
      calcBasis: '출입/안전/현장관리 중심',
      documents: '외주·협력사 확인 문서, 출입관리 문서',
    },
    detail: '자사 직접 고용이 아니라 외부 업체 소속으로 현장에 출입하거나 작업하는 인원입니다. 근로계약보다는 출입, 안전, 확인 문서 관리가 중심입니다.',
    whenItFits: ['협력업체 직원', '자사 급여/직접 고용 대상이 아닌 경우', '출입 및 안전문서 관리가 주목적인 경우'],
    caution: '자사 직접 근로자인데 외주로 잘못 선택하면 계약과 정산 기준이 달라질 수 있습니다.',
    buttonLabel: '외주/협력팀으로 진행',
    accentColor: '#f57f17',
    contractMapping: { laborRelation: 'SUBCONTRACT_BIZ', templateType: 'SUBCONTRACT_WITH_BIZ' },
    requiredFields: [
      { field: 'workerId',       label: '근로자(대표자) 선택' },
      { field: 'startDate',      label: '계약 시작일' },
      { field: 'contractorName', label: '소속 업체명',  note: '사업자 있는 경우 필수. 미입력 시 생성 차단.' },
    ],
    autoFields: [
      '회사명·대표자·주소·사업자등록번호 (도급인 정보)',
      '근로자 성명·연락처',
      '현장명·주소',
    ],
    blockingConditions: [
      '근로자 미선택 → 저장 차단',
      '시작일 미입력 → 저장 차단',
      '사업자 있는 외주 + 업체명 미입력 → 생성 차단',
      '자사 직접고용 계약서(일용직/상용직/기간제) 선택 → 생성 차단',
    ],
  },
]

/** 오선택 방지 경고 문구 (6개) */
export const ADMIN_TYPE_WARNINGS: string[] = [
  '현장에 근무한다고 모두 기간제는 아닙니다. 종료일이 확정된 경우에만 기간제를 선택하세요.',
  '일 단위 임금 계산이라도 계약기간이 1개월 이상이면 상용직(정규직 포함) 검토 대상입니다.',
  '자사 직접 고용이 아니면 반드시 외주/협력팀을 선택하세요. 근로계약서와 혼동하지 마세요.',
  '단기 호출형·일당 중심 인력이면 일용직을 먼저 검토하세요.',
  '장기 계속 근무 예정 직원이면 상용직(정규직 포함)을 검토하세요. 정규직도 이 유형에 해당합니다.',
  '상용직을 선택할 때 종료일을 같이 입력하면 안 됩니다. 종료일이 있으면 기간제를 선택하세요.',
]

/**
 * 근로자 등록 유형 vs 계약 템플릿 유형 불일치 감지
 * (계약 생성 화면에서 사용)
 */
// ─── 근로자 확인 박스 데이터 ─────────────────────────────────────────────────

export interface WorkerConfirmationGuide {
  /** EmploymentType 코드 (또는 'SUBCONTRACTOR') */
  code: string
  /** 근로자 화면 제목 */
  title: string
  /** 근로자용 쉬운 설명 */
  description: string
  /** 확인 포인트 목록 */
  checkPoints: string[]
  /** 체크박스 문구 목록 */
  checkboxes: string[]
  /** 서명 직전 최종 확인 문구 */
  finalCheckText: string
}

export const WORKER_CONFIRMATION_GUIDES: WorkerConfirmationGuide[] = [
  {
    code: 'DAILY_CONSTRUCTION',
    title: '현재 등록된 유형은 일용직입니다.',
    description: '이 유형은 주로 하루 단위 또는 단기간 현장 근무에 사용됩니다. 임금은 일당 또는 공수 기준으로 처리될 수 있으니, 근무일과 임금 조건을 확인하세요.',
    checkPoints: ['근무일 기준을 확인하세요.', '임금 기준(일당/공수)을 확인하세요.', '계약 내용이 단기 현장근무 기준인지 확인하세요.'],
    checkboxes: ['본인은 일용직 유형으로 등록된 내용을 확인했습니다.', '본인은 근무일 및 임금 기준을 확인했습니다.'],
    finalCheckText: '본인은 일용직 기준의 근무 및 임금 처리 내용을 확인했습니다.',
  },
  {
    code: 'REGULAR',
    title: '현재 등록된 유형은 상용직(정규직 포함)입니다.',
    description: '이 유형은 계약기간을 따로 정하지 않는 계속 근무 형태입니다. 일반적으로 정규직으로 운영되는 인력도 이 유형에 포함됩니다. 근무조건, 임금 조건을 확인한 뒤 진행하세요.',
    checkPoints: ['계약기간을 따로 정하지 않는 계약인지 확인하세요.', '종료일이 별도로 없는 구조인지 확인하세요.', '근무시간 및 임금 조건을 확인하세요.'],
    checkboxes: ['본인은 기간의 정함이 없는 상용직(정규직) 유형으로 등록된 내용을 확인했습니다.', '본인은 근무조건 및 임금 조건을 확인했습니다.'],
    finalCheckText: '본인은 기간의 정함이 없는 상용직(정규직) 근로계약임을 확인했습니다.',
  },
  {
    code: 'FIXED_TERM',
    title: '현재 등록된 유형은 기간제입니다.',
    description: '이 계약은 시작일과 종료일이 정해진 계약입니다. 계약기간과 종료일을 반드시 확인한 뒤 진행하세요.',
    checkPoints: ['계약 시작일을 확인하세요.', '계약 종료일을 확인하세요.', '기간이 정해진 계약인지 확인하세요.'],
    checkboxes: ['본인은 기간제 유형으로 등록된 내용을 확인했습니다.', '본인은 계약 시작일과 종료일을 확인했습니다.'],
    finalCheckText: '본인은 계약 시작일과 종료일이 있는 기간제 계약임을 확인했습니다.',
  },
  {
    code: 'SUBCONTRACTOR',
    title: '현재 등록된 유형은 외주/협력팀입니다.',
    description: '이 유형은 자사 직접 고용이 아닌 외부 업체 소속 인원에 대한 관리 기준입니다. 본인 소속과 적용 문서를 확인한 뒤 진행하세요.',
    checkPoints: ['본인 소속 업체를 확인하세요.', '자사 직접 고용 여부를 확인하세요.', '현장 출입 및 적용 문서를 확인하세요.'],
    checkboxes: ['본인은 외주/협력팀 유형으로 등록된 내용을 확인했습니다.', '본인은 본인 소속 및 적용 문서를 확인했습니다.'],
    finalCheckText: '본인은 본인의 소속과 적용 문서를 확인했습니다.',
  },
]

/**
 * EmploymentType 또는 OrganizationType 코드로 근로자 확인 가이드 조회
 * contractTemplateType 기준으로 매핑:
 *   DAILY/MONTHLY_FIXED → DAILY_CONSTRUCTION
 *   REGULAR_EMPLOYMENT → REGULAR
 *   FIXED_TERM_EMPLOYMENT → FIXED_TERM
 *   SUBCONTRACT/TEAM → SUBCONTRACTOR
 */
export function getWorkerConfirmation(code: string): WorkerConfirmationGuide | null {
  return WORKER_CONFIRMATION_GUIDES.find(g => g.code === code) ?? null
}

export function getWorkerConfirmationByTemplate(templateType: string): WorkerConfirmationGuide | null {
  if (['DAILY_EMPLOYMENT', 'MONTHLY_FIXED_EMPLOYMENT', 'CONTINUOUS_EMPLOYMENT'].includes(templateType))
    return getWorkerConfirmation('DAILY_CONSTRUCTION')
  if (templateType === 'REGULAR_EMPLOYMENT') return getWorkerConfirmation('REGULAR')
  if (templateType === 'FIXED_TERM_EMPLOYMENT') return getWorkerConfirmation('FIXED_TERM')
  if (['SUBCONTRACT_WITH_BIZ', 'FREELANCER_SERVICE', 'NONBUSINESS_TEAM_REVIEW'].includes(templateType))
    return getWorkerConfirmation('SUBCONTRACTOR')
  return null
}

export function detectWorkerContractMismatch(
  workerEmploymentType: string,
  contractTemplateType: string,
): string | null {
  const DAILY_TEMPLATES = ['DAILY_EMPLOYMENT', 'MONTHLY_FIXED_EMPLOYMENT']
  const REGULAR_TEMPLATES = ['REGULAR_EMPLOYMENT']
  const FIXED_TERM_TEMPLATES = ['FIXED_TERM_EMPLOYMENT']

  if (workerEmploymentType === 'REGULAR' && DAILY_TEMPLATES.includes(contractTemplateType)) {
    return '등록된 근로유형(상용직)과 선택한 계약서(일용직 계열)가 다릅니다. 실제 운영 형태에 맞는지 확인하세요.'
  }
  if (workerEmploymentType === 'FIXED_TERM' && DAILY_TEMPLATES.includes(contractTemplateType)) {
    return '등록된 근로유형(기간제)과 선택한 계약서(일용직 계열)가 다릅니다. 기간제 근로계약서 사용을 검토하세요.'
  }
  if (workerEmploymentType === 'DAILY_CONSTRUCTION' && REGULAR_TEMPLATES.includes(contractTemplateType)) {
    return '등록된 근로유형(건설일용)과 선택한 계약서(상용직)가 다릅니다. 실제 운영 형태에 맞는지 확인하세요.'
  }
  if (workerEmploymentType === 'DAILY_CONSTRUCTION' && FIXED_TERM_TEMPLATES.includes(contractTemplateType)) {
    return '등록된 근로유형(건설일용)과 선택한 계약서(기간제)가 다릅니다. 실제 운영 형태에 맞는지 확인하세요.'
  }
  return null
}
