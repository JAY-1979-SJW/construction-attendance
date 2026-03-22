import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getWorkerSession } from '@/lib/auth/guards'
import { ok, badRequest, unauthorized, internalError } from '@/lib/utils/response'
import { processAttendanceSiteMove } from '@/lib/attendance/attendance-engine'
import { writeAuditLog } from '@/lib/audit/write-audit-log'
import { prisma } from '@/lib/db/prisma'
import { toKSTDateString, kstDateStringToDate } from '@/lib/utils/date'

const schema = z.object({
  targetSiteId: z.string().min(1, '이동할 현장 ID가 필요합니다.'),
  latitude:     z.number().min(-90).max(90),
  longitude:    z.number().min(-180).max(180),
  deviceToken:  z.string().min(1, '기기 토큰이 필요합니다.'),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getWorkerSession()
    if (!session) return unauthorized()

    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const { targetSiteId, latitude, longitude, deviceToken } = parsed.data

    const result = await processAttendanceSiteMove(
      session.sub, deviceToken, targetSiteId, latitude, longitude
    )

    if (!result.success) {
      return badRequest(result.message)
    }

    // 현재 열린 출근 로그 ID 조회 (감사로그용)
    const workDate = kstDateStringToDate(toKSTDateString())
    const openLog = await prisma.attendanceLog.findFirst({
      where: { workerId: session.sub, status: 'WORKING', workDate },
      select: { id: true },
    })

    if (openLog) {
      await writeAuditLog({
        actorUserId: session.sub,
        actorType: 'WORKER',
        actionType: 'ATTENDANCE_SITE_MOVE',
        targetType: 'AttendanceLog',
        targetId: openLog.id,
        summary: `현장 이동`,
        metadataJson: {
          fromSiteId: result.fromSiteId,
          toSiteId: result.toSiteId,
          distance: result.distance,
          withinRadius: result.withinRadius,
        },
      })
    }

    return ok(
      { fromSiteId: result.fromSiteId, toSiteId: result.toSiteId, distance: result.distance },
      result.message
    )
  } catch (err) {
    console.error('[attendance/move]', err)
    return internalError()
  }
}
