/**
 * POST /api/admin/labor-count/review/[id]/confirm
 * 공수 항목 확정 (DRAFT → CONFIRMED)
 *
 * 권한: ADMIN 이상
 * body (optional override):
 *  - workUnits: number (0.5 | 1.0 | ...)
 *  - note: string
 */
import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession, requireRole } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { unauthorized, notFound, badRequest } from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const roleErr = requireRole(session, ['SUPER_ADMIN', 'ADMIN'])
    if (roleErr) return roleErr

    const { id } = await params

    const conf = await prisma.monthlyWorkConfirmation.findUnique({
      where: { id },
      include: { worker: { select: { name: true } } },
    })
    if (!conf) return notFound('공수 확인 항목을 찾을 수 없습니다.')
    if (conf.confirmationStatus === 'CONFIRMED') {
      return NextResponse.json({ success: true, message: '이미 확정된 항목입니다.', id })
    }

    const body = await req.json().catch(() => ({}))
    const workUnits: number | undefined = body.workUnits
    const note: string | undefined      = body.note

    if (workUnits !== undefined && (isNaN(workUnits) || workUnits < 0 || workUnits > 3)) {
      return badRequest('workUnits는 0 이상 3 이하의 숫자여야 합니다.')
    }

    // 확정 시 공수 override 적용 가능
    await prisma.monthlyWorkConfirmation.update({
      where: { id },
      data: {
        confirmationStatus: 'CONFIRMED',
        ...(workUnits !== undefined ? { confirmedWorkUnits: workUnits } : {}),
      },
    })

    await writeAuditLog({
      actorUserId: session.sub,
      actorRole:   session.role,
      companyId:   undefined,
      actionType:  'ADMIN_ADJUSTMENT',
      targetType:  'WORK_CONFIRMATION',
      targetId:    id,
      summary:     `공수 확정 — ${conf.worker.name} ${conf.workDate}${workUnits !== undefined ? ` (공수 ${workUnits})` : ''}${note ? `: ${note}` : ''}`,
    })

    return NextResponse.json({ success: true, id })
  } catch (err) {
    console.error('[POST /labor-count/review/[id]/confirm]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
