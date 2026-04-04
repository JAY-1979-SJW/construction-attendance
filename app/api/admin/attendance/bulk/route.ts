import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession, requireRole, MUTATE_ROLES } from '@/lib/auth/guards'
import { ok, unauthorized, badRequest, internalError } from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

/**
 * POST /api/admin/attendance/bulk
 * Body: { ids: string[], action: 'adjust-checkout', checkOutTime: 'HH:MM', reason?: string }
 * Response: { succeeded: number, failed: number, failedItems: { id, reason }[] }
 *
 * MISSING_CHECKOUT 상태인 항목만 처리. 이미 처리된 항목은 failed로 반환.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const deny = requireRole(session, [...MUTATE_ROLES, 'SITE_ADMIN'])
    if (deny) return deny

    const body = await req.json().catch(() => null)
    if (!body || !Array.isArray(body.ids) || !body.ids.length) {
      return badRequest('ids 배열이 필요합니다')
    }

    const action: string = body.action
    if (action !== 'adjust-checkout') {
      return badRequest('action은 adjust-checkout 이어야 합니다')
    }

    const checkOutTime: string = body.checkOutTime
    if (!checkOutTime || !/^\d{2}:\d{2}$/.test(checkOutTime)) {
      return badRequest('checkOutTime은 HH:MM 형식이어야 합니다')
    }

    const reason: string = body.reason || '퇴근 누락 대량 보정'
    const ids: string[] = body.ids
    const now = new Date()

    const adminUser = await prisma.adminUser.findUnique({
      where: { id: session.sub },
      select: { name: true },
    })
    const adminName = adminUser?.name ?? session.sub

    // 1. FK 선조회 원칙 — ids 전체 조회
    const logs = await prisma.attendanceLog.findMany({
      where: { id: { in: ids } },
      select: { id: true, status: true, workDate: true, workerId: true, siteId: true },
    })
    const logMap = new Map(logs.map((l) => [l.id, l]))

    const succeeded: string[] = []
    const failedItems: { id: string; reason: string }[] = []

    for (const id of ids) {
      const log = logMap.get(id)
      if (!log) { failedItems.push({ id, reason: 'NOT_FOUND' }); continue }
      if (log.status !== 'MISSING_CHECKOUT') { failedItems.push({ id, reason: 'NOT_MISSING_CHECKOUT' }); continue }

      const workDateStr = log.workDate instanceof Date
        ? log.workDate.toISOString().slice(0, 10)
        : String(log.workDate).slice(0, 10)
      const checkOutAt = new Date(`${workDateStr}T${checkOutTime}:00+09:00`)

      const result = await prisma.attendanceLog.updateMany({
        where: { id: log.id, status: 'MISSING_CHECKOUT' },
        data: {
          checkOutAt,
          status: 'ADJUSTED' as never,
          adminNote: `[수동보정] ${reason}`,
        },
      })
      if (result.count === 0) { failedItems.push({ id, reason: 'CONCURRENT_UPDATE' }); continue }

      // AttendanceDay 보정 기록
      const attendanceDay = await prisma.attendanceDay.findFirst({
        where: { workerId: log.workerId, siteId: log.siteId, workDate: workDateStr },
      })
      if (attendanceDay) {
        await prisma.attendanceDay.update({
          where: { id: attendanceDay.id },
          data: {
            manualAdjustedYn: true,
            manualAdjustedReason: reason,
          },
        })
      }

      await writeAuditLog({
        adminId: session.sub,
        actionType: 'ADJUST_ATTENDANCE',
        targetType: 'AttendanceLog',
        targetId: log.id,
        description: `대량 퇴근 보정: ${workDateStr} ${checkOutTime} (${reason}) — 처리자: ${adminName}`,
      })

      succeeded.push(id)
    }

    return ok({ succeeded: succeeded.length, failed: failedItems.length, failedItems })
  } catch (err) {
    console.error('[admin/attendance/bulk]', err)
    return internalError()
  }
}
