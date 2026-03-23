/**
 * validate-contract.ts
 * 계약서 텍스트에 포함되어선 안 되는 위험 문구를 검출한다.
 * 계약 템플릿과 근로자 유형 불일치 감지도 담당한다.
 *
 * 운영 원칙 및 금지 문구 목록은 lib/policies/contract-policy.ts 에서 관리한다.
 * 유형 분류 규칙은 lib/policies/worker-type-policy.ts 에서 관리한다.
 *
 * 사용 위치:
 *   - generate-pdf/route.ts (DAILY_EMPLOYMENT 타입 한정)
 *   - generate-doc/route.ts (WORK_CONDITIONS_RECEIPT 케이스)
 *   - contracts/new 계약 생성 시 사전 경고
 */
import { DAILY_CONTRACT_FORBIDDEN_PATTERNS } from '@/lib/policies/contract-policy'
import {
  isTemplateMismatch,
  isDailyDocumentMixup,
  getEmploymentTypeLabel,
} from '@/lib/policies/worker-type-policy'

export interface DangerPhraseResult {
  hasDanger: boolean
  matches: { phrase: string; context: string }[]
}

/**
 * 일용직 계약서 렌더링 결과에서 위험 문구를 검출한다.
 * @param text 계약서 전체 텍스트 (title + sections + signatureBlock 합친 것)
 * @returns 검출 결과
 */
export function validateDailyContractDangerPhrases(text: string): DangerPhraseResult {
  const matches: { phrase: string; context: string }[] = []

  for (const pattern of DAILY_CONTRACT_FORBIDDEN_PATTERNS) {
    const match = text.match(pattern)
    if (match) {
      // 매칭 전후 30자를 context로 제공
      const idx = match.index ?? 0
      const start = Math.max(0, idx - 30)
      const end   = Math.min(text.length, idx + match[0].length + 30)
      matches.push({
        phrase:  match[0],
        context: `...${text.slice(start, end)}...`,
      })
    }
  }

  return { hasDanger: matches.length > 0, matches }
}

// ─── 계약 템플릿 / 근로자 유형 불일치 검증 ──────────────────────────────────

export interface TemplateMismatchResult {
  hasMismatch: boolean
  isDailyMixup: boolean  // 일용직 문서가 비일용 근로자에게 발급되려는 경우
  warning: string | null
}

/**
 * 계약 템플릿과 근로자 유형이 맞지 않는지 검증한다.
 *
 * @param templateType ContractTemplateType 값 (예: 'DAILY_EMPLOYMENT')
 * @param employmentType 근로자의 EmploymentType 값 (예: 'REGULAR')
 * @returns 불일치 감지 결과 + 경고 메시지
 */
export function validateTemplateMismatch(
  templateType: string,
  employmentType: string,
): TemplateMismatchResult {
  const mismatch = isTemplateMismatch(templateType, employmentType)
  const dailyMixup = isDailyDocumentMixup(templateType, employmentType)

  if (!mismatch) {
    return { hasMismatch: false, isDailyMixup: false, warning: null }
  }

  const workerLabel = getEmploymentTypeLabel(employmentType)
  const warning = dailyMixup
    ? `[문구 혼입 위험] 일용직 전용 계약서(${templateType})를 ${workerLabel} 근로자에게 발급하려 하고 있습니다. 비일용 계약 템플릿을 선택하세요.`
    : `[템플릿 불일치] ${templateType} 계약서는 ${workerLabel} 근로자에게 적합하지 않을 수 있습니다. 확인 후 진행하세요.`

  return { hasMismatch: true, isDailyMixup: dailyMixup, warning }
}

/**
 * 계약서 렌더링 결과 객체(RenderedContract)에서 전체 텍스트를 추출한다.
 */
export function extractContractText(rendered: {
  title?: string
  subtitle?: string
  sections: { title: string; content: string }[]
  signatureBlock?: string
}): string {
  const parts: string[] = []
  if (rendered.title)    parts.push(rendered.title)
  if (rendered.subtitle) parts.push(rendered.subtitle)
  for (const s of rendered.sections) {
    parts.push(s.title)
    parts.push(s.content)
  }
  if (rendered.signatureBlock) parts.push(rendered.signatureBlock)
  return parts.join('\n')
}
