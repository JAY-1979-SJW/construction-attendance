import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { requireCompanyAdmin } from '@/lib/auth/guards'
import { ok, unauthorized, forbidden, internalError } from '@/lib/utils/response'

// GET /api/labor/sites?month=YYYY-MM
export async function GET(req: NextRequest) {
  try {
    let session: Awaited<ReturnType<typeof requireCompanyAdmin>>
    try {
      session = await requireCompanyAdmin()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : ''
      return msg === 'UNAUTHORIZED' ? unauthorized() : forbidden()
    }

    const { searchParams } = req.nextUrl
    const month = searchParams.get('month') || (() => {
      const now = new Date()
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    })()

    const companySites = await prisma.siteCompanyAssignment.findMany({
      where: { companyId: session.companyId },
      include: { site: { select: { id: true, name: true } } },
    })

    if (companySites.length === 0) return ok([])

    const siteIds = companySites.map((cp) => cp.siteId)

    const monthStart = new Date(`${month}-01`)
    const monthEnd = new Date(
      month.slice(0, 4) + '-' +
      String(Number(month.slice(5, 7)) + 1).padStart(2, '0') +
      '-01'
    )

    // 현장별 MonthlyWorkConfirmation 집계
    const confAggs = await prisma.monthlyWorkConfirmation.groupBy({
      by: ['siteId', 'confirmationStatus'],
      where: { siteId: { in: siteIds }, monthKey: month },
      _sum:   { confirmedTotalAmount: true, confirmedWorkUnits: true },
      _count: { id: true },
    })

    // 현장별 출근 근로자 수
    const workedAgg = await prisma.attendanceDay.groupBy({
      by: ['siteId', 'workerId'],
      where: { siteId: { in: siteIds }, workDate: { gte: monthStart, lt: monthEnd } },
    })
    const workedBySite = new Map<string, Set<string>>()
    for (const row of workedAgg) {
      if (!workedBySite.has(row.siteId)) workedBySite.set(row.siteId, new Set())
      workedBySite.get(row.siteId)!.add(row.workerId)
    }

    // 현장별 전체 인원 (배정된 활성 근로자)
    const assignAgg = await prisma.workerSiteAssignment.groupBy({
      by: ['siteId'],
      where: { siteId: { in: siteIds }, isActive: true },
      _count: { workerId: true },
    })
    const totalBySite = new Map(assignAgg.map((a) => [a.siteId, a._count.workerId]))

    // 4대보험 대상자 수 (eligibilitySnapshot)
    const eligByWorkerIds = await prisma.insuranceEligibilitySnapshot.groupBy({
      by: ['workerId'],
      where: {
        monthKey: month,
        OR: [
          { nationalPensionEligible: true },
          { healthInsuranceEligible: true },
          { employmentInsuranceEligible: true },
        ],
      },
    })
    const eligWorkerSet = new Set(eligByWorkerIds.map((e) => e.workerId))

    // 집계 결과 조합
    const siteMap = new Map<string, {
      siteId: string
      siteName: string
      totalWorkers: number
      workedWorkers: number
      totalManday: number
      totalWage: number
      confirmedCount: number
      pendingCount: number
      insuranceTargets: number
    }>()

    for (const cp of companySites) {
      siteMap.set(cp.siteId, {
        siteId: cp.siteId,
        siteName: cp.site.name,
        totalWorkers:    totalBySite.get(cp.siteId) ?? 0,
        workedWorkers:   workedBySite.get(cp.siteId)?.size ?? 0,
        totalManday:     0,
        totalWage:       0,
        confirmedCount:  0,
        pendingCount:    0,
        insuranceTargets: 0,
      })
    }

    for (const agg of confAggs) {
      const s = siteMap.get(agg.siteId)
      if (!s) continue
      s.totalManday += Number(agg._sum.confirmedWorkUnits ?? 0)
      s.totalWage   += agg._sum.confirmedTotalAmount ?? 0
      if (agg.confirmationStatus === 'CONFIRMED') {
        s.confirmedCount += agg._count.id
      } else {
        s.pendingCount += agg._count.id
      }
    }

    // 보험 대상자 수: 현장 배정 근로자 중 eligWorkerSet 교집합
    for (const [siteId, workerSet] of workedBySite) {
      const s = siteMap.get(siteId)
      if (!s) continue
      s.insuranceTargets = [...workerSet].filter((w) => eligWorkerSet.has(w)).length
    }

    return ok([...siteMap.values()])
  } catch (err) {
    console.error('[labor/sites GET]', err)
    return internalError()
  }
}
