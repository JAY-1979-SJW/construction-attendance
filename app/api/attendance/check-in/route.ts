import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getWorkerSession } from '@/lib/auth/guards'
import { ok, badRequest, unauthorized, notFound, internalError } from '@/lib/utils/response'
import { processAttendanceCheckIn } from '@/lib/attendance/attendance-engine'
import { schedulePresenceChecksForAttendance } from '@/lib/attendance/presence-scheduler'
import { writeAuditLog } from '@/lib/audit/write-audit-log'
import { prisma } from '@/lib/db/prisma'

const schema = z.object({
  qrToken:         z.string().min(1, 'QR 토큰이 필요합니다.'),
  latitude:        z.number().min(-90).max(90),
  longitude:       z.number().min(-180).max(180),
  deviceToken:     z.string().min(1, '기기 토큰이 필요합니다.'),
  checkInPhotoId:  z.string().optional(),
  exceptionReason: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getWorkerSession()
    if (!session) return unauthorized()

    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const { qrToken, latitude, longitude, deviceToken, checkInPhotoId, exceptionReason } = parsed.data

    // QR 토큰으로 현장 조회
    const site = await prisma.site.findUnique({
      where: { qrToken },
      select: { id: true, name: true, isActive: true },
    })
    if (!site) return notFound('유효하지 않은 QR 코드입니다.')
    if (!site.isActive) return badRequest('현재 운영 중이 아닌 현장입니다.')

    const result = await processAttendanceCheckIn(
      {
        workerId: session.sub,
        deviceToken,
        siteId: site.id,
        latitude,
        longitude,
        isDirectCheckIn: false,
        qrToken,
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
      summary: `QR 출근 — 현장: ${site.name}`,
      metadataJson: { siteId: site.id, qrToken, distance: result.distance, withinRadius: result.withinRadius, companyId: result.companyId, checkInPhotoId },
    })

    return ok(
      { attendanceId: result.attendanceId, distance: result.distance, withinRadius: result.withinRadius, siteName: site.name },
      result.message
    )
  } catch (err) {
    console.error('[attendance/check-in]', err)
    return internalError()
  }
}
