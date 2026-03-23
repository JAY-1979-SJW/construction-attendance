/**
 * labor-faq/classifier.ts
 *
 * 제한형 AI 질문 분류기.
 *
 * 핵심 원칙:
 * - AI는 FAQ 후보 ID 목록과 카테고리만 반환한다.
 * - AI는 사용자에게 직접 노출될 자유 문장 답변을 생성하지 않는다.
 * - AI 실패 시 키워드 fallback 검색으로 대체된다.
 */

import type { FaqClassifyInput, FaqClassifyOutput, FaqCategory } from './types'

// ─── AI 시스템 프롬프트 (제한형) ───────────────────────────────────────────

const CLASSIFIER_SYSTEM_PROMPT = `당신은 건설현장 관리자 앱의 노동법 FAQ 분류 도우미입니다.

## 역할 제한 (반드시 준수)
- 당신은 관리자의 질문을 분류하고 관련 FAQ ID를 찾아주는 역할만 합니다.
- 절대 새로운 법률 해석이나 법적 조언을 생성하지 마세요.
- 절대 자유 문장으로 답변을 생성하지 마세요.
- 등록된 FAQ에 없는 내용을 창작하지 마세요.

## 출력 형식 (반드시 이 JSON만 반환)
{
  "category": "CONTRACT_TYPE | DAILY_WORKER | REGULAR_EMPLOYMENT | FIXED_TERM | REPEATED_CONTRACT | OUTSOURCING | DOCUMENT_SELECTION | LEGAL_WARNING",
  "normalizedQuestion": "정규화된 질문 (30자 이내)",
  "faqCandidateIds": ["faq_XXXX", ...],
  "confidence": 0.0~1.0,
  "warningTags": ["태그1", "태그2"]
}

## 카테고리 정의
- CONTRACT_TYPE: 계약유형 구분 (일용직vs상용직, 기간제vs상용직 등)
- DAILY_WORKER: 일용직 및 계속근로 관련
- REGULAR_EMPLOYMENT: 상용직/정규직 관련
- FIXED_TERM: 기간제 관련
- REPEATED_CONTRACT: 반복계약/반복등록 관련
- OUTSOURCING: 외주/협력팀 관련
- DOCUMENT_SELECTION: 문서 선택/앱 운영 관련
- LEGAL_WARNING: 법적 주의사항

## warningTags 예시
- DAILY_WORKER_RISK: 일용직 오적용 위험
- CONTINUOUS_EMPLOYMENT: 계속근로 가능성
- FIXED_TERM_OVER_2YR: 기간제 2년 초과 위험
- OUTSOURCE_CONTRACT_RISK: 외주 인력에 근로계약서 발급 위험
- REPEATED_CONTRACT: 반복 계약 패턴 감지

JSON만 반환하세요. 설명, 주석, 추가 텍스트 없이 JSON만 반환하세요.`

// ─── AI 분류기 호출 ────────────────────────────────────────────────────────

export async function classifyQuestionWithAI(
  input: FaqClassifyInput,
  availableFaqIds: string[],
): Promise<FaqClassifyOutput | null> {
  try {
    const userMessage = buildUserMessage(input, availableFaqIds)

    const response = await fetch('/api/admin/labor-faqs/classify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userMessage }),
    })

    if (!response.ok) return null

    const data = await response.json()
    const result = parseAndValidateAIOutput(data.content, availableFaqIds)
    return result
  } catch {
    return null
  }
}

function buildUserMessage(input: FaqClassifyInput, availableFaqIds: string[]): string {
  const lines: string[] = []
  lines.push(`질문: ${input.question}`)
  if (input.selectedContractType) lines.push(`현재 선택된 계약유형: ${input.selectedContractType}`)
  if (input.currentPage) lines.push(`현재 화면: ${input.currentPage}`)
  if (input.formContext) {
    const fc = input.formContext
    if (fc.hasEndDate !== undefined) lines.push(`종료일 입력 여부: ${fc.hasEndDate ? '있음' : '없음'}`)
    if (fc.isRepeatedRegistration) lines.push('반복 등록 감지: 예')
    if (fc.expectedDurationDays) lines.push(`예상 근무기간: ${fc.expectedDurationDays}일`)
    if (fc.workerSource) lines.push(`근로자 소속: ${fc.workerSource === 'OUTSOURCED' ? '외주/협력팀' : '자사 직접'}`)
  }
  lines.push(`\n매칭 가능한 FAQ ID 목록: ${availableFaqIds.join(', ')}`)
  lines.push('\n위 FAQ ID 목록에서만 faqCandidateIds를 선택하세요.')
  return lines.join('\n')
}

/**
 * AI 출력 파싱 및 안전성 검증.
 * 허용된 구조 외 값이 있으면 폐기한다.
 */
