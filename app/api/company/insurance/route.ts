import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { requireCompanyAdmin } from '@/lib/auth/guards'
import { ok, unauthorized, forbidden, badRequest, internalError } from '@/lib/utils/response'
import { requireFeature } from '@/lib/feature-flags'

/**
 * GET /api/company/insurance?monthKey=YYYY-MM
 * 업체 관리자용 4대보험 판정 현황 조회
 * feature flag: insuranceDocsEnabled
 */
export async function GET(request: NextRequest) {
  try {
    let session
    try {
      session = await requireCompanyAdmin()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : ''
      if (msg === 'UNAUTHORIZED') return unauthorized()
      if (msg === 'FORBIDDEN') return forbidden()
      throw e
    }

    const flagGuard = await requireFeature(session.companyId, 'insuranceDocsEnabled')
    if (flagGuard) return flagGuard

    const { searchParams } = new URL(request.url)
    const monthKey = searchParams.get('monthKey')
    if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
      return badRequest('monthKey 파라미터가 필요합니다. (형식: YYYY-MM)')
    }

    // 이 업체 소속 근로자 ID 목록
    const assignments = await prisma.workerCompanyAssignment.findMany({
      where: { companyId: session.companyId, validTo: null },
      select: { workerId: true },
    })
    const workerIds = assignments.map(a => a.workerId)

    if (workerIds.length === 0) {
      return ok({ items: [], summary: { total: 0, npEligible: 0, hiEligible: 0, eiEligible: 0, iaEligible: 0, noSnapshot: 0 }, monthKey })
    }

    // 보험 판정 스냅샷
    const snapshots = await prisma.insuranceEligibilitySnapshot.findMany({
      where: { workerId: { in: workerIds }, monthKey },
      include: {
        worker: {
          select: {
            id: true,
            name: true,
            employmentType: true,
            incomeType: true,
            fourInsurancesEligibleYn: true,
            retirementMutualTargetYn: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    // 스냅샷 없는 근로자 목록도 포함 (기본 근로자 정보만)
    const snapshotWorkerIds = new Set(snapshots.map(s => s.workerId))
    const noSnapshotWorkers = workerIds.filter(id => !snapshotWorkerIds.has(id))

    let noSnapshotWorkerData: Array<{ id: string; name: string; employmentType: string; fourInsurancesEligibleYn: boolean; retirementMutualTargetYn: boolean }> = []
    if (noSnapshotWorkers.length > 0) {
      const workers = await prisma.worker.findMany({
        where: { id: { in: noSnapshotWorkers } },
        select: { id: true, name: true, employmentType: true, fourInsurancesEligibleYn: true, retirementMutualTargetYn: true },
      })
      noSnapshotWorkerData = workers
    }

    const items = [
      ...snapshots.map(s => ({
        workerId: s.workerId,
        workerName: s.worker.name,
        employmentType: s.worker.employmentType,
        incomeType: s.worker.incomeType,
        fourInsurancesEligibleYn: s.worker.fourInsurancesEligibleYn,
        retirementMutualTargetYn: s.worker.retirementMutualTargetYn,
        totalWorkDays: s.totalWorkDays,
        totalConfirmedAmount: s.totalConfirmedAmount,
        nationalPension:       { eligible: s.nationalPensionEligible,       reason: s.nationalPensionReason ?? '' },
        healthInsurance:       { eligible: s.healthInsuranceEligible,       reason: s.healthInsuranceReason ?? '' },
        employmentInsurance:   { eligible: s.employmentInsuranceEligible,   reason: s.employmentInsuranceReason ?? '' },
        industrialAccident:    { eligible: s.industrialAccidentEligible,    reason: s.industrialAccidentReason ?? '' },
        hasSnapshot: true,
      })),
      ...noSnapshotWorkerData.map(w => ({
        workerId: w.id,
        workerName: w.name,
        employmentType: w.employmentType,
        incomeType: null,
        fourInsurancesEligibleYn: w.fourInsurancesEligibleYn,
        retirementMutualTargetYn: w.retirementMutualTargetYn,
        totalWorkDays: null,
        totalConfirmedAmount: null,
        nationalPension:     { eligible: null, reason: '판정 미실행' },
        healthInsurance:     { eligible: null, reason: '판정 미실행' },
        employmentInsurance: { eligible: null, reason: '판정 미실행' },
        industrialAccident:  { eligible: null, reason: '판정 미실행' },
        hasSnapshot: false,
      })),
    ].sort((a, b) => a.workerName.localeCompare(b.workerName, 'ko'))

    const summary = {
      total:      items.length,
      npEligible: snapshots.filter(s => s.nationalPensionEligible).length,
      hiEligible: snapshots.filter(s => s.healthInsuranceEligible).length,
      eiEligible: snapshots.filter(s => s.employmentInsuranceEligible).length,
      iaEligible: snapshots.filter(s => s.industrialAccidentEligible).length,
      noSnapshot: noSnapshotWorkerData.length,
    }

    return ok({ items, summary, monthKey })
  } catch (err) {
    console.error('[company/insurance GET]', err)
    return internalError()
  }
}
