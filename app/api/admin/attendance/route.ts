import { NextRequest } from 'next/server'
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
      ...(status ? { status } : {}),
    }

    const [total, logs] = await Promise.all([
      prisma.attendanceLog.count({ where }),
      prisma.attendanceLog.findMany({
        where,
        include: {
          worker: { select: { name: true, phone: true, company: true, jobTitle: true } },
          site: { select: { name: true } },
        },
        orderBy: [{ workDate: 'desc' }, { checkInAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    return ok({
      items: logs.map((l) => ({
        id: l.id,
        workerName: l.worker.name,
        workerPhone: l.worker.phone,
        company: l.worker.company,
        jobTitle: l.worker.jobTitle,
        siteName: l.site.name,
        workDate: l.workDate.toISOString().slice(0, 10),
        checkInAt: l.checkInAt?.toISOString() ?? null,
        checkOutAt: l.checkOutAt?.toISOString() ?? null,
        status: l.status,
        checkInDistance: l.checkInDistance,
        checkOutDistance: l.checkOutDistance,
        exceptionReason: l.exceptionReason,
      })),
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
