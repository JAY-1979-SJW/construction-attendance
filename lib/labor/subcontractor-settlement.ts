/**
 * 회사별 정산 엔진 (구 협력사 정산, Company 단일화 적용)
 */
import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'

export interface CompanySettlementRunOptions {
  monthKey: string
  siteId?: string
  companyId?: string
}

/** @deprecated Use CompanySettlementRunOptions */
export type SubcontractorSettlementRunOptions = CompanySettlementRunOptions

export async function runSubcontractorSettlement(opts: CompanySettlementRunOptions): Promise<number> {
  return runCompanySettlement(opts)
}

export async function runCompanySettlement(opts: CompanySettlementRunOptions): Promise<number> {
  const { monthKey, siteId, companyId } = opts

  // 확정 근무 조회 (협력사 소속 근로자)
  const confirmations = await prisma.monthlyWorkConfirmation.findMany({
    where: {
      monthKey,
      confirmationStatus: 'CONFIRMED',
      confirmedWorkType: { not: 'INVALID' },
      worker: { organizationType: 'SUBCONTRACTOR' },
      ...(siteId ? { siteId } : {}),
    },
    select: { workerId: true, siteId: true, confirmedWorkUnits: true, confirmedTotalAmount: true },
  })

  if (confirmations.length === 0) return 0

  // 근로자-현장별 회사 배정 조회 (WorkerSiteAssignment 기준)
  const workerIds = Array.from(new Set(confirmations.map(c => c.workerId)))
  const siteIds = Array.from(new Set(confirmations.map(c => c.siteId)))

  const siteAssignments = await prisma.workerSiteAssignment.findMany({
    where: {
      workerId: { in: workerIds },
      siteId: { in: siteIds },
      ...(companyId ? { companyId } : {}),
    },
    select: { workerId: true, siteId: true, companyId: true },
  })

  // 근로자+현장 → companyId 매핑
  const assignmentMap = new Map<string, string>()
  for (const a of siteAssignments) {
    assignmentMap.set(`${a.workerId}:${a.siteId}`, a.companyId)
  }

  // site × company 조합별 집계
  type Key = `${string}:${string}`
  const aggMap = new Map<Key, {
    siteId: string
    companyId: string
    workerSet: Set<string>
    workUnits: number
    grossAmount: number
  }>()

  for (const c of confirmations) {
    const cId = assignmentMap.get(`${c.workerId}:${c.siteId}`)
    if (!cId) continue  // 배정 없는 경우 skip

    const key: Key = `${c.siteId}:${cId}`
    if (!aggMap.has(key)) {
      aggMap.set(key, { siteId: c.siteId, companyId: cId, workerSet: new Set(), workUnits: 0, grossAmount: 0 })
    }
    const agg = aggMap.get(key)!
    agg.workerSet.add(c.workerId)
    agg.workUnits += Number(c.confirmedWorkUnits)
    agg.grossAmount += c.confirmedTotalAmount
  }

  if (aggMap.size === 0) return 0

  // 원천세 조회
  const withholdingMap = new Map(
    (await prisma.withholdingCalculation.findMany({
      where: { monthKey, workerId: { in: workerIds } },
    })).map(w => [w.workerId, w.incomeTaxAmount + w.localIncomeTaxAmount])
  )

  // 퇴직공제 조회
  const retirementMap = new Map<Key, number>()
  const retirementSummaries = await prisma.retirementMutualMonthlySummary.findMany({
    where: { monthKey, workerId: { in: workerIds } },
    select: { workerId: true, siteId: true, recognizedWorkDays: true },
  })
  for (const r of retirementSummaries) {
    const cId = assignmentMap.get(`${r.workerId}:${r.siteId}`)
    if (!cId) continue
    const key: Key = `${r.siteId}:${cId}`
    retirementMap.set(key, (retirementMap.get(key) ?? 0) + r.recognizedWorkDays)
  }

  let created = 0
  for (const [key, agg] of Array.from(aggMap.entries())) {
    let taxAmount = 0
    for (const wid of Array.from(agg.workerSet)) {
      taxAmount += withholdingMap.get(wid) ?? 0
    }

    const retirementAmount = retirementMap.get(key) ?? 0
    const finalPayable = agg.grossAmount - taxAmount

    await prisma.companySettlement.upsert({
      where: {
        monthKey_siteId_companyId: {
          monthKey,
          siteId: agg.siteId,
          companyId: agg.companyId,
        },
      },
      create: {
        monthKey,
        siteId: agg.siteId,
        companyId: agg.companyId,
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
