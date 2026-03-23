/**
 * 단위 테스트: 현장별 근무시간·휴게시간 정책 + 공수 계산 연동
 *
 * 검증 항목:
 *   1. calcWorkUnits — breakMinutes 파라미터 적용 여부
 *   2. calcWorkUnits — 미제공 시 기본값(60분) fallback
 *   3. 현장별 breakMinutes 차이에 따른 공수 판정 분기
 *   4. ZERO_WORK_PRESENCE_STATUSES — breakMinutes 무관 INVALID 반환
 *   5. 경계값: 정확히 LUNCH_DEDUCTION_THRESHOLD_MIN(240분) 경과 시 차감 미적용
 *   6. 경계값: 240분 초과 시 차감 적용
 *   7. 회사 기본값 상수 확인
 */
import { describe, it, expect } from 'vitest'
import { calcWorkUnits } from '@/lib/labor/work-confirmations'
import {
  LUNCH_DEDUCTION_THRESHOLD_MIN,
  COMPANY_DEFAULT_BREAK_MINUTES,
  COMPANY_DEFAULT_WORK_START,
  COMPANY_DEFAULT_WORK_END,
  LUNCH_DEDUCTION_MIN,
} from '@/lib/policies/attendance-policy'

// ─── 1. 회사 기본값 상수 검증 ──────────────────────────────────────────

describe('attendance-policy — 회사 기본값 상수', () => {

  it('COMPANY_DEFAULT_BREAK_MINUTES 가 60 이어야 한다', () => {
    expect(COMPANY_DEFAULT_BREAK_MINUTES).toBe(60)
  })

  it('LUNCH_DEDUCTION_MIN 과 COMPANY_DEFAULT_BREAK_MINUTES 가 같아야 한다', () => {
    expect(COMPANY_DEFAULT_BREAK_MINUTES).toBe(LUNCH_DEDUCTION_MIN)
  })

  it('COMPANY_DEFAULT_WORK_START 가 HH:mm 형식이어야 한다', () => {
    expect(COMPANY_DEFAULT_WORK_START).toMatch(/^\d{2}:\d{2}$/)
  })

  it('COMPANY_DEFAULT_WORK_END 가 HH:mm 형식이어야 한다', () => {
    expect(COMPANY_DEFAULT_WORK_END).toMatch(/^\d{2}:\d{2}$/)
  })

  it('LUNCH_DEDUCTION_THRESHOLD_MIN 이 240(4시간)이어야 한다', () => {
    expect(LUNCH_DEDUCTION_THRESHOLD_MIN).toBe(240)
  })

})

// ─── 2. calcWorkUnits — breakMinutes 미제공 시 기본값 사용 ───────────────

describe('calcWorkUnits — breakMinutes 기본값 동작', () => {

  it('breakMinutes 미제공: 540분 → 60분 차감 → 480분 → FULL_DAY', () => {
    // 07:00~16:00 = 540분 경과 → 60분 차감 → 480분 = FULL_DAY
    const result = calcWorkUnits(540, 'PRESENT')
    expect(result.workType).toBe('FULL_DAY')
    expect(result.workUnits.toNumber()).toBe(1)
  })

  it('breakMinutes 미제공: 300분 → 60분 차감 → 240분 → HALF_DAY', () => {
    // 300분 경과 → 60분 차감 → 240분 = HALF_DAY 경계
    const result = calcWorkUnits(300, 'PRESENT')
    expect(result.workType).toBe('HALF_DAY')
    expect(result.workUnits.toNumber()).toBe(0.5)
  })

})

// ─── 3. calcWorkUnits — breakMinutes 명시 적용 ──────────────────────────

