import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getWorkerSession } from '@/lib/auth/guards'
import { isWithinRadius } from '@/lib/gps/distance'
import { ok, unauthorized, badRequest, forbidden, notFound, conflict, internalError } from '@/lib/utils/response'
import { logPresenceAudit } from '@/lib/attendance/presence-audit'

// POST /api/attendance/presence/respond
export async function POST(req: NextRequest) {
  try {
    const session = await getWorkerSession()
    if (!session) return unauthorized()

    const body = await req.json()
    const { presenceCheckId, latitude, longitude, accuracy } = body

    // 1. GPS 유효성 검사
    if (latitude == null || longitude == null) {
      return badRequest('GPS_REQUIRED')
    }
    if (
      typeof latitude !== 'number' || typeof longitude !== 'number' ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180
    ) {
      return badRequest('INVALID_COORDINATES')
    }

    // 2. PresenceCheck 조회 (site 포함)
    const pc = await prisma.presenceCheck.findUnique({
      where: { id: presenceCheckId },
      include: { site: true },
    })
    if (!pc) return notFound('PRESENCE_CHECK_NOT_FOUND')

    // 3. 본인 건인지 확인
    if (pc.workerId !== session.sub) return forbidden('FORBIDDEN')

    // 4. 상태 확인 (이미 응답된 건)
    if (pc.status !== 'PENDING') {
      const expiredStatuses = ['MISSED', 'NO_RESPONSE']
      return conflict(
        expiredStatuses.includes(pc.status) ? 'PRESENCE_CHECK_EXPIRED' : 'PRESENCE_CHECK_NOT_PENDING'
      )
    }

    // 5. 만료 확인
    const now = new Date()
    if (pc.expiresAt && pc.expiresAt < now) {
      // 만료 상태로 갱신 (NO_RESPONSE로 통일)
      await prisma.presenceCheck.update({
        where: { id: pc.id },
        data:  { status: 'NO_RESPONSE' as never, closedAt: now },
      })
      await logPresenceAudit({
        presenceCheckId: pc.id,
        action:          'AUTO_EXPIRED',
        actorType:       'SYSTEM',
        fromStatus:      'PENDING',
        toStatus:        'NO_RESPONSE',
        message:         '근로자 응답 시도 시점 만료 확인',
      })
      return conflict('PRESENCE_CHECK_EXPIRED')
    }

    // 6. 현장 기준 거리 계산
    const radius = pc.appliedRadiusMeters ?? pc.site.allowedRadius
    const { within, distance } = isWithinRadius(
      latitude, longitude,
      pc.site.latitude, pc.site.longitude,
      radius,
    )

    // 7. REVIEW_REQUIRED 분류 (경계값 or GPS 정확도 불량)
    const boundaryMargin = 20  // 반경 초과분이 20m 이하면 경계 케이스
    const poorAccuracy   = typeof accuracy === 'number' && accuracy >= 80

    let newStatus: string
    let reviewReason: string | null = null

    if (poorAccuracy) {
      // GPS 정확도 불량이면 반경 내/외 무관하게 검토 대상 (위치 신뢰 불가)
      newStatus    = 'REVIEW_REQUIRED'
      reviewReason = 'LOW_GPS_ACCURACY'
    } else if (within) {
      newStatus = 'COMPLETED'
    } else if ((distance - radius) <= boundaryMargin) {
      newStatus    = 'REVIEW_REQUIRED'
      reviewReason = 'BOUNDARY_CASE'
    } else {
      newStatus = 'OUT_OF_GEOFENCE'
    }

    const markReview = newStatus === 'REVIEW_REQUIRED'

    // 8. 원자 업데이트 — 만료 배치와의 경합 방지
    // WHERE 조건에 status/respondedAt/expiresAt을 포함해 배치가 먼저 처리한 건은 count=0으로 감지
    const atomicResult = await prisma.presenceCheck.updateMany({
      where: {
        id:          pc.id,
        status:      'PENDING',
        respondedAt: null,
        expiresAt:   { gte: now },
      },
      data: {
        status:         newStatus as never,
        respondedAt:    now,
        latitude,
        longitude,
        accuracyMeters: accuracy ?? null,
        distanceMeters: distance,
        needsReview:    markReview,
        reviewReason,
      },
    })

    if (atomicResult.count === 0) {
      // 배치가 먼저 NO_RESPONSE로 확정하거나 다른 탭이 먼저 응답한 경우
      return conflict('PRESENCE_CHECK_EXPIRED')
    }

    // 감사 로그
    await logPresenceAudit({
      presenceCheckId:   pc.id,
      action:            `AUTO_CLASSIFIED_${newStatus}`,
      actorType:         'WORKER',
      actorId:           session.sub,
      fromStatus:        'PENDING',
      toStatus:          newStatus,
      message:           `거리 ${Math.round(distance)}m / 반경 ${radius}m / accuracy ${accuracy ?? '-'}m`,
      metadata: {
        distanceMeters:  distance,
        radiusMeters:    radius,
        accuracyMeters:  accuracy ?? null,
        latitude,
        longitude,
        reviewReason,
      },
    })

    console.info('[presence] responded', {
      presenceCheckId: pc.id,
      workerId:        session.sub,
      status:          newStatus,
      distanceMeters:  distance,
      radiusMeters:    radius,
    })

    return ok({
      status:              newStatus,
      distanceMeters:      distance,
      allowedRadiusMeters: radius,
      respondedAt:         now.toISOString(),
    })
  } catch (err) {
    console.error('[presence/respond]', err)
    return internalError()
  }
}
