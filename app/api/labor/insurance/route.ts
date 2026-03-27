import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { requireCompanyAdmin } from '@/lib/auth/guards'
import { ok, unauthorized, forbidden, internalError } from '@/lib/utils/response'

// GET /api/labor/insurance?month=YYYY-MM&status=
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
    const statusParam = searchParams.get('status') || undefined

    const companySites = await prisma.siteCompanyAssignment.findMany({
      where: { companyId: session.companyId },
      select: { siteId: true },
    })
    const siteIds = companySites.map((cp) => cp.siteId)

    if (siteIds.length === 0) return ok([])

    // 해당 월 현장 배정 근로자의 보험 상태 조회 (companyId 기준)
    const insuranceStatuses = await prisma.workerInsuranceStatus.findMany({
      where: {
        companyId: session.companyId,
        ...(statusParam ? { reportingStatus: statusParam as never } : {}),
      },
      include: {
        worker: { select: { id: true, name: true } },
      },
    })

    // 해당 월 근무일수 (AttendanceDay)
    const monthStart = new Date(`${month}-01`)
    const monthEnd = new Date(
      month.slice(0, 4) + '-' +
      String(Number(month.slice(5, 7)) + 1).padStart(2, '0') +
      '-01'
    )
    const workDayRows = await prisma.attendanceDay.groupBy({
      by: ['workerId'],
      where: {
        siteId: { in: siteIds },
        workDate: { gte: monthStart.toISOString().slice(0, 10), lt: monthEnd.toISOString().slice(0, 10) },
      },
      _count: true,
    })
    const workDayMap = new Map(workDayRows.map((r) => [r.workerId, r._count]))

    // insuranceEligibilitySnapshot으로 4대보험 가입 여부 확인
    const eligibilitySnapshots = await prisma.insuranceEligibilitySnapshot.findMany({
      where: {
        monthKey: month,
        workerId: { in: insuranceStatuses.map((s) => s.workerId) },
      },
      select: {
        workerId: true,
        nationalPensionEligible: true,
        healthInsuranceEligible: true,
        employmentInsuranceEligible: true,
        industrialAccidentEligible: true,
      },
    })
    const eligMap = new Map(eligibilitySnapshots.map((s) => [s.workerId, s]))

    const data = insuranceStatuses.map((s) => {
      const elig = eligMap.get(s.workerId)
      return {
        workerId: s.workerId,
        workerName: s.worker.name,
        workDays: workDayMap.get(s.workerId) ?? 0,
        acquisitionDate: s.acquisitionDate?.toISOString().slice(0, 10),
        lossDate: s.lossDate?.toISOString().slice(0, 10),
        reportingStatus: s.reportingStatus,
        nationalPensionEligible: elig?.nationalPensionEligible ?? false,
        healthInsuranceEligible: elig?.healthInsuranceEligible ?? false,
        employmentInsuranceEligible: elig?.employmentInsuranceEligible ?? false,
        industrialAccidentEligible: elig?.industrialAccidentEligible ?? true,
        notes: s.notes ?? undefined,
      }
    })

    return ok(data)
  } catch (err) {
    console.error('[labor/insurance GET]', err)
    return internalError()
  }
}
