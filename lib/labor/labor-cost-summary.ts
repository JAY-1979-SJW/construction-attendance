/**
 * 노무비 집계 엔진
 * monthly_work_confirmations + 보험/세금 데이터 기반으로 현장별/회사별 집계
 * Company 단일화 적용: subcontractorId → companyId (WorkerSiteAssignment 기준)
 */
import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'

export interface LaborCostRunOptions {
  monthKey: string
  siteId?: string
}

export async function runLaborCostSummary(opts: LaborCostRunOptions): Promise<number> {
  const { monthKey, siteId } = opts

  const sites = siteId
    ? await prisma.site.findMany({ where: { id: siteId } })
    : await prisma.site.findMany({ where: { isActive: true } })

  let totalCreated = 0

  for (const site of sites) {
    const confirmations = await prisma.monthlyWorkConfirmation.findMany({
      where: {
        monthKey,
        siteId: site.id,
        confirmationStatus: 'CONFIRMED',
        confirmedWorkType: { not: 'INVALID' },
      },
      include: {
        worker: {
          select: { id: true, organizationType: true },
        },
      },
    })

    if (confirmations.length === 0) continue

    const workerIds = Array.from(new Set(confirmations.map((c) => c.worker.id)))

    // 근로자-현장 배정에서 회사 정보 조회
    const siteAssignments = await prisma.workerSiteAssignment.findMany({
      where: { workerId: { in: workerIds }, siteId: site.id },
      select: { workerId: true, companyId: true },
    })
    const workerCompanyMap = new Map(siteAssignments.map(a => [a.workerId, a.companyId]))

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

    // 조직구분 + 회사별 집계
    type OrgKey = string  // `${organizationType}:${companyId ?? ''}`
    const orgMap = new Map<OrgKey, {
      organizationType: 'DIRECT' | 'SUBCONTRACTOR'
      companyId: string | null
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
      const cId = workerCompanyMap.get(conf.worker.id) ?? null
      const key = `${orgType}:${cId ?? ''}`

      if (!orgMap.has(key)) {
        orgMap.set(key, {
          organizationType: orgType,
          companyId: cId,
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

    await prisma.laborCostSummary.deleteMany({ where: { monthKey, siteId: site.id } })

    for (const [, agg] of Array.from(orgMap.entries())) {
      await prisma.laborCostSummary.create({
        data: {
          monthKey,
          siteId: site.id,
          organizationType: agg.organizationType,
          companyId: agg.companyId,
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
