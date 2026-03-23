/**
 * 월별 4대보험 적용 판정 엔진
 *
 * 기준:
 * - 국민연금: 건설사업장 기준 월 8일 이상 OR 월 소득 220만원 이상 → 사업장가입자 적용 (2025-07-01~)
 * - 건강보험: 고용기간 1개월 미만 일용근로자 적용 제외
 * - 고용보험: 일용근로자 근로내용확인신고 대상 여부 판정
 * - 산재보험: 건설업 일용 모두 기본 포함
 */
import { prisma } from '@/lib/db/prisma'
import {
  NP_MIN_DAYS,
  NP_MIN_AMOUNT,
  INSURANCE_REASON,
} from '@/lib/policies/insurance-policy'

export interface InsuranceRunOptions {
  monthKey:   string    // 'YYYY-MM'
  workerId?:  string
  workerIds?: string[]
}

export interface InsuranceRunResult {
  processed: number
  created: number
  updated: number
  errors: number
}

export async function runInsuranceEligibility(opts: InsuranceRunOptions): Promise<InsuranceRunResult> {
  const { monthKey, workerId, workerIds } = opts
  const result: InsuranceRunResult = { processed: 0, created: 0, updated: 0, errors: 0 }

  // workerIds 배열 우선, 단일 workerId 폴백
  const workerFilter = workerIds && workerIds.length > 0
    ? { workerId: { in: workerIds } }
    : workerId
      ? { workerId }
      : {}

  // 해당 월 CONFIRMED 근무확정 집계
  const rows = await prisma.monthlyWorkConfirmation.findMany({
    where: {
      monthKey,
      confirmationStatus: 'CONFIRMED',
      ...workerFilter,
    },
    include: { worker: true },
  })

  // worker 단위로 집계
  const byWorker = new Map<string, { days: number; amount: number; employmentType: string; incomeType: string; contracts: string[] }>()
  for (const r of rows) {
    const key = r.workerId
    if (!byWorker.has(key)) {
      byWorker.set(key, {
        days: 0, amount: 0,
        employmentType: r.worker.employmentType,
        incomeType: r.worker.incomeType,
        contracts: [],
      })
    }
    const w = byWorker.get(key)!
    w.days   += r.confirmedWorkType === 'INVALID' ? 0 : 1
    w.amount += r.confirmedTotalAmount
  }

  for (const [wId, agg] of Array.from(byWorker.entries())) {
    try {
      result.processed++
      const snapshot = { monthKey, days: agg.days, amount: agg.amount, employmentType: agg.employmentType, incomeType: agg.incomeType }
      const isDaily = agg.employmentType === 'DAILY_CONSTRUCTION'
      const isBusiness33 = agg.employmentType === 'BUSINESS_33'

      // ── 국민연금 판정 ─────────────────────────────────
      let npEligible = false
      let npReason   = ''
      if (isBusiness33) {
        npEligible = false
        npReason = INSURANCE_REASON.NP.BUSINESS_33
      } else if (isDaily) {
        if (agg.days >= NP_MIN_DAYS) {
          npEligible = true
          npReason = INSURANCE_REASON.NP.DAILY_ELIGIBLE_DAYS(agg.days)
        } else if (agg.amount >= NP_MIN_AMOUNT) {
          npEligible = true
          npReason = INSURANCE_REASON.NP.DAILY_ELIGIBLE_AMT(agg.amount)
        } else {
          npEligible = false
          npReason = INSURANCE_REASON.NP.DAILY_INELIGIBLE(agg.days)
        }
      } else {
        npEligible = true
        npReason = INSURANCE_REASON.NP.REGULAR
      }

      // ── 건강보험 판정 ─────────────────────────────────
      let hiEligible = false
      let hiReason   = ''
      if (isBusiness33) {
        hiEligible = false
        hiReason = INSURANCE_REASON.HI.BUSINESS_33
      } else if (isDaily) {
        hiEligible = false
        hiReason = INSURANCE_REASON.HI.DAILY_EXEMPT
      } else {
        hiEligible = true
        hiReason = INSURANCE_REASON.HI.REGULAR
      }

      // ── 고용보험 판정 ─────────────────────────────────
      let eiEligible = false
      let eiReason   = ''
      if (isBusiness33) {
        eiEligible = false
        eiReason = INSURANCE_REASON.EI.BUSINESS_33
      } else if (agg.days > 0) {
        eiEligible = true
        eiReason = isDaily
          ? INSURANCE_REASON.EI.DAILY(agg.days)
          : INSURANCE_REASON.EI.REGULAR
      }

      // ── 산재보험 판정 ─────────────────────────────────
      const iaEligible = !isBusiness33 && agg.days > 0
      const iaReason   = isBusiness33 ? INSURANCE_REASON.IA.BUSINESS_33 : INSURANCE_REASON.IA.CONSTRUCTION

      // upsert
      const existing = await prisma.insuranceEligibilitySnapshot.findUnique({
        where: { workerId_monthKey: { workerId: wId, monthKey } },
      })

      const data = {
        totalWorkDays:               agg.days,
        totalConfirmedAmount:        agg.amount,
        nationalPensionEligible:     npEligible,
        nationalPensionReason:       npReason,
        healthInsuranceEligible:     hiEligible,
        healthInsuranceReason:       hiReason,
        employmentInsuranceEligible: eiEligible,
        employmentInsuranceReason:   eiReason,
        industrialAccidentEligible:  iaEligible,
        industrialAccidentReason:    iaReason,
        calculationSnapshotJson:     snapshot,
      }

      if (existing) {
        await prisma.insuranceEligibilitySnapshot.update({ where: { id: existing.id }, data })
        result.updated++
      } else {
        await prisma.insuranceEligibilitySnapshot.create({ data: { workerId: wId, monthKey, ...data } })
        result.created++
      }
    } catch (err) {
      console.error('[insurance] error', { workerId: wId, err })
      result.errors++
    }
  }

  console.info('[insurance] run done', { monthKey, ...result })
  return result
}
