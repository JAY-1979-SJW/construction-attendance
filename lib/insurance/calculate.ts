/**
 * 보험요율 계산 서비스
 *
 * 원칙:
 *   - 계산 시 기준일의 APPROVED_FOR_USE 요율만 사용
 *   - 과거 기준일 재계산 가능 (effectiveYear/Month 기반)
 *   - 보험 종류별 독립 계산
 *   - 하드코딩 금지 — 항상 DB 요율 조회
 */

import { prisma } from '@/lib/db/prisma'
import type { InsuranceRateType, InsuranceRateVersionStatus } from '@prisma/client'

// ─── 타입 정의 ─────────────────────────────────────────────

export interface InsuranceRateInfo {
  rateType: InsuranceRateType
  effectiveYear: number
  effectiveMonth: number | null
  totalRatePct: number | null
  employeeRatePct: number | null
  employerRatePct: number | null
  rateNote: string | null
  industryCode: string | null
  officialSourceName: string | null
  versionId: string
  approvedAt: Date | null
}

export interface InsuranceCalculationResult {
  /** 과세표준 / 월급여 (원) */
  baseAmount: number
  /** 근로자 부담금 (원, 소수점 이하 절사) */
  employeeAmount: number
  /** 사업주 부담금 (원) */
  employerAmount: number
  /** 합산 금액 (원) */
  totalAmount: number
  /** 적용된 요율 버전 ID */
  versionId: string
  /** 적용된 근로자 요율 (%) */
  employeeRatePct: number
  /** 적용된 사업주 요율 (%) */
  employerRatePct: number
  /** 계산 기준일 */
  calculatedForDate: Date
}

export interface AllInsuranceCalculationResult {
  nationalPension: InsuranceCalculationResult | null
  healthInsurance: InsuranceCalculationResult | null
  longTermCare: InsuranceCalculationResult | null
  employmentInsurance: InsuranceCalculationResult | null
  employmentStability: InsuranceCalculationResult | null
  industrialAccident: InsuranceCalculationResult | null
  /** 계산 불가 항목 (요율 미등록) */
  unavailable: InsuranceRateType[]
  /** 계산 기준일 */
  calculatedForDate: Date
}

// ─── 핵심: 기준일 기반 유효 요율 조회 ────────────────────────

/**
 * 기준일에 적용 가능한 APPROVED_FOR_USE 요율 조회
 *
 * 조회 우선순위:
 *   1. 해당 연·월이 일치하는 요율 (월별 요율 변경 대응)
 *   2. 해당 연도의 연간 요율 (effectiveMonth = null)
 *   3. 이전 연도 중 가장 최근 연간 요율 (fallback)
 */
export async function getEffectiveRate(
  rateType: InsuranceRateType,
  referenceDate: Date,
  industryCode?: string,
): Promise<InsuranceRateInfo | null> {
  const year  = referenceDate.getFullYear()
  const month = referenceDate.getMonth() + 1 // 1-12

  // 1. 해당 연·월 월별 요율
  const monthlyRate = await prisma.insuranceRateVersion.findFirst({
    where: {
      rateType,
      effectiveYear:  year,
      effectiveMonth: month,
      status:         'APPROVED_FOR_USE' as InsuranceRateVersionStatus,
      ...(industryCode ? { industryCode } : {}),
    },
    orderBy: { approvedAt: 'desc' },
  })
  if (monthlyRate) return toRateInfo(monthlyRate)

  // 2. 해당 연도 연간 요율 (effectiveMonth = null)
  const yearlyRate = await prisma.insuranceRateVersion.findFirst({
    where: {
      rateType,
      effectiveYear:  year,
      effectiveMonth: null,
      status:         'APPROVED_FOR_USE' as InsuranceRateVersionStatus,
      ...(industryCode ? { industryCode } : {}),
    },
    orderBy: { approvedAt: 'desc' },
  })
  if (yearlyRate) return toRateInfo(yearlyRate)

  // 3. 이전 연도 fallback (가장 최근 승인 요율)
  const fallbackRate = await prisma.insuranceRateVersion.findFirst({
    where: {
      rateType,
      effectiveYear:  { lte: year },
      effectiveMonth: null,
      status:         'APPROVED_FOR_USE' as InsuranceRateVersionStatus,
      ...(industryCode ? { industryCode } : {}),
    },
    orderBy: [{ effectiveYear: 'desc' }, { approvedAt: 'desc' }],
  })
  return fallbackRate ? toRateInfo(fallbackRate) : null
}

function toRateInfo(v: {
  id: string
  rateType: InsuranceRateType
  effectiveYear: number
  effectiveMonth: number | null
  totalRatePct: any
  employeeRatePct: any
  employerRatePct: any
  rateNote: string | null
  industryCode: string | null
  officialSourceName: string | null
  approvedAt: Date | null
}): InsuranceRateInfo {
  return {
    rateType:          v.rateType,
    effectiveYear:     v.effectiveYear,
    effectiveMonth:    v.effectiveMonth,
    totalRatePct:      v.totalRatePct != null ? Number(v.totalRatePct) : null,
    employeeRatePct:   v.employeeRatePct != null ? Number(v.employeeRatePct) : null,
    employerRatePct:   v.employerRatePct != null ? Number(v.employerRatePct) : null,
    rateNote:          v.rateNote,
    industryCode:      v.industryCode,
    officialSourceName: v.officialSourceName,
    versionId:         v.id,
    approvedAt:        v.approvedAt,
  }
}

// ─── 단일 보험 계산 ────────────────────────────────────────

