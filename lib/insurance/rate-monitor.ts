/**
 * 보험요율 공식 고시 모니터링 서비스
 *
 * 원칙:
 *   - 자동 탐색: 주기적으로 공식 소스 확인
 *   - 자동 반영 금지: 변경 감지 후 관리자 검토 필요
 *   - 주기: 1~7월 주 1회, 8~12월 평일 1회
 *
 * 공식 소스:
 *   - 국민연금: 국민연금공단
 *   - 건강보험: 국민건강보험공단 (보건복지부 고시)
 *   - 장기요양보험: 국민건강보험공단 (보건복지부 고시)
 *   - 고용보험: 고용노동부 고시
 *   - 산재보험: 고용노동부 고시
 */

import type { InsuranceRateType } from '@prisma/client'

// ─── 공식 소스 기본 설정 ───────────────────────────────────

export interface RateSourceConfig {
  rateType:        InsuranceRateType
  sourceName:      string        // 공식 기관명
  sourceUrl:       string        // 모니터링 대상 URL
  announcingAgency: string       // 고시 담당 기관
  notes:           string
}

/**
 * 공식 소스 기본 설정 목록
 * DB의 InsuranceRateSource 초기화에 사용
 */
export const DEFAULT_RATE_SOURCES: RateSourceConfig[] = [
  {
    rateType:        'NATIONAL_PENSION',
    sourceName:      '국민연금공단',
    sourceUrl:       'https://www.nps.or.kr/jsppage/business/insure/insure_04_01.jsp',
    announcingAgency: '보건복지부',
    notes:           '국민연금 보험료율 (근로자 4.5%, 사업주 4.5%, 합산 9%). 매년 고시.',
  },
  {
    rateType:        'HEALTH_INSURANCE',
    sourceName:      '국민건강보험공단',
    sourceUrl:       'https://www.nhis.or.kr/nhis/policy/wbhada05300m01.do',
    announcingAgency: '보건복지부',
    notes:           '건강보험료율. 매년 1월 적용. 보건복지부 고시로 결정.',
  },
  {
    rateType:        'LONG_TERM_CARE',
    sourceName:      '국민건강보험공단',
    sourceUrl:       'https://www.nhis.or.kr/nhis/policy/wbhada05300m01.do',
    announcingAgency: '보건복지부',
    notes:           '장기요양보험료율 = 건강보험료 × 장기요양보험료율. 건강보험료와 함께 고시.',
  },
  {
    rateType:        'EMPLOYMENT_INSURANCE',
    sourceName:      '고용노동부',
    sourceUrl:       'https://www.moel.go.kr/policy/policyinfo/social/list5.do',
    announcingAgency: '고용노동부',
    notes:           '고용보험 실업급여 요율. 매년 고시. 근로자+사업주 각각 부담.',
  },
  {
    rateType:        'EMPLOYMENT_STABILITY',
    sourceName:      '고용노동부',
    sourceUrl:       'https://www.moel.go.kr/policy/policyinfo/social/list5.do',
    announcingAgency: '고용노동부',
    notes:           '고용안정·직업능력개발 요율. 사업주 전액 부담. 사업장 규모별 차등.',
  },
  {
    rateType:        'INDUSTRIAL_ACCIDENT',
    sourceName:      '고용노동부 (근로복지공단)',
    sourceUrl:       'https://www.kcomwel.or.kr/kcomwel/paym/paym01.jsp',
    announcingAgency: '고용노동부',
    notes:           '산재보험요율. 업종별 차등 적용. 사업주 전액 부담. 매년 3월 고시.',
  },
  {
    rateType:        'RETIREMENT_MUTUAL',
    sourceName:      '건설근로자공제회',
    sourceUrl:       'https://www.cwma.or.kr/main.do',
    announcingAgency: '고용노동부',
    notes:           '건설업 퇴직공제 부금. 일당 기준 사업주 납부. 고용노동부 고시.',
  },
]

// ─── 모니터링 주기 계산 ────────────────────────────────────

/**
 * 현재 날짜 기준 다음 확인 예정일 계산
 * - 1~7월: 주 1회 (매주 월요일)
 * - 8~12월: 평일 1회 (다음 영업일)
 */
export function getNextCheckDate(now: Date = new Date()): Date {
  const month = now.getMonth() + 1 // 1-12
  const next  = new Date(now)

  if (month >= 1 && month <= 7) {
    // 주 1회: 다음 월요일
    const daysUntilMonday = (8 - now.getDay()) % 7 || 7
    next.setDate(now.getDate() + daysUntilMonday)
  } else {
    // 평일 1회: 다음 평일
    next.setDate(now.getDate() + 1)
    while (next.getDay() === 0 || next.getDay() === 6) {
      next.setDate(next.getDate() + 1)
    }
  }

  next.setHours(9, 0, 0, 0)
  return next
}

/**
 * 현재 날짜에 모니터링을 실행해야 하는지 확인
 * lastCheckedAt이 없거나 다음 확인 예정일을 지났으면 true
 */
export function shouldCheckNow(
  lastCheckedAt: Date | null,
  now: Date = new Date(),
): boolean {
  if (!lastCheckedAt) return true
  const nextCheck = getNextCheckDate(lastCheckedAt)
  return now >= nextCheck
}

// ─── 변경 감지 메타데이터 ────────────────────────────────

export interface RateChangeDetectionResult {
  rateType:       InsuranceRateType
  detected:       boolean
  detectedAt:     Date
  sourceUrl:      string
  /** 변경이 감지된 경우 관리자 검토 요청 메시지 */
  reviewMessage?: string
  /** HTTP 상태코드 (접근 가능 여부 확인) */
  httpStatus?:    number
  error?:         string
}

/**
 * 고시 URL 접근 가능성 확인 (변경 감지 placeholder)
 *
 * 실제 크롤링 대신 URL 접근 가능 여부만 확인.
 * 실제 운영 시 담당자가 수동으로 요율 변경 여부를 확인하고
 * DB에 직접 등록하는 방식으로 사용.
 */
export async function checkRateSourceAccessibility(
  rateType: InsuranceRateType,
  sourceUrl: string,
): Promise<RateChangeDetectionResult> {
  const detectedAt = new Date()
  try {
    const controller = new AbortController()
    const timeout    = setTimeout(() => controller.abort(), 10_000)

    const res = await fetch(sourceUrl, {
      method:  'HEAD',
      signal:  controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RateMonitor/1.0)' },
    }).finally(() => clearTimeout(timeout))

    return {
      rateType,
      detected:    true,
      detectedAt,
      sourceUrl,
      httpStatus:  res.status,
      reviewMessage: res.ok
        ? `고시 소스(${sourceUrl}) 접근 정상. 관리자가 수동으로 요율 변경 여부를 확인하고 필요 시 신규 버전을 등록하세요.`
        : `고시 소스(${sourceUrl}) 응답 이상 (HTTP ${res.status}). 직접 접속하여 확인하세요.`,
    }
  } catch (err: any) {
    return {
      rateType,
      detected: false,
      detectedAt,
      sourceUrl,
      error: err?.message ?? '알 수 없는 오류',
      reviewMessage: `고시 소스 접근 실패: ${err?.message}. 직접 접속하여 확인하세요.`,
    }
  }
}
