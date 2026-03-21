/**
 * 월별 노임/원천세 계산 엔진
 *
 * 일용근로소득 원천징수 공식 (국세청):
 *   과세표준 = 일급여 - 150,000원 (비과세 공제)
 *   산출세액 = 과세표준 × 6%
 *   원천징수세액 = 산출세액 × (1 - 55%) → 세액공제 55% 반영
 *   지방소득세 = 원천징수세액 × 10%
 *
 * 3.3% 사업소득:
 *   소득세 = 총액 × 3%
 *   지방소득세 = 소득세 × 10% (= 총액 × 0.3%)
 */
import { prisma } from '@/lib/db/prisma'
import { Decimal } from '@prisma/client/runtime/library'

const DAILY_WAGE_NONTAXABLE  = 150_000   // 일 15만원 비과세
const DAILY_WAGE_TAX_RATE    = 0.06      // 6%
const DAILY_WAGE_CREDIT_RATE = 0.55      // 세액공제 55%
const LOCAL_TAX_RATE         = 0.10      // 지방소득세 10%
const BUSINESS_33_RATE       = 0.03      // 사업소득세 3%

export interface TaxRunOptions {
  monthKey:  string
  workerId?: string
}

export interface TaxRunResult {
  processed: number
  created: number
  updated: number
  errors: number
}

/** 일용근로소득 원천징수 계산 */
function calcDailyWageTax(grossAmount: number, days: number): { incomeTax: number; localTax: number } {
  if (days <= 0 || grossAmount <= 0) return { incomeTax: 0, localTax: 0 }
  const dailyAvg = grossAmount / days
  const taxablePerDay = Math.max(0, dailyAvg - DAILY_WAGE_NONTAXABLE)
  const taxPerDay = taxablePerDay * DAILY_WAGE_TAX_RATE * (1 - DAILY_WAGE_CREDIT_RATE)
  const monthlyTax = Math.floor(taxPerDay * days)
  const localTax = Math.floor(monthlyTax * LOCAL_TAX_RATE)
  return { incomeTax: monthlyTax, localTax }
}

/** 3.3% 사업소득 원천징수 계산 */
function calcBusiness33Tax(grossAmount: number): { incomeTax: number; localTax: number } {
  const incomeTax = Math.floor(grossAmount * BUSINESS_33_RATE)
  const localTax  = Math.floor(incomeTax * LOCAL_TAX_RATE)
  return { incomeTax, localTax }
}

export async function runTaxCalculation(opts: TaxRunOptions): Promise<TaxRunResult> {
  const { monthKey, workerId } = opts
  const result: TaxRunResult = { processed: 0, created: 0, updated: 0, errors: 0 }

  const rows = await prisma.monthlyWorkConfirmation.findMany({
    where: {
      monthKey,
      confirmationStatus: 'CONFIRMED',
      ...(workerId ? { workerId } : {}),
    },
    include: { worker: true },
  })

  // worker 단위 집계
  const byWorker = new Map<string, {
    incomeType: string; employmentType: string
    days: number; halfDays: number
    overtimeMin: number; nightMin: number; holidayMin: number
    gross: number
  }>()

  for (const r of rows) {
    const key = r.workerId
    if (!byWorker.has(key)) {
      byWorker.set(key, {
        incomeType:     r.worker.incomeType,
        employmentType: r.worker.employmentType,
        days: 0, halfDays: 0,
        overtimeMin: 0, nightMin: 0, holidayMin: 0,
        gross: 0,
      })
    }
    const w = byWorker.get(key)!
    if (r.confirmedWorkType === 'INVALID') continue
    if (r.confirmedWorkType === 'HALF_DAY') w.halfDays += 0.5
    else w.days += 1

    w.gross += r.confirmedTotalAmount
  }

  for (const [wId, agg] of byWorker) {
    try {
      result.processed++
      const totalDays = agg.days + agg.halfDays
      const nonTaxable = agg.incomeType === 'DAILY_WAGE'
        ? Math.min(agg.gross, Math.floor(totalDays) * DAILY_WAGE_NONTAXABLE)
        : 0
      const taxable = Math.max(0, agg.gross - nonTaxable)

      // 세금 계산
      let formulaCode = 'UNKNOWN'
      let incomeTax = 0
      let localTax  = 0

      if (agg.incomeType === 'DAILY_WAGE') {
        formulaCode = 'DAILY_WAGE_2024'
        const t = calcDailyWageTax(agg.gross, Math.floor(totalDays))
        incomeTax = t.incomeTax
        localTax  = t.localTax
      } else if (agg.incomeType === 'BUSINESS_INCOME') {
        formulaCode = 'BUSINESS_33'
        const t = calcBusiness33Tax(agg.gross)
        incomeTax = t.incomeTax
        localTax  = t.localTax
      } else {
        formulaCode = 'SALARY_TABLE'
        // 상용근로소득: 간이세액표 적용 (이번 단계에서는 기본 구조만 저장)
        incomeTax = 0
        localTax  = 0
      }

      const snapshot = {
        monthKey, incomeType: agg.incomeType, employmentType: agg.employmentType,
        days: agg.days, halfDays: agg.halfDays, gross: agg.gross, nonTaxable, taxable,
        formulaCode, incomeTax, localTax,
      }

      // WageCalculation upsert
      const existingWage = await prisma.wageCalculation.findUnique({
        where: { workerId_monthKey: { workerId: wId, monthKey } },
      })

      let wageId: string
      if (existingWage) {
        await prisma.wageCalculation.update({
          where: { id: existingWage.id },
          data: {
            incomeType:              agg.incomeType as never,
            regularDays:             new Decimal(agg.days),
            halfDays:                new Decimal(agg.halfDays),
            grossAmount:             agg.gross,
            nonTaxableAmount:        nonTaxable,
            taxableAmount:           taxable,
            calculationSnapshotJson: snapshot,
          },
        })
        wageId = existingWage.id
        result.updated++
      } else {
        const created = await prisma.wageCalculation.create({
          data: {
            workerId:                wId,
            monthKey,
            incomeType:              agg.incomeType as never,
            regularDays:             new Decimal(agg.days),
            halfDays:                new Decimal(agg.halfDays),
            grossAmount:             agg.gross,
            nonTaxableAmount:        nonTaxable,
            taxableAmount:           taxable,
            calculationSnapshotJson: snapshot,
          },
        })
        wageId = created.id
        result.created++
      }

      // WithholdingCalculation upsert
      const existingWh = await prisma.withholdingCalculation.findUnique({
        where: { workerId_monthKey: { workerId: wId, monthKey } },
      })
      const whData = {
        incomeType:           agg.incomeType as never,
        grossAmount:          agg.gross,
        incomeTaxAmount:      incomeTax,
        localIncomeTaxAmount: localTax,
        formulaCode,
        formulaSnapshotJson:  snapshot,
        wageCalculationId:    wageId,
      }
      if (existingWh) {
        await prisma.withholdingCalculation.update({ where: { id: existingWh.id }, data: whData })
      } else {
        await prisma.withholdingCalculation.create({ data: { workerId: wId, monthKey, ...whData } })
      }
    } catch (err) {
      console.error('[tax] error', { workerId: wId, err })
      result.errors++
    }
  }

  console.info('[tax] run done', { monthKey, ...result })
  return result
}