/**
 * 단일 보험 종류에 대한 금액 계산
 *
 * @param rateType      보험 종류
 * @param baseAmount    과세표준 / 월급여 (원)
 * @param referenceDate 기준일
 * @param industryCode  업종코드 (산재보험 전용)
 * @returns 계산 결과 (요율 미등록 시 null)
 */
export async function calculateInsurance(
  rateType: InsuranceRateType,
  baseAmount: number,
  referenceDate: Date,
  industryCode?: string,
): Promise<InsuranceCalculationResult | null> {
  const rate = await getEffectiveRate(rateType, referenceDate, industryCode)
  if (!rate) return null
  if (rate.employeeRatePct == null || rate.employerRatePct == null) return null

  const employeeAmount = Math.floor(baseAmount * rate.employeeRatePct / 100)
  const employerAmount = Math.floor(baseAmount * rate.employerRatePct / 100)

  return {
    baseAmount,
    employeeAmount,
    employerAmount,
    totalAmount:      employeeAmount + employerAmount,
    versionId:        rate.versionId,
    employeeRatePct:  rate.employeeRatePct,
    employerRatePct:  rate.employerRatePct,
    calculatedForDate: referenceDate,
  }
}

// ─── 4대보험 일괄 계산 ─────────────────────────────────────

/**
 * 4대보험 전체 일괄 계산
 *
 * @param monthlyWage   월급여 (원)
 * @param referenceDate 기준일
 * @param industryCode  업종코드 (산재보험 전용, 없으면 기본 요율)
 */
export async function calculateAllInsurances(
  monthlyWage: number,
  referenceDate: Date,
  industryCode?: string,
): Promise<AllInsuranceCalculationResult> {
  const [np, hi, ltc, ei, es, ia] = await Promise.all([
    calculateInsurance('NATIONAL_PENSION',     monthlyWage, referenceDate),
    calculateInsurance('HEALTH_INSURANCE',     monthlyWage, referenceDate),
    calculateInsurance('LONG_TERM_CARE',       monthlyWage, referenceDate),
    calculateInsurance('EMPLOYMENT_INSURANCE', monthlyWage, referenceDate),
    calculateInsurance('EMPLOYMENT_STABILITY', monthlyWage, referenceDate),
    calculateInsurance('INDUSTRIAL_ACCIDENT',  monthlyWage, referenceDate, industryCode),
  ])

  const unavailable: InsuranceRateType[] = []
  if (!np)  unavailable.push('NATIONAL_PENSION')
  if (!hi)  unavailable.push('HEALTH_INSURANCE')
  if (!ltc) unavailable.push('LONG_TERM_CARE')
  if (!ei)  unavailable.push('EMPLOYMENT_INSURANCE')
  if (!es)  unavailable.push('EMPLOYMENT_STABILITY')
  if (!ia)  unavailable.push('INDUSTRIAL_ACCIDENT')

  return {
    nationalPension:     np,
    healthInsurance:     hi,
    longTermCare:        ltc,
    employmentInsurance: ei,
    employmentStability: es,
    industrialAccident:  ia,
    unavailable,
    calculatedForDate:   referenceDate,
  }
}

// ─── 일용근로자 계산 (건설업 특화) ────────────────────────

export interface DailyWorkerInsuranceResult {
  /** 일급 (원) */
  dailyWage: number
  /** 고용보험 (근로자 부담) */
  employmentInsurance: { employeeAmount: number; employerAmount: number; versionId: string } | null
  /** 산재보험 (사업주 전액 부담) */
  industrialAccident: { employerAmount: number; versionId: string } | null
  /** 건강보험 — 일용근로자 적용 제외 (정책) */
  healthInsuranceNote: '일용근로자 적용 제외 (단기 고용)'
  /** 국민연금 — 1개월 미만 일용 제외 (정책) */
  nationalPensionNote: '1개월 미만 일용 근로자 적용 제외'
  calculatedForDate: Date
}

/**
 * 건설업 일용근로자 보험 계산
 * - 고용보험: 적용 (근로자+사업주)
 * - 산재보험: 적용 (사업주 전액)
 * - 건강보험/국민연금: 1개월 미만 일용 → 적용 제외
 */
export async function calculateDailyWorkerInsurance(
  dailyWage: number,
  referenceDate: Date,
  industryCode?: string,
): Promise<DailyWorkerInsuranceResult> {
  const [eiRate, iaRate] = await Promise.all([
    getEffectiveRate('EMPLOYMENT_INSURANCE', referenceDate),
    getEffectiveRate('INDUSTRIAL_ACCIDENT',  referenceDate, industryCode),
  ])

  const ei = eiRate && eiRate.employeeRatePct != null && eiRate.employerRatePct != null
    ? {
        employeeAmount: Math.floor(dailyWage * eiRate.employeeRatePct / 100),
        employerAmount: Math.floor(dailyWage * eiRate.employerRatePct / 100),
        versionId: eiRate.versionId,
      }
    : null

  const ia = iaRate && iaRate.employerRatePct != null
    ? {
        employerAmount: Math.floor(dailyWage * iaRate.employerRatePct / 100),
        versionId: iaRate.versionId,
      }
    : null

  return {
    dailyWage,
    employmentInsurance: ei,
    industrialAccident:  ia,
    healthInsuranceNote: '일용근로자 적용 제외 (단기 고용)',
    nationalPensionNote: '1개월 미만 일용 근로자 적용 제외',
    calculatedForDate:   referenceDate,
  }
}
