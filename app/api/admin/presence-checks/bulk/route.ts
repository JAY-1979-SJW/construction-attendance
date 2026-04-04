import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession, requireFeature } from '@/lib/auth/guards'
import { ok, unauthorized, badRequest, internalError } from '@/lib/utils/response'
import { logPresenceAudit } from '@/lib/attendance/presence-audit'

/**
 * POST /api/admin/presence-checks/bulk
 * Body: { ids: string[], action: 'confirm' | 'reject', reason?: string }
 * Response: { succeeded: number, failed: number, failedItems: { id, reason }[] }
 *
 * REVIEW_REQUIRED 상태인 항목만 처리. 이미 처리된 항목은 failed로 반환.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const denyFeature = requireFeature(session, 'ATTENDANCE_APPROVE')
    if (denyFeature) return denyFeature

    const body = await req.json().catch(() => null)
    if (!body || !Array.isArray(body.ids) || !body.ids.length) {
      return badRequest('ids 배열이 필요합니다')
    }

    const action: 'confirm' | 'reject' = body.action
    if (action !== 'confirm' && action !== 'reject') {
      return badRequest('action은 confirm 또는 reject 이어야 합니다')
    }

    const reason: string | undefined = body.reason || undefined
    const ids: string[] = body.ids

    const adminUser = await prisma.adminUser.findUnique({
      where: { id: session.sub },
      select: { name: true },
    })
    const adminName = adminUser?.name ?? session.sub
    const now = new Date()

    // 1. FK 선조회 원칙 — ids 전체 조회
    const pcs = await prisma.presenceCheck.findMany({
      where: { id: { in: ids } },
      select: { id: true, status: true },
    })
    const pcMap = new Map(pcs.map((p) => [p.id, p]))

    const succeeded: string[] = []
    const failedItems: { id: string; reason: string }[] = []

    for (const id of ids) {
      const pc = pcMap.get(id)
      if (!pc) { failedItems.push({ id, reason: 'NOT_FOUND' }); continue }
      if (pc.status !== 'REVIEW_REQUIRED') { failedItems.push({ id, reason: 'NOT_REVIEW_REQUIRED' }); continue }

      if (action === 'confirm') {
        const result = await prisma.presenceCheck.updateMany({
          where: { id: pc.id, status: 'REVIEW_REQUIRED' },
          data: {
            status:      'MANUALLY_CONFIRMED' as never,
            reviewedBy:  adminName,
            reviewedAt:  now,
            needsReview: false,
          },
        })
        if (result.count === 0) { failedItems.push({ id, reason: 'CONCURRENT_UPDATE' }); continue }

        await logPresenceAudit({
          presenceCheckId:   pc.id,
          action:            'ADMIN_CONFIRMED',
          actorType:         'ADMIN',
          actorId:           session.sub,
          actorNameSnapshot: adminName,
          fromStatus:        pc.status,
          toStatus:          'MANUALLY_CONFIRMED',
          message:           '대량 승인',
        })
      } else {
        const result = await prisma.presenceCheck.updateMany({
          where: { id: pc.id, status: 'REVIEW_REQUIRED' },
          data: {
            status:       'MANUALLY_REJECTED' as never,
            reviewedBy:   adminName,
            reviewedAt:   now,
            needsReview:  false,
            reviewReason: reason ?? 'MANUALLY_REJECTED',
          },
        })
        if (result.count === 0) { failedItems.push({ id, reason: 'CONCURRENT_UPDATE' }); continue }

        await logPresenceAudit({
          presenceCheckId:   pc.id,
          action:            'ADMIN_REJECTED',
          actorType:         'ADMIN',
          actorId:           session.sub,
          actorNameSnapshot: adminName,
          fromStatus:        pc.status,
          toStatus:          'MANUALLY_REJECTED',
          message:           reason ?? '위치이탈 확정 (대량)',
        })
      }
      succeeded.push(id)
    }

    return ok({ succeeded: succeeded.length, failed: failedItems.length, failedItems })
  } catch (err) {
    console.error('[admin/presence-checks/bulk]', err)
    return internalError()
  }
}
