import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/audit/write-audit-log'
import { unauthorized, badRequest, notFound, forbidden, internalError } from '@/lib/utils/response'

const patchSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  adminNote: z.string().max(500).optional(),
})

/**
 * PATCH /api/admin/exceptions/[id]
 * 예외 승인 또는 반려
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    if (session.role === 'VIEWER') return forbidden('처리 권한이 없습니다.')

    const body = await request.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.issues[0].message)

    const { action, adminNote } = parsed.data

    const log = await prisma.attendanceLog.findUnique({
      where: { id: params.id },
      include: { worker: { select: { name: true } }, checkInSite: { select: { name: true } } },
    })
    if (!log) return notFound('출퇴근 기록을 찾을 수 없습니다.')
    if (log.status !== 'EXCEPTION') return badRequest('예외 상태의 기록이 아닙니다.')

    const newStatus = action === 'APPROVE' ? 'ADJUSTED' : 'MISSING_CHECKOUT'

    const updated = await prisma.attendanceLog.update({
      where: { id: params.id },
      data: { status: newStatus, adminNote: adminNote ?? log.adminNote },
    })

    const actionType = action === 'APPROVE' ? 'APPROVE_EXCEPTION' : 'REJECT_EXCEPTION'
    await writeAuditLog({
      adminId: session.sub,
      actionType,
      targetType: 'AttendanceLog',
      targetId: params.id,
      description: `예외 ${action === 'APPROVE' ? '승인' : '반려'}: ${log.worker.name} / ${log.checkInSite.name}`,
    })

    return NextResponse.json({ success: true, data: { id: updated.id, status: updated.status } })
  } catch (err) {
    console.error('[admin/exceptions/[id]]', err)
    return internalError()
  }
}
