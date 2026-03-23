/**
 * 출퇴근 · 공수 운영 정책
 *
 * 이 파일은 "무엇이 기준인지"만 정의한다.
 * 계산 로직은 lib/labor/work-confirmations.ts, lib/jobs/autoCheckout.ts 등이 담당한다.
 *
 * 변경 시: 이 파일만 수정하면 출퇴근·공수 판정 전체에 반영된다.
 */

// ─── 공수 판정 임계값 (근로기준법 기반 고정값, 관리자 설정 불가) ───────────

/** 점심 차감 적용 임계값 (분): 경과 시간이 이 값 초과 시 점심 자동 차감 */
export const LUNCH_DEDUCTION_THRESHOLD_MIN = 240  // 4시간

/**
 * 점심 자동 차감 시간 (분) — 회사 기본값
 * 현장별 설정이 있으면 SiteAttendancePolicy.breakMinutes 가 우선 적용된다.
 * resolveEffectiveSiteAttendancePolicy(siteId) 를 통해 조회.
 */
export const LUNCH_DEDUCTION_MIN = 60  // 1시간

// ─── 회사 기본값 (현장 정책 미설정 시 fallback) ──────────────────────────────

/** 회사 기본 휴게시간 차감 (분) */
export const COMPANY_DEFAULT_BREAK_MINUTES = 60  // 1시간

/** 회사 기본 출근 기준 시각 (표시용, HH:mm) */
export const COMPANY_DEFAULT_WORK_START = '07:00'

/** 회사 기본 퇴근 기준 시각 (표시용, HH:mm) */
export const COMPANY_DEFAULT_WORK_END = '17:00'

/** 전일(1.0) 공수 인정 최소 실근로 시간 (분) */
export const FULL_DAY_MIN_EFFECTIVE_MIN = 480  // 8시간

/** 반일(0.5) 공수 인정 최소 실근로 시간 (분) */
export const HALF_DAY_MIN_EFFECTIVE_MIN = 240  // 4시간

// ─── 자동퇴근 ────────────────────────────────────────────────────────────────

/**
 * 자동퇴근 기준 시각 설명 (실제 crontab 스케줄은 .env 또는 crontab에서 설정)
 * - KST 04:00 = UTC 19:00
 * - 이 값은 로그/메모 문구에 사용한다. 실제 실행 시각은 서버 crontab이 결정한다.
 */
export const AUTO_CHECKOUT_KST_LABEL = '04:00 KST'

/** 자동퇴근 처리 시 adminNote 템플릿 */
export const AUTO_CHECKOUT_NOTE = (runAt: string) =>
  `[AUTO] ${AUTO_CHECKOUT_KST_LABEL} 자동 퇴근 미기록 처리. 실행시각: ${runAt}`

// ─── MISSING_CHECKOUT 처리 원칙 ──────────────────────────────────────────────

/** MISSING_CHECKOUT 상태는 공수 0으로 처리 (INVALID와 동일) */
export const MISSING_CHECKOUT_WORK_UNITS = 0

/** 공수 0 처리 대상 presenceStatus 목록 */
export const ZERO_WORK_PRESENCE_STATUSES: string[] = ['MISSING_CHECKOUT', 'INVALID']

// ─── 공수 최종값 우선순위 원칙 ───────────────────────────────────────────────

/**
 * workedMinutes 우선순위:
 *   1. workedMinutesRawFinal (크론·집계 최종값)
 *   2. workedMinutesOverride (관리자 수동 override)
 *   3. workedMinutesRaw (원본 기록값)
 *
 * 소비자는 아래 헬퍼를 사용한다:
 *   resolveFinalMinutes(day)
 */
export function resolveFinalMinutes(day: {
  workedMinutesRawFinal?: number | null
  workedMinutesOverride?: number | null
  workedMinutesRaw?: number | null
}): number | null {
  return day.workedMinutesRawFinal ?? day.workedMinutesOverride ?? day.workedMinutesRaw ?? null
}
