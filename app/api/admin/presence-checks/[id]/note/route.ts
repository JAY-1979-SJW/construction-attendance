import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { ok, unauthorized, badRequest, notFound, internalError } from '@/lib/utils/response'
import { logPresenceAudit } from '@/lib/attendance/presence-audit'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { note } = await req.json().catch(() => ({}))
    if (typeof note !== 'string') return badRequest('NOTE_REQUIRED')

    const pc = await prisma.presenceCheck.findUnique({ where: { id: params.id } })
    if (!pc) return notFound('NOT_FOUND')

    await prisma.presenceCheck.update({
      where: { id: pc.id },
      data:  { adminNote: note.trim() || null },
    })

    await logPresenceAudit({
      presenceCheckId:   pc.id,
      action:            'ADMIN_NOTE_UPDATED',
      actorType:         'ADMIN',
      actorId:           session.sub,
      actorNameSnapshot: session.sub,
      message:           note.trim().slice(0, 100),
    })

    await writeAuditLog({
      actorUserId: session.sub,
      actorType: 'ADMIN',
      actionType: 'PRESENCE_CHECK_NOTE',
      targetType: 'PresenceCheck',
      targetId: pc.id,
      summary: `재실확인 관리자 메모 수정`,
      metadataJson: { presenceCheckId: pc.id, note: note.trim().slice(0, 100) },
    })

    return ok({ adminNote: note.trim() || null })
  } catch (err) {
    console.error('[admin/presence-checks/:id/note]', err)
    return internalError()
  }
}
