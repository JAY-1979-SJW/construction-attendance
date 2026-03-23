/**
 * validate-contract.ts
 * 계약서 텍스트에 포함되어선 안 되는 위험 문구를 검출한다.
 *
 * 운영 원칙: 일용직 계약서에 "계속 고용 보장", "상시 근로", "정규직", "무기계약" 등의
 * 표현이 포함되면 근로관계의 법적 해석이 달라질 수 있으므로 반드시 사전에 검출한다.
 *
 * 사용 위치:
 *   - generate-pdf/route.ts (DAILY_EMPLOYMENT 타입 한정)
 *   - generate-doc/route.ts (WORK_CONDITIONS_RECEIPT 케이스)
 *   - 운영자 수동 검수 체크리스트 (DAILY_WORKER_DOCUMENTS_OPERATIONS_CHECKLIST)
 */

export interface DangerPhraseResult {
  hasDanger: boolean
  matches: { phrase: string; context: string }[]
}

/**
 * 일용직 계약서에서 사용 금지된 문구 목록 (근로관계 오해 방지)
 *
 * 근거: 일용직 계약서 운영 체크리스트 D-4항 (docs/DAILY_WORKER_DOCUMENTS_OPERATIONS_CHECKLIST_2026-03-23.md)
 */
const DAILY_CONTRACT_FORBIDDEN_PHRASES: RegExp[] = [
  // "계속 고용"을 보장하는 표현
  /계속\s*고용\s*(을\s*)?보장/,
  /고용\s*보장/,
  /계속적\s*(으로\s*)?고용/,

  // "상시 근로" 표현
  /상시\s*(근로|고용|채용)/,

  // "무기계약" / "정규직" 표현
  /무기\s*계약\s*(으로\s*)?전환/,
  /정규직\s*(으로\s*)?전환/,
  /무기\s*근로자/,

  // 월급제 또는 고정급 표현이 일용직 계약서에 포함된 경우
  /기본급\s*\d[\d,]*\s*원/,   // "기본급 XXX원" — 일용직에 기본급 표현 금지
]

/**
 * 일용직 계약서 렌더링 결과에서 위험 문구를 검출한다.
 * @param text 계약서 전체 텍스트 (title + sections + signatureBlock 합친 것)
 * @returns 검출 결과
 */
export function validateDailyContractDangerPhrases(text: string): DangerPhraseResult {
  const matches: { phrase: string; context: string }[] = []

  for (const pattern of DAILY_CONTRACT_FORBIDDEN_PHRASES) {
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
