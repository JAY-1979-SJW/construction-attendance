/**
 * 협력사 정산 엔진
 */
import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'

export interface SubcontractorSettlementRunOptions {
  monthKey: string
  siteId?: string
  subcontractorId?: string
}

export async function runSubcontractorSettlement(opts: SubcontractorSettlementRunOptions): Promise<number> {
  const { monthKey, siteId, subcontractorId } = opts

  // 협력사 소속 근로자 확정 근무 조회
  const confirmations = await prisma.monthlyWorkConfirmation.findMany({
    where: {
      monthKey,
      confirmationStatus: 'CONFIRMED',
      confirmedWorkType: { not: 'INVALID' },
      worker: {
        organizationType: 'SUBCONTRACTOR',
        ...(subcontractorId ? { subcontractorId } : { subcontractorId: { not: null } }),
      },
      ...(siteId ? { siteId } : {}),
    },
    include: {
      worker: { select: { subcontractorId: true } },
    },
  })

  if (confirmations.length === 0) return 0

  // site × subcontractor 조합별 집계
  type Key = `${string}:${string}`
  const aggMap = new Map<Key, {
    siteId: string
    subcontractorId: string
    workerSet: Set<string>
    workUnits: number
    grossAmount: number
  }>()

  for (const c of confirmations) {
    const subId = c.worker.subcontractorId!
    const key: Key = `${c.siteId}:${subId}`
    if (!aggMap.has(key)) {
      aggMap.set(key, { siteId: c.siteId, subcontractorId: subId, workerSet: new Set(), workUnits: 0, grossAmount: 0 })
    }
    const agg = aggMap.get(key)!
    agg.workerSet.add(c.workerId)
    agg.workUnits += Number(c.confirmedWorkUnits)
    agg.grossAmount += c.confirmedTotalAmount
  }

  // 원천세 조회
  const workerIds = Array.from(new Set(confirmations.map(c => c.workerId)))
  const withholdingMap = new Map(
    (await prisma.withholdingCalculation.findMany({
      where: { monthKey, workerId: { in: workerIds } },
    })).map(w => [w.workerId, w.incomeTaxAmount + w.localIncomeTaxAmount])
  )

  // 퇴직공제 조회
  const retirementMap = new Map<Key, number>()
  const retirementSummaries = await prisma.retirementMutualMonthlySummary.findMany({
    where: { monthKey, workerId: { in: workerIds } },
    include: { worker: { select: { subcontractorId: true } } },
  })
  for (const r of retirementSummaries) {
    const subId = r.worker.subcontractorId
    if (!subId) continue
    const key: Key = `${r.siteId}:${subId}`
    retirementMap.set(key, (retirementMap.get(key) ?? 0) + r.recognizedWorkDays)
  }

  let created = 0
  for (const [key, agg] of Array.from(aggMap.entries())) {
    // 해당 조합 근로자 원천세 합계
    let taxAmount = 0
    for (const wid of Array.from(agg.workerSet)) {
      taxAmount += withholdingMap.get(wid) ?? 0
    }

    const retirementAmount = retirementMap.get(key) ?? 0
    const finalPayable = agg.grossAmount - taxAmount

    await prisma.subcontractorSettlement.upsert({
      where: {
        monthKey_siteId_subcontractorId: {
          monthKey,
          siteId: agg.siteId,
          subcontractorId: agg.subcontractorId,
        },
      },
      create: {
        monthKey,
        siteId: agg.siteId,
        subcontractorId: agg.subcontractorId,
        workerCount: agg.workerSet.size,
        confirmedWorkUnits: new Prisma.Decimal(agg.workUnits),
        grossAmount: agg.grossAmount,
        taxAmount,
        insuranceRelatedAmount: 0,
        retirementMutualAmount: retirementAmount,
        finalPayableAmount: finalPayable,
      },
      update: {
        workerCount: agg.workerSet.size,
        confirmedWorkUnits: new Prisma.Decimal(agg.workUnits),
        grossAmount: agg.grossAmount,
        taxAmount,
        retirementMutualAmount: retirementAmount,
        finalPayableAmount: finalPayable,
      },
    })
    created++
  }

  return created
}
