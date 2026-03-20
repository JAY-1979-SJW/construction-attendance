import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminSession, requireRole, MUTATE_ROLES } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/audit/write-audit-log'
import { unauthorized, badRequest, notFound, internalError } from '@/lib/utils/response'
import { AttendanceStatus } from '@prisma/client'

const patchSchema = z.object({
  checkInAt: z.string().datetime().optional(),
  checkOutAt: z.string().datetime().optional(),
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
