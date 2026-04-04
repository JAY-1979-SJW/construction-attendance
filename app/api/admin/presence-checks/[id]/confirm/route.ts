import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession, requireFeature } from '@/lib/auth/guards'
import { ok, unauthorized, forbidden, notFound, conflict, internalError } from '@/lib/utils/response'
import { logPresenceAudit } from '@/lib/attendance/presence-audit'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    // feature permission 검사 — ATTENDANCE_APPROVE 없는 역할 차단
    const denyFeature = requireFeature(session, 'ATTENDANCE_APPROVE')
    if (denyFeature) {
      await logPresenceAudit({ presenceCheckId: params.id, action: 'PERMISSION_DENIED', actorType: 'ADMIN', actorId: session.sub, message: `${session.role} 역할 confirm 시도 차단 (ATTENDANCE_APPROVE 권한 없음)` })
      return denyFeature
    }

    const { note } = await req.json().catch(() => ({}))

    const [pc, adminUser] = await Promise.all([
      prisma.presenceCheck.findUnique({ where: { id: params.id } }),
      prisma.adminUser.findUnique({ where: { id: session.sub }, select: { name: true } }),
    ])
    if (!pc) return notFound('NOT_FOUND')
    if (pc.status !== 'REVIEW_REQUIRED') return conflict('NOT_REVIEW_REQUIRED')

    const adminName = adminUser?.name ?? session.sub
    const now = new Date()

    // 원자 업데이트: 관리자 2명 동시 판정 시 한 명만 성공
    const atomicResult = await prisma.presenceCheck.updateMany({
      where: { id: pc.id, status: 'REVIEW_REQUIRED' },
      data: {
        status:      'MANUALLY_CONFIRMED' as never,
        reviewedBy:  adminName,
        reviewedAt:  now,
        needsReview: false,
        ...(note ? { adminNote: note } : {}),
      },
    })

    if (atomicResult.count === 0) {
      // 다른 관리자가 동시에 이미 처리한 경우
      return conflict('NOT_REVIEW_REQUIRED')
    }

    await logPresenceAudit({
      presenceCheckId:   pc.id,
      action:            'ADMIN_CONFIRMED',
      actorType:         'ADMIN',
      actorId:           session.sub,
      actorNameSnapshot: adminName,
      fromStatus:        pc.status,
      toStatus:          'MANUALLY_CONFIRMED',
      message:           note ?? '정상 승인',
    })

    return ok({ status: 'MANUALLY_CONFIRMED', reviewedAt: now.toISOString() })
  } catch (err) {
    console.error('[admin/presence-checks/:id/confirm]', err)
    return internalError()
  }
}
