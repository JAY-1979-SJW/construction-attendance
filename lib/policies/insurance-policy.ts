/**
 * 4대보험 적용 판정 정책
 *
 * 이 파일은 보험 판정의 "기준값"만 정의한다.
 * 실제 판정 로직은 lib/labor/insurance.ts 가 담당한다.
 *
 * 변경 시: 이 파일만 수정하면 보험 판정 엔진 전체에 반영된다.
 */

// ─── 국민연금 (건설사업장 기준, 2025-07-01~) ─────────────────────────────────

/** 국민연금 사업장가입자 적용 최소 근무일 */
export const NP_MIN_DAYS = 8  // 월 8일 이상

/** 국민연금 사업장가입자 적용 최소 소득 (원) */
export const NP_MIN_AMOUNT = 2_200_000  // 월 220만원 이상

// ─── 건강보험 ────────────────────────────────────────────────────────────────

/**
 * 건강보험 적용 제외 기준: 고용기간 이 값 미만인 일용근로자는 제외
 * 단위: 개월
 */
export const HEALTH_MIN_MONTHS = 1  // 1개월 미만 일용 제외

// ─── 판정 사유 문구 (운영자 표시용) ──────────────────────────────────────────

export const INSURANCE_REASON = {
  NP: {
    BUSINESS_33:    '3.3% 사업소득 — 국민연금 별도 가입 대상 아님',
    DAILY_ELIGIBLE_DAYS: (days: number) => `건설일용 월 ${days}일 ≥ ${NP_MIN_DAYS}일 → 사업장가입자`,
    DAILY_ELIGIBLE_AMT:  (amount: number) => `건설일용 월 소득 ${amount.toLocaleString()}원 ≥ 220만원 → 사업장가입자`,
    DAILY_INELIGIBLE:    (days: number) => `건설일용 월 ${days}일 < ${NP_MIN_DAYS}일 & 소득 < 220만원 → 지역가입자`,
    REGULAR:        '상용근로자 — 사업장가입자',
  },
  HI: {
    BUSINESS_33:    '3.3% 사업소득 — 건강보험 별도',
    DAILY_EXEMPT:   `건설 일용근로자 — 고용기간 ${HEALTH_MIN_MONTHS}개월 미만 제외 대상`,
    REGULAR:        '상용근로자 — 건강보험 적용',
  },
  EI: {
    BUSINESS_33:    '3.3% 사업소득 — 고용보험 적용 안 됨',
    DAILY:          (days: number) => `일용 근로내용확인신고 대상 (월 ${days}일 근무)`,
    REGULAR:        '상용근로자 — 고용보험 피보험자',
  },
  IA: {
    BUSINESS_33:    '3.3% 사업소득 제외',
    CONSTRUCTION:   '건설업 당연적용',
  },
} as const