function parseAndValidateAIOutput(
  content: string,
  availableFaqIds: string[],
): FaqClassifyOutput | null {
  try {
    // JSON 외 텍스트가 섞여 있으면 JSON 부분만 추출
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    const parsed = JSON.parse(jsonMatch[0])

    const VALID_CATEGORIES: FaqCategory[] = [
      'CONTRACT_TYPE', 'DAILY_WORKER', 'REGULAR_EMPLOYMENT', 'FIXED_TERM',
      'REPEATED_CONTRACT', 'OUTSOURCING', 'DOCUMENT_SELECTION', 'LEGAL_WARNING',
    ]

    if (!VALID_CATEGORIES.includes(parsed.category)) return null
    if (typeof parsed.normalizedQuestion !== 'string') return null
    if (typeof parsed.confidence !== 'number') return null

    // FAQ ID는 반드시 실제 존재하는 것만 허용
    const validCandidateIds = Array.isArray(parsed.faqCandidateIds)
      ? parsed.faqCandidateIds.filter((id: unknown) =>
          typeof id === 'string' && availableFaqIds.includes(id)
        )
      : []

    const validWarningTags = Array.isArray(parsed.warningTags)
      ? parsed.warningTags.filter((t: unknown) => typeof t === 'string' && t.length < 50)
      : []

    return {
      category:           parsed.category as FaqCategory,
      normalizedQuestion: String(parsed.normalizedQuestion).slice(0, 60),
      faqCandidateIds:    validCandidateIds,
      confidence:         Math.max(0, Math.min(1, parsed.confidence)),
      warningTags:        validWarningTags,
    }
  } catch {
    return null
  }
}

// ─── 키워드 기반 Fallback 검색 ─────────────────────────────────────────────

export interface FaqSearchItem {
  id: string
  category: FaqCategory
  question: string
  questionAliases: string[]
  shortAnswer: string
  priority: number
}

/**
 * 키워드 기반 FAQ 검색 (AI 없이 동작하는 fallback).
 * question + aliases에서 키워드를 매칭한다.
 */
export function searchFaqByKeyword(
  query: string,
  faqs: FaqSearchItem[],
  limit = 5,
): FaqSearchItem[] {
  if (!query.trim()) return []

  const keywords = query
    .toLowerCase()
    .replace(/[^\w가-힣\s]/g, ' ')
    .split(/\s+/)
    .filter(k => k.length >= 2)

  if (keywords.length === 0) return []

  const scored = faqs.map(faq => {
    const searchText = [
      faq.question,
      ...faq.questionAliases,
      faq.shortAnswer,
    ].join(' ').toLowerCase()

    let score = 0
    for (const kw of keywords) {
      if (searchText.includes(kw)) score += 10
      if (faq.question.toLowerCase().includes(kw)) score += 5  // 제목 매칭 가중치
    }
    score += faq.priority * 0.1  // 우선순위 가중치

    return { faq, score }
  })

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.faq)
}

// ─── 트리거 조건 평가기 ───────────────────────────────────────────────────

export interface TriggerEvalContext {
  selectedContractType?: string
  endDate?: string | null
  startDate?: string
  repeatedCount?: number
  workerSource?: 'DIRECT' | 'OUTSOURCED'
  expectedDurationDays?: number
  currentPage?: string
}

import type { TriggerCondition } from './types'

/**
 * FAQ 트리거 조건 평가.
 * 모든 조건이 충족되어야 true를 반환한다.
 */
export function evaluateTriggerConditions(
  conditions: TriggerCondition[],
  ctx: TriggerEvalContext,
): boolean {
  if (conditions.length === 0) return false

  return conditions.every(cond => {
    const ctxValue = getContextValue(cond.field, ctx)
    return evaluateSingleCondition(cond, ctxValue)
  })
}

function getContextValue(field: string, ctx: TriggerEvalContext): unknown {
  switch (field) {
    case 'selectedContractType':    return ctx.selectedContractType
    case 'endDate':                 return ctx.endDate
    case 'startDate':               return ctx.startDate
    case 'repeatedCount':           return ctx.repeatedCount
    case 'workerSource':            return ctx.workerSource
    case 'expectedDurationDays':    return ctx.expectedDurationDays
    default:                        return undefined
  }
}

function evaluateSingleCondition(cond: TriggerCondition, value: unknown): boolean {
  switch (cond.op) {
    case 'eq':        return value === cond.value
    case 'neq':       return value !== cond.value
    case 'exists':    return value !== undefined && value !== null && value !== ''
    case 'notExists': return value === undefined || value === null || value === ''
    case 'gte':       return typeof value === 'number' && typeof cond.value === 'number' && value >= cond.value
    case 'lte':       return typeof value === 'number' && typeof cond.value === 'number' && value <= cond.value
    case 'contains':  return typeof value === 'string' && typeof cond.value === 'string' && value.includes(cond.value)
    default:          return false
  }
}
