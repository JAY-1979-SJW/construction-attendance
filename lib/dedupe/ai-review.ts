/**
 * AI 보조 검토 모듈
 *
 * REVIEW 건에 대해서만 사용.
 * 확정 규칙(전화번호 일치 등)은 절대 뒤집지 않음.
 * AI는 표기 차이/오타/띄어쓰기 차이 해석에만 사용.
 */
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export interface AiReviewInput {
  type: 'site' | 'worker'
  inputValue: {
    name: string
    address?: string
    phone?: string
    birthDate?: string
  }
  candidate: {
    name: string
    address?: string
    phone?: string
    birthDate?: string
  }
  reason: string
}

export interface AiReviewResult {
  decision: 'SAME' | 'DIFFERENT' | 'UNCERTAIN'
  confidence: number   // 0~1
  explanation: string
}

/** AI 보조 검토 수행 (REVIEW 건만 대상) */
export async function aiReview(input: AiReviewInput): Promise<AiReviewResult> {
  const systemPrompt = `당신은 건설 현장 관리 시스템의 데이터 중복 검토 보조입니다.
두 레코드가 동일한 대상인지 판단합니다.

판단 기준:
- 현장: 현장명 표기 차이(약어, 오타, 띄어쓰기), 주소 형식 차이 해석
- 근로자: 이름 표기 차이, 동명이인 가능성

응답 형식 (JSON만):
{"decision":"SAME|DIFFERENT|UNCERTAIN","confidence":0.0~1.0,"explanation":"판단 근거"}

주의:
- 전화번호 완전 일치 같은 확정 규칙은 판단 대상이 아닙니다
- 확실하지 않으면 UNCERTAIN으로 응답하세요
- confidence가 0.7 미만이면 UNCERTAIN을 권장합니다`

  const userPrompt = input.type === 'site'
    ? `## 입력 현장
이름: ${input.inputValue.name}
주소: ${input.inputValue.address ?? '없음'}

## 기존 현장 후보
이름: ${input.candidate.name}
주소: ${input.candidate.address ?? '없음'}

판정 사유: ${input.reason}

이 두 현장이 동일한 현장입니까?`
    : `## 입력 근로자
이름: ${input.inputValue.name}
생년월일: ${input.inputValue.birthDate ?? '없음'}

## 기존 근로자 후보
이름: ${input.candidate.name}
생년월일: ${input.candidate.birthDate ?? '없음'}

판정 사유: ${input.reason}

이 두 근로자가 동일인입니까?`

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return { decision: 'UNCERTAIN', confidence: 0, explanation: 'AI 응답 파싱 실패' }
    }

    const parsed = JSON.parse(jsonMatch[0])
    const decision = ['SAME', 'DIFFERENT', 'UNCERTAIN'].includes(parsed.decision)
      ? parsed.decision as AiReviewResult['decision']
      : 'UNCERTAIN'
    const confidence = typeof parsed.confidence === 'number'
      ? Math.min(1, Math.max(0, parsed.confidence))
      : 0

    return { decision, confidence, explanation: parsed.explanation ?? '' }
  } catch (err) {
    console.error('[ai-review] failed', err)
    return { decision: 'UNCERTAIN', confidence: 0, explanation: 'AI 호출 실패' }
  }
}

/** 여러 REVIEW 건을 일괄 AI 검토 (rate limit 고려) */
export async function aiReviewBatch(
  inputs: AiReviewInput[],
): Promise<AiReviewResult[]> {
  const results: AiReviewResult[] = []
  for (const input of inputs) {
    const result = await aiReview(input)
    results.push(result)
  }
  return results
}
