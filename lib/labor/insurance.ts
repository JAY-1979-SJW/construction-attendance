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

const NP_MIN_DAYS         = 8          // 국민연금 최소 근무일
const NP_MIN_AMOUNT       = 2_200_000  // 국민연금 최소 소득 (220만원)
const HEALTH_MIN_MONTHS   = 1          // 건강보험: 1개월 미만 일용 제외

export interface InsuranceRunOptions {
  monthKey:  string  // 'YYYY-MM'
  workerId?: string
}

export interface InsuranceRunResult {
  processed: number
  created: number
  updated: number
  errors: number
}

export async function runInsuranceEligibility(opts: InsuranceRunOptions): Promise<InsuranceRunResult> {
  const { monthKey, workerId } = opts
  const result: InsuranceRunResult = { processed: 0, created: 0, updated: 0, errors: 0 }

  // 해당 월 CONFIRMED 근무확정 집계
  const rows = await prisma.monthlyWorkConfirmation.findMany({
    where: {
      monthKey,
      confirmationStatus: 'CONFIRMED',
      ...(workerId ? { workerId } : {}),
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
        npReason = '3.3% 사업소득 — 국민연금 별도 가입 대상 아님'
      } else if (isDaily) {
        if (agg.days >= NP_MIN_DAYS) {
          npEligible = true
          npReason = `건설일용 월 ${agg.days}일 ≥ ${NP_MIN_DAYS}일 → 사업장가입자`
        } else if (agg.amount >= NP_MIN_AMOUNT) {
          npEligible = true
          npReason = `건설일용 월 소득 ${agg.amount.toLocaleString()}원 ≥ 220만원 → 사업장가입자`
        } else {
          npEligible = false
          npReason = `건설일용 월 ${agg.days}일 < ${NP_MIN_DAYS}일 & 소득 < 220만원 → 지역가입자`
        }
      } else {
        // 상용
        npEligible = true
        npReason = '상용근로자 — 사업장가입자'
      }

      // ── 건강보험 판정 ─────────────────────────────────
      let hiEligible = false
      let hiReason   = ''
      if (isBusiness33) {
        hiEligible = false
        hiReason = '3.3% 사업소득 — 건강보험 별도'
      } else if (isDaily) {
        // 1개월 미만 일용 제외 → 월 단위 계약이면 1개월로 봄
        // 실무상: 해당 월에 출역이 있으면 1개월 고용 간주해서 제외 규정 적용 가능
        // 단순 판정: 일용이면 건강보험 제외
        hiEligible = false
        hiReason = `건설 일용근로자 — 고용기간 ${HEALTH_MIN_MONTHS}개월 미만 제외 대상`
      } else {
        hiEligible = true
        hiReason = '상용근로자 — 건강보험 적용'
      }

      // ── 고용보험 판정 ─────────────────────────────────
      let eiEligible = false
      let eiReason   = ''
      if (isBusiness33) {
        eiEligible = false
        eiReason = '3.3% 사업소득 — 고용보험 적용 안 됨'
      } else if (agg.days > 0) {
        eiEligible = true
        eiReason = isDaily
          ? `일용 근로내용확인신고 대상 (월 ${agg.days}일 근무)`
          : '상용근로자 — 고용보험 피보험자'
      }

      // ── 산재보험 판정 ─────────────────────────────────
      const iaEligible = !isBusiness33 && agg.days > 0
      const iaReason   = isBusiness33 ? '3.3% 사업소득 제외' : '건설업 당연적용'

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
