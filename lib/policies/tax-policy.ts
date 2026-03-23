/**
 * 세금 계산 정책 (국세청 기준)
 *
 * 이 파일은 세율·공제·계산 공식의 "기준값"만 정의한다.
 * 실제 계산 로직은 lib/labor/tax.ts 가 담당한다.
 *
 * 변경 시: 이 파일만 수정하면 일용근로·사업소득·지방세 계산 전체에 반영된다.
 */

// ─── 일용근로소득 원천징수 (국세청 공식) ─────────────────────────────────────

/**
 * 일 비과세 공제액 (원)
 * 일급여 중 이 금액까지는 세금 부과 없음
 */
export const DAILY_WAGE_NONTAXABLE = 150_000

/**
 * 일용근로소득세 기본 세율
 * 과세표준(일급여 - 비과세) × 이 세율
 */
export const DAILY_WAGE_TAX_RATE = 0.06  // 6%

/**
 * 일용근로 세액공제율
 * 산출세액 × (1 - 이 값) = 원천징수세액
 */
export const DAILY_WAGE_CREDIT_RATE = 0.55  // 55%

/**
 * 지방소득세율
 * 소득세(원천징수세액) × 이 값
 */
export const LOCAL_TAX_RATE = 0.10  // 10%

// ─── 3.3% 사업소득 원천징수 ──────────────────────────────────────────────────

/**
 * 사업소득세 세율 (소득세 3% + 지방소득세 0.3% = 총 3.3%)
 * 소득세: 총액 × BUSINESS_INCOME_TAX_RATE
 * 지방세: 소득세 × LOCAL_TAX_RATE
 */
export const BUSINESS_INCOME_TAX_RATE = 0.03  // 3%

// ─── 계산 공식 코드 (formulaCode 스냅샷용) ───────────────────────────────────

export const FORMULA_CODE = {
  DAILY_WAGE:    'DAILY_WAGE_2024',
  BUSINESS_33:   'BUSINESS_33',
  SALARY_TABLE:  'SALARY_TABLE',  // 상용근로소득: 간이세액표 (추후 구현)
} as const
