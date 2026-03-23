/**
 * 단위 테스트: validateDailyContractDangerPhrases + 정책 일관성
 *
 * 검증 항목:
 *   1. 금지 문구 포함 시 hasDanger = true
 *   2. 금지 문구 없으면 hasDanger = false
 *   3. DANGER_PHRASE_APPLICABLE_TEMPLATES 에 DAILY_EMPLOYMENT 만 포함
 *   4. extractContractText 가 전체 섹션 텍스트를 결합
 *   5. 위험 문구 기준이 UI(contract-policy) 와 검출 함수(validate-contract) 에서 동일 원천 사용
 */
import { describe, it, expect } from 'vitest'
import {
  validateDailyContractDangerPhrases,
  extractContractText,
} from '@/lib/contracts/validate-contract'
import {
  DAILY_CONTRACT_FORBIDDEN_PATTERNS,
  DANGER_PHRASE_APPLICABLE_TEMPLATES,
  DANGER_PHRASE_MODE,
  DANGER_PHRASE_UI,
} from '@/lib/policies/contract-policy'

// ─── 위험 문구 검출 ───────────────────────────────────────────

describe('validateDailyContractDangerPhrases', () => {

  it('금지 문구 "고용 보장" 포함 시 hasDanger = true', () => {
    const result = validateDailyContractDangerPhrases('갑은 을에게 고용 보장을 약속한다.')
    expect(result.hasDanger).toBe(true)
    expect(result.matches.length).toBeGreaterThan(0)
  })

  it('금지 문구 "정규직으로 전환" 포함 시 hasDanger = true', () => {
    const result = validateDailyContractDangerPhrases('근속 시 정규직으로 전환한다.')
    expect(result.hasDanger).toBe(true)
  })

  it('금지 문구 "무기계약으로 전환" 포함 시 hasDanger = true', () => {
    const result = validateDailyContractDangerPhrases('무기계약으로 전환될 수 있다.')
    expect(result.hasDanger).toBe(true)
  })

  it('금지 문구 "상시 근로" 포함 시 hasDanger = true', () => {
    const result = validateDailyContractDangerPhrases('상시 근로를 제공한다.')
    expect(result.hasDanger).toBe(true)
  })

  it('금지 문구 없는 일반 일용직 계약 텍스트 — hasDanger = false', () => {
    const text = `
      일용 근로계약서
      제1조 (근무장소) 서울시 강남구 테스트 현장
      제2조 (근로시간) 09:00 ~ 18:00
      제3조 (임금) 일당 200,000원
      제4조 (계약기간) 2026-01-01 ~ 2026-01-31
    `
    const result = validateDailyContractDangerPhrases(text)
    expect(result.hasDanger).toBe(false)
    expect(result.matches).toHaveLength(0)
  })

  it('matches 에 phrase 와 context 가 포함된다', () => {
    const result = validateDailyContractDangerPhrases('계속 고용을 보장한다는 내용입니다.')
    expect(result.matches[0]).toHaveProperty('phrase')
    expect(result.matches[0]).toHaveProperty('context')
  })

})

// ─── extractContractText ──────────────────────────────────────

describe('extractContractText', () => {

  it('title, subtitle, sections, signatureBlock 을 모두 결합한다', () => {
    const rendered = {
      title: '일용 근로계약서',
      subtitle: '2026년 1월',
      sections: [
        { title: '제1조', content: '근무장소 현장A' },
        { title: '제2조', content: '일당 200,000원' },
      ],
      signatureBlock: '근로자 서명: ___',
    }
    const text = extractContractText(rendered)
    expect(text).toContain('일용 근로계약서')
    expect(text).toContain('2026년 1월')
    expect(text).toContain('제1조')
    expect(text).toContain('근무장소 현장A')
    expect(text).toContain('제2조')
    expect(text).toContain('일당 200,000원')
    expect(text).toContain('근로자 서명: ___')
  })

  it('optional 필드 없어도 오류 없이 동작', () => {
    const rendered = {
      sections: [{ title: '제1조', content: '본문' }],
    }
    expect(() => extractContractText(rendered as never)).not.toThrow()
  })

})

// ─── 정책 일관성 검증 ─────────────────────────────────────────

describe('contract-policy — UI / validate / PDF / DOC 기준 일관성', () => {

  it('DANGER_PHRASE_APPLICABLE_TEMPLATES 에 DAILY_EMPLOYMENT 이 포함된다', () => {
    expect(DANGER_PHRASE_APPLICABLE_TEMPLATES).toContain('DAILY_EMPLOYMENT')
  })

  it('DANGER_PHRASE_MODE 는 ADVISORY 또는 BLOCKING 중 하나', () => {
    expect(['ADVISORY', 'BLOCKING']).toContain(DANGER_PHRASE_MODE)
  })

  it('validate-contract 이 contract-policy 의 DAILY_CONTRACT_FORBIDDEN_PATTERNS 를 사용한다', () => {
    // 같은 패턴 배열을 가져와서 수동 검사
    const text = '상시 고용을 유지한다.'
    const manual = DAILY_CONTRACT_FORBIDDEN_PATTERNS.some(p => p.test(text))
    const via    = validateDailyContractDangerPhrases(text).hasDanger
    expect(via).toBe(manual)
  })

  it('DANGER_PHRASE_UI 에 title, description, checklist 가 있다', () => {
    expect(DANGER_PHRASE_UI).toHaveProperty('title')
    expect(DANGER_PHRASE_UI).toHaveProperty('description')
    expect(DANGER_PHRASE_UI).toHaveProperty('checklist')
    expect(Array.isArray(DANGER_PHRASE_UI.checklist)).toBe(true)
  })

})
