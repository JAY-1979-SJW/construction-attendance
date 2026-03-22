import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getWorkerSession } from '@/lib/auth/guards'
import { ok, badRequest, unauthorized, internalError } from '@/lib/utils/response'
import { processAttendanceCheckOut } from '@/lib/attendance/attendance-engine'
import { writeAuditLog } from '@/lib/audit/write-audit-log'
import { prisma } from '@/lib/db/prisma'
import { toKSTDateString, kstDateStringToDate } from '@/lib/utils/date'

const schema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  deviceToken: z.string().min(1, '기기 토큰이 필요합니다.'),
  exceptionReason: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getWorkerSession()
    if (!session) return unauthorized()

    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const { latitude, longitude, deviceToken, exceptionReason } = parsed.data

    // 현재 열린 세션에서 현장 ID 조회
    const workDate = kstDateStringToDate(toKSTDateString())
    const openLog = await prisma.attendanceLog.findFirst({
      where: { workerId: session.sub, status: 'WORKING', checkOutAt: null, workDate },
      select: { siteId: true, id: true },
    })

    if (!openLog) {
      return badRequest('오늘 출근 기록이 없습니다.')
    }

    // 마지막 MOVE 이벤트에서 현장 ID 확인
    const lastMove = await prisma.attendanceEvent.findFirst({
      where: { attendanceLogId: openLog.id, eventType: 'MOVE' },
      orderBy: { occurredAt: 'desc' },
      select: { siteId: true },
    })
    const currentSiteId = lastMove?.siteId ?? openLog.siteId

    const result = await processAttendanceCheckOut(
      session.sub, deviceToken, currentSiteId, latitude, longitude, exceptionReason
    )

    if (!result.success) {
      const code = result.message.includes('사유') ? 'NEEDS_EXCEPTION_REASON' : undefined
      return badRequest(result.message, code)
    }

    await writeAuditLog({
      actorUserId: session.sub,
      actorType: 'WORKER',
      actionType: result.isException ? 'ATTENDANCE_EXCEPTION_CHECK_OUT' : 'ATTENDANCE_CHECK_OUT_DIRECT',
      targetType: 'AttendanceLog',
      targetId: openLog.id,
      summary: result.isException ? `예외 퇴근 — 사유: ${exceptionReason}` : '직접 퇴근',
      metadataJson: { siteId: currentSiteId, distance: result.distance, withinRadius: result.withinRadius },
    })

    return ok(
      { distance: result.distance, withinRadius: result.withinRadius, isException: result.isException },
      result.message
    )
  } catch (err) {
    console.error('[attendance/check-out-direct]', err)
    return internalError()
  }
}
