/**
 * 노무비 집계 엔진
 * monthly_work_confirmations + 보험/세금 데이터 기반으로 현장별/협력사별 집계
 */
import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'

export interface LaborCostRunOptions {
  monthKey: string
  siteId?: string
}

export async function runLaborCostSummary(opts: LaborCostRunOptions): Promise<number> {
  const { monthKey, siteId } = opts

  // 현장 목록
  const sites = siteId
    ? await prisma.site.findMany({ where: { id: siteId } })
    : await prisma.site.findMany({ where: { isActive: true } })

  let totalCreated = 0

  for (const site of sites) {
    // 확정 근무 집계 (직영/협력사별)
    const confirmations = await prisma.monthlyWorkConfirmation.findMany({
      where: {
        monthKey,
        siteId: site.id,
        confirmationStatus: 'CONFIRMED',
        confirmedWorkType: { not: 'INVALID' },
      },
      include: {
        worker: {
          select: {
            id: true,
            organizationType: true,
            subcontractorId: true,
          },
        },
      },
    })

    if (confirmations.length === 0) continue

    // 보험/세금 데이터 조회
    const workerIds = Array.from(new Set(confirmations.map((c) => c.worker.id)))

    const insuranceMap = new Map(
      (await prisma.insuranceEligibilitySnapshot.findMany({
        where: { monthKey, workerId: { in: workerIds } },
      })).map((i) => [i.workerId, i])
    )

    const withholdingMap = new Map(
      (await prisma.withholdingCalculation.findMany({
        where: { monthKey, workerId: { in: workerIds } },
      })).map((w) => [w.workerId, w])
    )

    const retirementMap = new Map(
      (await prisma.retirementMutualMonthlySummary.findMany({
        where: { monthKey, siteId: site.id, workerId: { in: workerIds } },
      })).map((r) => [r.workerId, r])
    )

    // 조직 구분별 집계
    type OrgKey = string  // `${organizationType}:${subcontractorId ?? ''}`
    const orgMap = new Map<OrgKey, {
      organizationType: 'DIRECT' | 'SUBCONTRACTOR'
      subcontractorId: string | null
      workerSet: Set<string>
      confirmedWorkUnits: number
      grossAmount: number
      taxableAmount: number
      withholdingTaxAmount: number
      npCount: Set<string>
      hiCount: Set<string>
      eiCount: Set<string>
      retirementDays: number
    }>()

    for (const conf of confirmations) {
      const orgType = conf.worker.organizationType as 'DIRECT' | 'SUBCONTRACTOR'
      const subId = conf.worker.subcontractorId ?? null
      const key = `${orgType}:${subId ?? ''}`

      if (!orgMap.has(key)) {
        orgMap.set(key, {
          organizationType: orgType,
          subcontractorId: subId,
          workerSet: new Set(),
          confirmedWorkUnits: 0,
          grossAmount: 0,
          taxableAmount: 0,
          withholdingTaxAmount: 0,
          npCount: new Set(),
          hiCount: new Set(),
          eiCount: new Set(),
          retirementDays: 0,
        })
      }

      const agg = orgMap.get(key)!
      agg.workerSet.add(conf.worker.id)
      agg.confirmedWorkUnits += Number(conf.confirmedWorkUnits)
      agg.grossAmount += conf.confirmedTotalAmount

      const withholding = withholdingMap.get(conf.worker.id)
      if (withholding) {
        agg.taxableAmount += withholding.grossAmount
        agg.withholdingTaxAmount += withholding.incomeTaxAmount + withholding.localIncomeTaxAmount
      }

      const insurance = insuranceMap.get(conf.worker.id)
      if (insurance) {
        if (insurance.nationalPensionEligible) agg.npCount.add(conf.worker.id)
        if (insurance.healthInsuranceEligible) agg.hiCount.add(conf.worker.id)
        if (insurance.employmentInsuranceEligible) agg.eiCount.add(conf.worker.id)
      }

      const retirement = retirementMap.get(conf.worker.id)
      if (retirement) {
        agg.retirementDays += retirement.recognizedWorkDays
      }
    }

    // 기존 집계 삭제 후 재생성
    await prisma.laborCostSummary.deleteMany({
      where: { monthKey, siteId: site.id },
    })

    for (const [, agg] of Array.from(orgMap.entries())) {
      await prisma.laborCostSummary.create({
        data: {
          monthKey,
          siteId: site.id,
          organizationType: agg.organizationType,
          subcontractorId: agg.subcontractorId,
          workerCount: agg.workerSet.size,
          confirmedWorkUnits: new Prisma.Decimal(agg.confirmedWorkUnits),
          grossAmount: agg.grossAmount,
          taxableAmount: agg.taxableAmount,
          withholdingTaxAmount: agg.withholdingTaxAmount,
          nationalPensionTargetCount: agg.npCount.size,
          healthInsuranceTargetCount: agg.hiCount.size,
          employmentInsuranceTargetCount: agg.eiCount.size,
          retirementMutualTargetDays: agg.retirementDays,
        },
      })
      totalCreated++
    }
  }

  return totalCreated
}
