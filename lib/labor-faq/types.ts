/**
 * labor-faq/types.ts
 *
 * 관리자 노동법 FAQ 시스템 타입 정의.
 * AI는 질문 분류만 수행하고, 최종 답변은 반드시 DB 등록 FAQ에서 출력한다.
 */

// ─── FAQ 카테고리 ───────────────────────────────────────────

export const FAQ_CATEGORIES = {
  CONTRACT_TYPE:        '계약유형 구분',
  DAILY_WORKER:         '일용직/계속근로',
  REGULAR_EMPLOYMENT:   '상용직',
  FIXED_TERM:           '기간제',
  REPEATED_CONTRACT:    '반복계약',
  OUTSOURCING:          '외주/협력팀',
  DOCUMENT_SELECTION:   '문서 선택',
  LEGAL_WARNING:        '법적 주의',
} as const

export type FaqCategory = keyof typeof FAQ_CATEGORIES

// ─── FAQ 상태 ───────────────────────────────────────────────

export type FaqStatus = 'DRAFT' | 'REVIEWED' | 'APPROVED' | 'INACTIVE'

// ─── 트리거 조건 ────────────────────────────────────────────

export interface TriggerCondition {
  /** 어느 화면/상황에서 자동 노출하는지 */
  context: 'CONTRACT_TYPE_SELECT' | 'CONTRACT_CREATE' | 'WORKER_REGISTER' | 'REPEAT_REGISTRATION'
  /** 조건 필드 이름 */
  field: string
  /** 조건 타입 */
  op: 'eq' | 'neq' | 'exists' | 'notExists' | 'gte' | 'lte' | 'contains'
  /** 비교값 */
  value?: string | number | boolean
}

// ─── FAQ 기본 레코드 ────────────────────────────────────────

export interface LaborFaqRecord {
  id: string
  category: FaqCategory
  question: string
  questionAliases: string[]
  shortAnswer: string
  fullAnswer: string
  appRule?: string | null
  caution?: string | null
  sourceOrg: string
  sourceTitle: string
  sourceUrl?: string | null
  effectiveDate: string
  relatedContractTypes: string[]
  triggerConditions: TriggerCondition[]
  priority: number
  status: FaqStatus
  isActive: boolean
  viewCount: number
  createdAt: Date
  updatedAt: Date
}

// ─── AI 분류기 입력/출력 ─────────────────────────────────────

/** AI 질문 분류기 입력 컨텍스트 */
export interface FaqClassifyInput {
  /** 관리자 자유 질문 */
  question: string
  /** 현재 선택된 계약 유형 (옵션) */
  selectedContractType?: string
  /** 현재 화면 위치 */
  currentPage?: string
  /** 폼 입력 상태 요약 (옵션) */
  formContext?: {
    hasEndDate?: boolean
    hasStartDate?: boolean
    isRepeatedRegistration?: boolean
    expectedDurationDays?: number
    workerSource?: 'DIRECT' | 'OUTSOURCED'
  }
}

/**
 * AI 분류기 출력 — 반드시 이 JSON 구조만 반환.
 * AI는 자유 문장 답변을 절대 반환하지 않는다.
 */
export interface FaqClassifyOutput {
  category: FaqCategory
  normalizedQuestion: string
  faqCandidateIds: string[]
  confidence: number  // 0.0 ~ 1.0
  warningTags: string[]
}

// ─── 추천 API 입출력 ────────────────────────────────────────

export interface FaqRecommendRequest {
  question?: string
  contractType?: string
  page?: string
  formContext?: FaqClassifyInput['formContext']
}

export interface FaqRecommendResponse {
  faqs: LaborFaqRecord[]
  source: 'AI' | 'KEYWORD' | 'CATEGORY_FALLBACK'
  confidence?: number
  warningTags?: string[]
}

// ─── 트리거 체크 ─────────────────────────────────────────────

export interface TriggerCheckRequest {
  contractType?: string
  startDate?: string
  endDate?: string | null
  workerId?: string
  siteId?: string
  repeatedCount?: number
  workerSource?: 'DIRECT' | 'OUTSOURCED'
  expectedDurationDays?: number
}

export interface TriggerCheckResponse {
  triggeredFaqs: LaborFaqRecord[]
  warningLevel: 'INFO' | 'WARN' | 'BLOCK'
}
