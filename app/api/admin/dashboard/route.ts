import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, unauthorized, internalError } from '@/lib/utils/response'
import { kstDateStringToDate, toKSTDateString } from '@/lib/utils/date'

export async function GET() {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const today = kstDateStringToDate(toKSTDateString())

    const [totalWorkers, activeSites, todayCheckedIn, todayCompleted, pendingExceptions, pendingDeviceRequests] =
      await Promise.all([
        prisma.worker.count({ where: { isActive: true } }),
        prisma.site.count({ where: { isActive: true } }),
        prisma.attendanceLog.count({ where: { workDate: today, status: 'WORKING' } }),
        prisma.attendanceLog.count({ where: { workDate: today, status: 'COMPLETED' } }),
        prisma.attendanceLog.count({ where: { status: 'EXCEPTION' } }),
        prisma.deviceChangeRequest.count({ where: { status: 'PENDING' } }),
      ])

    // 오늘 출근 현황 (최근 20건)
    const recentAttendance = await prisma.attendanceLog.findMany({
      where: { workDate: today },
      include: {
        worker: { select: { name: true, company: true } },
        checkInSite: { select: { name: true } },
      },
      orderBy: { checkInAt: 'desc' },
      take: 20,
    })

    return ok({
      summary: {
        totalWorkers,
        activeSites,
        todayCheckedIn,
        todayCompleted,
        todayTotal: todayCheckedIn + todayCompleted,
        pendingExceptions,
        pendingDeviceRequests,
      },
      recentAttendance: recentAttendance.map((l) => ({
        id: l.id,
        workerName: l.worker.name,
        company: l.worker.company,
        siteName: l.checkInSite.name,
        checkInAt: l.checkInAt?.toISOString() ?? null,
        checkOutAt: l.checkOutAt?.toISOString() ?? null,
        status: l.status,
      })),
    })
  } catch (err) {
    console.error('[admin/dashboard]', err)
    return internalError()
  }
}
