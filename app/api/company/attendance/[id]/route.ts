import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { requireCompanyAdmin } from '@/lib/auth/guards'
import { requireFeature } from '@/lib/feature-flags'
import { writeAuditLog } from '@/lib/audit/write-audit-log'
import { ok, badRequest, unauthorized, forbidden, notFound, internalError } from '@/lib/utils/response'

/**
 * GET /api/company/attendance/[id]
 * 업체 관리자 — 출퇴근 기록 상세 조회
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    let session
    try {
      session = await requireCompanyAdmin()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : ''
      if (msg === 'UNAUTHORIZED') return unauthorized()
      if (msg === 'FORBIDDEN') return forbidden()
      throw e
    }

    const log = await prisma.attendanceLog.findUnique({
      where: { id: params.id },
      include: {
        worker: { select: { name: true } },
        checkInSite: { select: { name: true } },
        events: { orderBy: { occurredAt: 'asc' } },
      },
    })

    if (!log) return notFound('출퇴근 기록을 찾을 수 없습니다.')

    // 이 근로자가 해당 업체 소속인지 확인
    const assignment = await prisma.workerCompanyAssignment.findFirst({
      where: { workerId: log.workerId, companyId: session.companyId },
    })
    if (!assignment) return forbidden('이 근로자는 해당 업체 소속이 아닙니다.')

    const attendanceDay = await prisma.attendanceDay.findFirst({
      where: {
        workerId: log.workerId,
        siteId: log.siteId,
        workDate: log.workDate.toISOString().slice(0, 10),
      },
    })

    return ok({
      id: log.id,
      workerName: log.worker.name,
      siteName: log.checkInSite?.name ?? '',
      workDate: log.workDate.toISOString().slice(0, 10),
      status: log.status,
      checkInAt: log.checkInAt?.toISOString() ?? null,
      checkOutAt: log.checkOutAt?.toISOString() ?? null,
      workedMinutesAuto: attendanceDay?.workedMinutesAuto ?? null,
      workedMinutesOverride: attendanceDay?.workedMinutesOverride ?? null,
      workedMinutesRawFinal: attendanceDay?.workedMinutesRawFinal ?? null,
      workedMinutesRaw: attendanceDay?.workedMinutesRaw ?? null,
      manualAdjustedYn: attendanceDay?.manualAdjustedYn ?? false,
      manualAdjustedReason: attendanceDay?.manualAdjustedReason ?? null,
      manualAdjustedByUserId: attendanceDay?.manualAdjustedByUserId ?? null,
      manualAdjustedAt: attendanceDay?.manualAdjustedAt?.toISOString() ?? null,
      attendanceDayId: attendanceDay?.id ?? null,
    })
  } catch (err) {
    console.error('[company/attendance/[id] GET]', err)
    return internalError()
  }
}

const patchSchema = z.object({
  workedMinutesOverride: z.number().int().min(0).max(1440),
  manualAdjustedReason: z.string().min(2).max(200).trim(),
})

/**
 * PATCH /api/company/attendance/[id]
 * 업체 관리자 — 공수(작업 시간) 수동 수정
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    let session
    try {
      session = await requireCompanyAdmin()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : ''
      if (msg === 'UNAUTHORIZED') return unauthorized()
      if (msg === 'FORBIDDEN') return forbidden()
      throw e
    }

    // 기능 플래그 확인
    const featureCheck = await requireFeature(session.companyId, 'laborCostEditEnabled')
    if (featureCheck) return featureCheck

    const body = await request.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.issues[0].message)

    const log = await prisma.attendanceLog.findUnique({
      where: { id: params.id },
      include: {
        worker: { select: { name: true } },
        checkInSite: { select: { name: true } },
      },
    })
    if (!log) return notFound('출퇴근 기록을 찾을 수 없습니다.')

    // 업체 소속 확인
    const assignment = await prisma.workerCompanyAssignment.findFirst({
      where: { workerId: log.workerId, companyId: session.companyId },
    })
    if (!assignment) return forbidden('이 근로자는 해당 업체 소속이 아닙니다.')

    const attendanceDay = await prisma.attendanceDay.findFirst({
      where: {
        workerId: log.workerId,
        siteId: log.siteId,
        workDate: log.workDate.toISOString().slice(0, 10),
      },
    })

    if (!attendanceDay) {
      return notFound('공수 집계 데이터가 없습니다. 크론 집계 후 수정 가능합니다.')
    }

    const beforeJson = {
      workedMinutesAuto: attendanceDay.workedMinutesAuto,
      workedMinutesOverride: attendanceDay.workedMinutesOverride,
      workedMinutesRawFinal: attendanceDay.workedMinutesRawFinal,
      manualAdjustedYn: attendanceDay.manualAdjustedYn,
      manualAdjustedReason: attendanceDay.manualAdjustedReason,
    }

    const updated = await prisma.attendanceDay.update({
      where: { id: attendanceDay.id },
      data: {
        workedMinutesOverride: parsed.data.workedMinutesOverride,
        workedMinutesRawFinal: parsed.data.workedMinutesOverride,
        workedMinutesRaw: parsed.data.workedMinutesOverride,
        manualAdjustedYn: true,
        manualAdjustedReason: parsed.data.manualAdjustedReason,
        manualAdjustedByUserId: session.sub,
        manualAdjustedAt: new Date(),
      },
    })

    const afterJson = {
      workedMinutesAuto: updated.workedMinutesAuto,
      workedMinutesOverride: updated.workedMinutesOverride,
      workedMinutesRawFinal: updated.workedMinutesRawFinal,
      manualAdjustedYn: updated.manualAdjustedYn,
      manualAdjustedReason: updated.manualAdjustedReason,
    }

    await writeAuditLog({
      actorUserId: session.sub,
      actorRole: 'COMPANY_ADMIN',
      companyId: session.companyId,
      actionType: 'UPDATE_WORKED_MINUTES',
      targetType: 'AttendanceDay',
      targetId: attendanceDay.id,
      beforeJson,
      afterJson,
      reason: parsed.data.manualAdjustedReason,
    })

    return ok({
      id: log.id,
      attendanceDayId: updated.id,
      workedMinutesAuto: updated.workedMinutesAuto,
      workedMinutesOverride: updated.workedMinutesOverride,
      workedMinutesRawFinal: updated.workedMinutesRawFinal,
      workedMinutesRaw: updated.workedMinutesRaw,
      manualAdjustedYn: updated.manualAdjustedYn,
      manualAdjustedReason: updated.manualAdjustedReason,
      manualAdjustedByUserId: updated.manualAdjustedByUserId,
      manualAdjustedAt: updated.manualAdjustedAt?.toISOString() ?? null,
    })
  } catch (err) {
    console.error('[company/attendance/[id] PATCH]', err)
    return internalError()
  }
}
