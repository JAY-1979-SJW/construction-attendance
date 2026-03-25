import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { requireCompanyAdmin } from '@/lib/auth/guards'
import { ok, unauthorized, forbidden, internalError } from '@/lib/utils/response'

// GET /api/labor/dashboard?month=YYYY-MM
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
      select: { siteId: true },
    })
    const siteIds = companySites.map((cp) => cp.siteId)
    const siteCount = siteIds.length

    if (siteIds.length === 0) {
      return ok({
        thisMonth: month,
        totalWorkers: 0, workedWorkers: 0,
        confirmedDays: 0, pendingConfirmations: 0,
        totalWage: 0, insuranceTargets: 0,
        documentPendingCount: 0, siteCount: 0,
      })
    }

    const monthStart = new Date(`${month}-01`)
    const monthEnd = new Date(
      month.slice(0, 4) + '-' +
      String(Number(month.slice(5, 7)) + 1).padStart(2, '0') +
      '-01'
    )

    const [
      confirmAgg,
      workedWorkers,
      insuranceTargets,
      docPending,
      totalWorkers,
    ] = await Promise.all([
      // 월 공수 확정 집계
      prisma.monthlyWorkConfirmation.aggregate({
        where: { siteId: { in: siteIds }, monthKey: month },
        _sum: { confirmedTotalAmount: true, confirmedWorkMinutes: true },
        _count: { id: true },
      }),
      // 출근한 근로자 수 (해당 월)
      prisma.attendanceDay.groupBy({
        by: ['workerId'],
        where: {
          siteId: { in: siteIds },
          workDate: { gte: monthStart, lt: monthEnd },
        },
      }).then((g) => g.length),
      // 4대보험 대상자 수
      prisma.insuranceEligibilitySnapshot.count({
        where: {
          monthKey: month,
          worker: { workerSiteAssignments: { some: { siteId: { in: siteIds } } } },
          OR: [
            { nationalPensionEligible: true },
            { healthInsuranceEligible: true },
            { employmentInsuranceEligible: true },
          ],
        },
      }),
      // 서류 검토대기 건수
      prisma.workerDocument.count({
        where: {
          siteId: { in: siteIds },
          status: 'REVIEW_PENDING',
        },
      }),
      // 전체 근로자 수 (현장 배정 기준)
      prisma.workerSiteAssignment.groupBy({
        by: ['workerId'],
        where: { siteId: { in: siteIds }, isActive: true },
      }).then((g) => g.length),
    ])

    const confirmedDays = Math.round((confirmAgg._sum.confirmedWorkMinutes ?? 0) / (8 * 60))
    const pendingConfirmations = await prisma.monthlyWorkConfirmation.count({
      where: {
        siteId: { in: siteIds },
        monthKey: month,
        confirmationStatus: 'DRAFT',
      },
    })

    return ok({
      thisMonth: month,
      totalWorkers,
      workedWorkers,
      confirmedDays,
      pendingConfirmations,
      totalWage: confirmAgg._sum.confirmedTotalAmount ?? 0,
      insuranceTargets,
      documentPendingCount: docPending,
      siteCount,
    })
  } catch (err) {
    console.error('[labor/dashboard GET]', err)
    return internalError()
  }
}
