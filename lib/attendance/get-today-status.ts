import { prisma } from '@/lib/db/prisma'
import { toKSTDateString, kstDateStringToDate } from '@/lib/utils/date'

export async function getTodayStatus(workerId: string) {
  const workDate = kstDateStringToDate(toKSTDateString())

  const log = await prisma.attendanceLog.findFirst({
    where: { workerId, workDate },
    include: { checkInSite: { select: { name: true, address: true } } },
  })

  if (!log) return null

  // 이동형 근무: 마지막 MOVE 이벤트로 현재 근무 현장 결정
  const [lastMove, moveEvents] = await Promise.all([
    prisma.attendanceEvent.findFirst({
      where: { attendanceLogId: log.id, eventType: 'MOVE' },
      orderBy: { occurredAt: 'desc' },
      include: { site: { select: { name: true } } },
    }),
    prisma.attendanceEvent.findMany({
      where: { attendanceLogId: log.id, eventType: 'MOVE' },
      orderBy: { occurredAt: 'asc' },
      include: { site: { select: { name: true } } },
    }),
  ])

  const currentSiteId = lastMove?.siteId ?? log.siteId
  const currentSiteName = lastMove?.site?.name ?? log.checkInSite.name

  return {
    id: log.id,
    siteId: log.siteId,
    currentSiteId,
    currentSiteName,
    siteName: log.checkInSite.name,
    siteAddress: log.checkInSite.address,
    workDate: toKSTDateString(log.workDate),
    checkInAt: log.checkInAt?.toISOString() ?? null,
    checkOutAt: log.checkOutAt?.toISOString() ?? null,
    status: log.status,
    checkInDistance: log.checkInDistance,
    checkOutDistance: log.checkOutDistance,
    moveEvents: moveEvents.map(e => ({
      siteId: e.siteId,
      siteName: e.site?.name ?? '',
      movedAt: e.occurredAt.toISOString(),
    })),
  }
}
