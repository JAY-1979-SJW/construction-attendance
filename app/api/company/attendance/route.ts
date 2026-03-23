import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { requireCompanyAdmin } from '@/lib/auth/guards'
import { ok, unauthorized, forbidden, internalError } from '@/lib/utils/response'
import { toKSTDateString, kstDateStringToDate } from '@/lib/utils/date'

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

    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date') ?? toKSTDateString()
    const workDate = kstDateStringToDate(dateParam)

    // 이 회사에 배정된 근로자 ID 목록
    const assignments = await prisma.workerCompanyAssignment.findMany({
      where: { companyId: session.companyId, validTo: null },
      select: { workerId: true },
    })
    const companyWorkerIds = assignments.map((a) => a.workerId)

    const logs = await prisma.attendanceLog.findMany({
      where: {
        workerId: { in: companyWorkerIds },
        workDate,
        status: { not: 'ADJUSTED' },
      },
      include: {
        worker: { select: { name: true } },
        checkInSite: { select: { name: true } },
      },
      orderBy: [{ checkInAt: 'asc' }],
    })

    // AttendanceDay에서 workedMinutesRaw 조회
    const attendanceDays = await prisma.attendanceDay.findMany({
      where: {
        OR: logs.map((l) => ({
          workerId: l.workerId,
          siteId: l.siteId,
          workDate: dateParam,
        })),
      },
      select: {
        id: true,
        workerId: true,
        siteId: true,
        workDate: true,
        workedMinutesRaw: true,
        workedMinutesAuto: true,
        workedMinutesOverride: true,
        workedMinutesRawFinal: true,
        manualAdjustedYn: true,
        manualAdjustedReason: true,
      },
    })
    const dayMap = new Map(
      attendanceDays.map((d) => [`${d.workerId}__${d.siteId}__${d.workDate}`, d])
    )

    return ok({
      items: logs.map((l) => {
        const day = dayMap.get(`${l.workerId}__${l.siteId}__${dateParam}`)
        return {
          id: l.id,
          workerName: l.worker.name,
          siteName: l.checkInSite?.name ?? '',
          checkInAt: l.checkInAt?.toISOString() ?? null,
          checkOutAt: l.checkOutAt?.toISOString() ?? null,
          status: l.status,
          workedMinutesRaw: day?.workedMinutesRaw ?? null,
          workedMinutesAuto: day?.workedMinutesAuto ?? null,
          workedMinutesOverride: day?.workedMinutesOverride ?? null,
          workedMinutesRawFinal: day?.workedMinutesRawFinal ?? null,
          manualAdjustedYn: day?.manualAdjustedYn ?? false,
          manualAdjustedReason: day?.manualAdjustedReason ?? null,
          attendanceDayId: day?.id ?? null,
        }
      }),
    })
  } catch (err) {
    console.error('[company/attendance GET]', err)
    return internalError()
  }
}