describe('calcWorkUnits — 현장별 breakMinutes 적용', () => {

  it('breakMinutes=30: 510분 → 30분 차감 → 480분 → FULL_DAY', () => {
    const result = calcWorkUnits(510, 'PRESENT', 30)
    expect(result.workType).toBe('FULL_DAY')
  })

  it('breakMinutes=90: 570분 → 90분 차감 → 480분 → FULL_DAY', () => {
    const result = calcWorkUnits(570, 'PRESENT', 90)
    expect(result.workType).toBe('FULL_DAY')
  })

  it('breakMinutes=90: 540분 → 90분 차감 → 450분 → HALF_DAY', () => {
    // 60분 기본값으로는 FULL_DAY였지만, 90분 현장에서는 HALF_DAY
    const result = calcWorkUnits(540, 'PRESENT', 90)
    expect(result.workType).toBe('HALF_DAY')
    expect(result.workUnits.toNumber()).toBe(0.5)
  })

  it('breakMinutes=30: 540분 → 30분 차감 → 510분 → FULL_DAY', () => {
    // 60분 기본값과 동일하게 FULL_DAY
    const result = calcWorkUnits(540, 'PRESENT', 30)
    expect(result.workType).toBe('FULL_DAY')
  })

  it('breakMinutes=0: 480분 → 0분 차감 → 480분 → FULL_DAY', () => {
    // 차감 없음 — 480분 그대로 FULL_DAY
    const result = calcWorkUnits(480, 'PRESENT', 0)
    expect(result.workType).toBe('FULL_DAY')
  })

})

// ─── 4. 경계값: 차감 임계값 정확히 240분 ─────────────────────────────────

describe('calcWorkUnits — 차감 임계값 경계값', () => {

  it('workedMinutes=240: 임계값 이하 → 차감 없음 → 240분 → HALF_DAY', () => {
    // 240분은 threshold(240)을 초과하지 않으므로 차감 없음
    const result = calcWorkUnits(240, 'PRESENT', 60)
    expect(result.workType).toBe('HALF_DAY')
  })

  it('workedMinutes=241: 임계값 초과 → 차감 적용 → 241-60=181분 → INVALID', () => {
    // 241분에서 60분 차감 → 181분 → 4시간(240분) 미만 → INVALID
    const result = calcWorkUnits(241, 'PRESENT', 60)
    expect(result.workType).toBe('INVALID')
  })

  it('workedMinutes=300: 임계값 초과 → 60분 차감 → 240분 → HALF_DAY 경계', () => {
    const result = calcWorkUnits(300, 'PRESENT', 60)
    expect(result.workType).toBe('HALF_DAY')
  })

})

// ─── 5. ZERO_WORK 상태: breakMinutes 무관 INVALID ─────────────────────

describe('calcWorkUnits — ZERO_WORK presenceStatus', () => {

  it('MISSING_CHECKOUT: breakMinutes 제공해도 INVALID', () => {
    const result = calcWorkUnits(540, 'MISSING_CHECKOUT', 30)
    expect(result.workType).toBe('INVALID')
    expect(result.workUnits.toNumber()).toBe(0)
  })

  it('INVALID status: breakMinutes 제공해도 INVALID', () => {
    const result = calcWorkUnits(540, 'INVALID', 0)
    expect(result.workType).toBe('INVALID')
    expect(result.workUnits.toNumber()).toBe(0)
  })

  it('null workedMinutes: INVALID', () => {
    const result = calcWorkUnits(null, 'PRESENT', 60)
    expect(result.workType).toBe('INVALID')
    expect(result.workUnits.toNumber()).toBe(0)
  })

})

// ─── 6. 시나리오: 현장별 공수 판정 차이 ──────────────────────────────────

describe('시나리오 — 현장별 breakMinutes 차이', () => {

  // 07:00~15:30 = 510분 경과
  const workedMinutes = 510

  it('breakMinutes=30(단축 현장): 510 - 30 = 480분 → FULL_DAY', () => {
    expect(calcWorkUnits(workedMinutes, 'PRESENT', 30).workType).toBe('FULL_DAY')
  })

  it('breakMinutes=60(회사 기본): 510 - 60 = 450분 → HALF_DAY', () => {
    expect(calcWorkUnits(workedMinutes, 'PRESENT', 60).workType).toBe('HALF_DAY')
  })

  it('breakMinutes=90(장시간 현장): 510 - 90 = 420분 → HALF_DAY', () => {
    expect(calcWorkUnits(workedMinutes, 'PRESENT', 90).workType).toBe('HALF_DAY')
  })

})
