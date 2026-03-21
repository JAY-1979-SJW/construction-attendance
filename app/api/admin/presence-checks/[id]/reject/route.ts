import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { ok, unauthorized, notFound, conflict, internalError } from '@/lib/utils/response'
import { logPresenceAudit } from '@/lib/attendance/presence-audit'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { reason } = await req.json().catch(() => ({}))

    const [pc, adminUser] = await Promise.all([
      prisma.presenceCheck.findUnique({ where: { id: params.id } }),
      prisma.adminUser.findUnique({ where: { id: session.sub }, select: { name: true } }),
    ])
    if (!pc) return notFound('NOT_FOUND')
    if (pc.status !== 'REVIEW_REQUIRED') return conflict('NOT_REVIEW_REQUIRED')

    const adminName = adminUser?.name ?? session.sub
    const now = new Date()
    await prisma.presenceCheck.update({
      where: { id: pc.id },
      data: {
        status:       'MANUALLY_REJECTED' as never,
        reviewedBy:   adminName,
        reviewedAt:   now,
        needsReview:  false,
        reviewReason: reason ?? 'MANUALLY_REJECTED',
      },
    })

    await logPresenceAudit({
      presenceCheckId:   pc.id,
      action:            'ADMIN_REJECTED',
      actorType:         'ADMIN',
      actorId:           session.sub,
      actorNameSnapshot: adminName,
      fromStatus:        pc.status,
      toStatus:          'MANUALLY_REJECTED',
      message:           reason ?? '위치이탈 확정',
    })

    return ok({ status: 'MANUALLY_REJECTED', reviewedAt: now.toISOString() })
  } catch (err) {
    console.error('[admin/presence-checks/:id/reject]', err)
    return internalError()
  }
}
