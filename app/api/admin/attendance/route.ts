import { NextRequest } from 'next/server'
import { AttendanceStatus } from '@prisma/client'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, unauthorized, internalError } from '@/lib/utils/response'
import { kstDateStringToDate } from '@/lib/utils/date'

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { searchParams } = new URL(request.url)
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const siteId = searchParams.get('siteId')
    const workerId = searchParams.get('workerId')
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') ?? '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') ?? '50', 10)

    const workDateFilter: { gte?: Date; lte?: Date } = {}
    if (dateFrom) workDateFilter.gte = kstDateStringToDate(dateFrom)
    if (dateTo) workDateFilter.lte = kstDateStringToDate(dateTo)

    const where = {
      ...(Object.keys(workDateFilter).length > 0 ? { workDate: workDateFilter } : {}),
      ...(siteId ? { siteId } : {}),
      ...(workerId ? { workerId } : {}),
      ...(status ? { status: status as AttendanceStatus } : {}),
    }

    const [total, logs] = await Promise.all([
      prisma.attendanceLog.count({ where }),
      prisma.attendanceLog.findMany({
        where,
        include: {
          worker: { select: { name: true, phone: true, jobTitle: true } },
          checkInSite:  { select: { name: true } },
          checkOutSite: { select: { name: true } },
          events: {
            where: { eventType: 'MOVE' },
            orderBy: { occurredAt: 'asc' },
            include: { site: { select: { name: true } } },
          },
        },
        orderBy: [{ workDate: 'desc' }, { checkInAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    // AttendanceDay 일괄 조회 (workedMinutesRaw 포함)
    const attendanceDays = await prisma.attendanceDay.findMany({
      where: {
        OR: logs.map((l) => ({ workerId: l.workerId, siteId: l.siteId, workDate: l.workDate.toISOString().slice(0, 10) })),
      },
      select: { workerId: true, siteId: true, workDate: true, workedMinutesRaw: true },
    })
    const dayMap = new Map(
      attendanceDays.map((d) => [
        `${d.workerId}__${d.siteId}__${d.workDate}`,
        d.workedMinutesRaw,
      ])
    )

    return ok({
      items: logs.map((l) => {
        const moveEvents = l.events.map(e => ({
          siteId:   e.siteId,
          siteName: e.site?.name ?? '',
          movedAt:  e.occurredAt.toISOString(),
        }))

        // 이동 경로 문자열: "A현장 → B현장 → C현장"
        const checkInSiteName  = l.checkInSite.name
        const checkOutSiteName = l.checkOutSite?.name ?? null
        const movePath = moveEvents.length > 0
          ? [checkInSiteName, ...moveEvents.map(e => e.siteName)].join(' → ')
          : null

        const workedMinutesRaw = dayMap.get(`${l.workerId}__${l.siteId}__${l.workDate.toISOString().slice(0, 10)}`) ?? null

        return {
          id: l.id,
          workerName: l.worker.name,
          workerPhone: l.worker.phone,
          company: l.companyNameSnapshot ?? '',
          jobTitle: l.worker.jobTitle,
          siteName: checkInSiteName,
          checkOutSiteName,
          workDate: l.workDate.toISOString().slice(0, 10),
          checkInAt: l.checkInAt?.toISOString() ?? null,
          checkOutAt: l.checkOutAt?.toISOString() ?? null,
          status: l.status,
          checkInDistance: l.checkInDistance,
          checkOutDistance: l.checkOutDistance,
          exceptionReason: l.exceptionReason,
          adminNote: l.adminNote,
          isAutoCheckout: l.adminNote?.includes('[AUTO]') ?? false,
          hasSiteMove: moveEvents.length > 0,
          moveCount: moveEvents.length,
          movePath,
          moveEvents,
          workedMinutesRaw,
        }
      }),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (err) {
    console.error('[admin/attendance GET]', err)
    return internalError()
  }
}
