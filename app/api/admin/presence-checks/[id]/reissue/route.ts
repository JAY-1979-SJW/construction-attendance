import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { ok, unauthorized, forbidden, badRequest, notFound, conflict, internalError } from '@/lib/utils/response'
import { logPresenceAudit } from '@/lib/attendance/presence-audit'

const MAX_REISSUE = 2

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    if (session.role === 'VIEWER') {
      await logPresenceAudit({ presenceCheckId: params.id, action: 'PERMISSION_DENIED', actorType: 'ADMIN', actorId: session.sub, message: 'VIEWER 역할 reissue 시도 차단' })
      return forbidden('조회 전용 계정은 이 작업을 수행할 수 없습니다.')
    }

    const body = await req.json().catch(() => ({}))
    const expiresInMinutes: number = body.expiresInMinutes ?? 10
    const reason: string = body.reason ?? '재확인 요청'

    if (expiresInMinutes < 2 || expiresInMinutes > 60) {
      return badRequest('INVALID_EXPIRES_MINUTES')
    }

    const [pc, adminUser] = await Promise.all([
      prisma.presenceCheck.findUnique({ where: { id: params.id } }),
      prisma.adminUser.findUnique({ where: { id: session.sub }, select: { name: true } }),
    ])
    const adminName = adminUser?.name ?? session.sub
    if (!pc) return notFound('NOT_FOUND')

    // Only allow reissue from REVIEW_REQUIRED or PENDING
    if (!['REVIEW_REQUIRED', 'PENDING', 'OUT_OF_GEOFENCE', 'NO_RESPONSE'].includes(pc.status)) {
      return conflict('CANNOT_REISSUE')
    }

    // Check reissue count limit
    if (pc.reissueCount >= MAX_REISSUE) {
      return conflict('MAX_REISSUE_EXCEEDED')
    }

    const now       = new Date()
    const expiresAt = new Date(now.getTime() + expiresInMinutes * 60 * 1000)
    const prevStatus = pc.status

    // 원자 업데이트: 동시 재확인 요청 또는 상태 변경 경합 방지
    const atomicResult = await prisma.presenceCheck.updateMany({
      where: {
        id:           pc.id,
        status:       { in: ['REVIEW_REQUIRED', 'PENDING', 'OUT_OF_GEOFENCE', 'NO_RESPONSE'] as never[] },
        reissueCount: { lt: MAX_REISSUE },
      },
      data: {
        status:         'PENDING' as never,
        scheduledAt:    now,
        expiresAt,
        respondedAt:    null,
        latitude:       null,
        longitude:      null,
        accuracyMeters: null,
        distanceMeters: null,
        needsReview:    false,
        reviewReason:   null,
        reissueCount:   { increment: 1 },
      },
    })

    if (atomicResult.count === 0) {
      return conflict('CANNOT_REISSUE')
    }

    await logPresenceAudit({
      presenceCheckId:   pc.id,
      action:            'ADMIN_REISSUED',
      actorType:         'ADMIN',
      actorId:           session.sub,
      actorNameSnapshot: adminName,
      fromStatus:        prevStatus,
      toStatus:          'PENDING',
      message:           `${reason} (만료: ${expiresInMinutes}분)`,
      metadata: { expiresInMinutes, reason },
    })

    return ok({
      status:            'PENDING',
      expiresAt:         expiresAt.toISOString(),
      reissueCount:      pc.reissueCount + 1,
    })
  } catch (err) {
    console.error('[admin/presence-checks/:id/reissue]', err)
    return internalError()
  }
}
