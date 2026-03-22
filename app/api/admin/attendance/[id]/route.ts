import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminSession, requireRole, MUTATE_ROLES } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/audit/write-audit-log'
import { ok, unauthorized, badRequest, notFound, internalError } from '@/lib/utils/response'
import { AttendanceStatus } from '@prisma/client'

/**
 * GET /api/admin/attendance/[id]
 * 출퇴근 기록 상세 조회 — MOVE 이벤트 포함
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const log = await prisma.attendanceLog.findUnique({
      where: { id: params.id },
      include: {
        worker: { select: { name: true, phone: true, jobTitle: true } },
        checkInSite: { select: { id: true, name: true, address: true } },
        checkOutSite: { select: { id: true, name: true } },
        events: {
          where: { eventType: 'MOVE' },
          include: { site: { select: { name: true } } },
          orderBy: { occurredAt: 'asc' },
        },
      },
    })

    if (!log) return notFound('출퇴근 기록을 찾을 수 없습니다.')

    return ok({
      id: log.id,
      workerName: log.worker.name,
      workerPhone: log.worker.phone,
      company: log.companyNameSnapshot ?? '',
      jobTitle: log.worker.jobTitle,
      workDate: log.workDate.toISOString().slice(0, 10),
      status: log.status,
      checkInAt: log.checkInAt?.toISOString() ?? null,
      checkOutAt: log.checkOutAt?.toISOString() ?? null,
      checkInDistance: log.checkInDistance,
      checkOutDistance: log.checkOutDistance,
      checkInSite: { id: log.checkInSite.id, name: log.checkInSite.name, address: log.checkInSite.address },
      checkOutSite: log.checkOutSite ? { id: log.checkOutSite.id, name: log.checkOutSite.name } : null,
      adminNote: log.adminNote,
      isAutoCheckout: log.adminNote?.includes('[AUTO]') ?? false,
      exceptionReason: log.exceptionReason,
      moveEvents: log.events.map((e) => ({
        id: e.id,
        siteName: e.site?.name ?? '알 수 없음',
        occurredAt: e.occurredAt.toISOString(),
        distanceFromSite: e.distanceFromSite,
      })),
    })
  } catch (err) {
    console.error('[admin/attendance/[id] GET]', err)
    return internalError()
  }
}

const patchSchema = z.object({
  checkInAt: z.string().datetime({ offset: true }).optional(),
  checkOutAt: z.string().datetime({ offset: true }).optional(),
  status: z.nativeEnum(AttendanceStatus).optional(),
  adminNote: z.string().max(500).optional(),
})

/**
 * PATCH /api/admin/attendance/[id]
 * 출퇴근 기록 수정 (관리자)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, MUTATE_ROLES)
    if (deny) return deny

    const body = await request.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.issues[0].message)

    const { checkInAt, checkOutAt, status, adminNote } = parsed.data

    const log = await prisma.attendanceLog.findUnique({ where: { id: params.id } })
    if (!log) return notFound('출퇴근 기록을 찾을 수 없습니다.')

    const updatedLog = await prisma.attendanceLog.update({
      where: { id: params.id },
      data: {
        ...(checkInAt ? { checkInAt: new Date(checkInAt) } : {}),
        ...(checkOutAt ? { checkOutAt: new Date(checkOutAt) } : {}),
        status: status ?? (checkInAt || checkOutAt ? 'ADJUSTED' : log.status),
        adminNote: adminNote ?? log.adminNote,
      },
      include: { worker: { select: { name: true } }, checkInSite: { select: { name: true } } },
    })

    await writeAuditLog({
      adminId: session.sub,
      actionType: 'ADJUST_ATTENDANCE',
      targetType: 'AttendanceLog',
      targetId: params.id,
      description: `출퇴근 수정: ${updatedLog.worker.name} / ${updatedLog.checkInSite.name} / ${log.workDate.toISOString().slice(0, 10)}`,
    })

    return NextResponse.json({
      success: true,
      data: {
        id: updatedLog.id,
        status: updatedLog.status,
        checkInAt: updatedLog.checkInAt?.toISOString() ?? null,
        checkOutAt: updatedLog.checkOutAt?.toISOString() ?? null,
        adminNote: updatedLog.adminNote,
      },
    })
  } catch (err) {
    console.error('[admin/attendance/[id]]', err)
    return internalError()
  }
}
