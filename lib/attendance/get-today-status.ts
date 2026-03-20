import { prisma } from '@/lib/db/prisma'
import { toKSTDateString, kstDateStringToDate } from '@/lib/utils/date'

export async function getTodayStatus(workerId: string) {
  const workDate = kstDateStringToDate(toKSTDateString())

  const log = await prisma.attendanceLog.findFirst({
    where: { workerId, workDate },
    include: { site: { select: { name: true, address: true } } },
  })

  if (!log) return null

  return {
    id: log.id,
    siteName: log.site.name,
    siteAddress: log.site.address,
    workDate: toKSTDateString(log.workDate),
    checkInAt: log.checkInAt?.toISOString() ?? null,
    checkOutAt: log.checkOutAt?.toISOString() ?? null,
    status: log.status,
    checkInDistance: log.checkInDistance,
    checkOutDistance: log.checkOutDistance,
  }
}
