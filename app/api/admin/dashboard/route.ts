import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, unauthorized, internalError } from '@/lib/utils/response'
import { kstDateStringToDate, toKSTDateString } from '@/lib/utils/date'

export async function GET() {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const today = kstDateStringToDate(toKSTDateString())

    const [totalWorkers, activeSites, todayCheckedIn, todayCompleted, pendingMissing, pendingExceptions, pendingDeviceRequests] =
      await Promise.all([
        prisma.worker.count({ where: { isActive: true } }),
        prisma.site.count({ where: { isActive: true } }),
        prisma.attendanceLog.count({ where: { workDate: today, status: 'WORKING' } }),
        prisma.attendanceLog.count({ where: { workDate: today, status: 'COMPLETED' } }),
        // 전일 이전 MISSING_CHECKOUT 건 — 관리자 미확인 누적분
        prisma.attendanceLog.count({ where: { status: 'MISSING_CHECKOUT', workDate: { lt: today } } }),
        prisma.attendanceLog.count({ where: { status: 'EXCEPTION' } }),
        prisma.deviceChangeRequest.count({ where: { status: 'PENDING' } }),
      ])

    const todayStr = toKSTDateString()
    const presenceCounts = await prisma.presenceCheck.groupBy({
      by: ['status'],
      where: { checkDate: todayStr },
      _count: { _all: true },
    })
    const pc = (status: string) => presenceCounts.find((r) => r.status === status)?._count._all ?? 0
    const todayPresence = {
      total:       presenceCounts.reduce((s, r) => s + r._count._all, 0),
      pending:     pc('PENDING'),
      completed:   pc('COMPLETED') + pc('MANUALLY_CONFIRMED'),
      noResponse:  pc('NO_RESPONSE') + pc('MISSED'),
      outOfFence:  pc('OUT_OF_GEOFENCE') + pc('MANUALLY_REJECTED'),
      review:      pc('REVIEW_REQUIRED'),
    }

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
        pendingMissing,
        pendingExceptions,
        pendingDeviceRequests,
        todayPresenceTotal:      todayPresence.total,
        todayPresencePending:    todayPresence.pending,
        todayPresenceCompleted:  todayPresence.completed,
        todayPresenceNoResponse: todayPresence.noResponse,
        todayPresenceOutOfFence: todayPresence.outOfFence,
        todayPresenceReview:     todayPresence.review,
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
