import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getWorkerSession } from '@/lib/auth/guards'
import { ok, badRequest, unauthorized, internalError } from '@/lib/utils/response'
import { processAttendanceCheckIn } from '@/lib/attendance/attendance-engine'
import { schedulePresenceChecksForAttendance } from '@/lib/attendance/presence-scheduler'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

const schema = z.object({
  siteId:          z.string().min(1, '현장 ID가 필요합니다.'),
  latitude:        z.number().min(-90).max(90),
  longitude:       z.number().min(-180).max(180),
  deviceToken:     z.string().min(1, '기기 토큰이 필요합니다.'),
  checkInPhotoId:  z.string().optional(),  // 출근 증빙 사진 ID (ATTENDANCE_PHOTO_REQUIRED=true면 필수)
  exceptionReason: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getWorkerSession()
    if (!session) return unauthorized()

    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const { siteId, latitude, longitude, deviceToken, checkInPhotoId, exceptionReason } = parsed.data

    const result = await processAttendanceCheckIn(
      {
        workerId: session.sub,
        deviceToken,
        siteId,
        latitude,
        longitude,
        isDirectCheckIn: true,
        exceptionReason,
        checkInPhotoId,
      },
      (attendanceId) => schedulePresenceChecksForAttendance(attendanceId)
    )

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message, errorCode: result.errorCode ?? null, actionRequired: result.actionRequired ?? null },
        { status: 400 }
      )
    }

    await writeAuditLog({
      actorUserId: session.sub,
      actorType: 'WORKER',
      actionType: 'CHECK_IN_SUCCESS',
      targetType: 'AttendanceLog',
      targetId: result.attendanceId,
      summary: `직접 출근 — 현장: ${siteId}`,
      metadataJson: { siteId, distance: result.distance, withinRadius: result.withinRadius, companyId: result.companyId, checkInPhotoId },
    })

    return ok(
      { attendanceId: result.attendanceId, distance: result.distance, withinRadius: result.withinRadius },
      result.message
    )
  } catch (err) {
    console.error('[attendance/check-in-direct]', err)
    return internalError()
  }
}
