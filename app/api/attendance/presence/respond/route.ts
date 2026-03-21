import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getWorkerSession } from '@/lib/auth/guards'
import { isWithinRadius } from '@/lib/gps/distance'
import { ok, unauthorized, badRequest, forbidden, notFound, conflict, internalError } from '@/lib/utils/response'

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
      return conflict(
        pc.status === 'MISSED' ? 'PRESENCE_CHECK_EXPIRED' : 'PRESENCE_CHECK_NOT_PENDING'
      )
    }

    // 5. 만료 확인
    const now = new Date()
    if (pc.expiresAt && pc.expiresAt < now) {
      // 만료 상태로 갱신
      await prisma.presenceCheck.update({
        where: { id: pc.id },
        data:  { status: 'MISSED', needsReview: pc.needsReview },
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

    const newStatus = within ? 'COMPLETED' : 'OUT_OF_GEOFENCE'

    // failureNeedsReview 설정 조회
    const settings = await prisma.appSettings.findUnique({ where: { id: 'singleton' } })
    const markReview = !within && (settings?.presenceCheckFailureNeedsReview ?? true)

    // 7. 결과 저장
    const updated = await prisma.presenceCheck.update({
      where: { id: pc.id },
      data: {
        status:        newStatus,
        respondedAt:   now,
        latitude,
        longitude,
        accuracyMeters: accuracy ?? null,
        distanceMeters: distance,
        needsReview:   markReview,
        reviewReason:  markReview ? 'OUT_OF_GEOFENCE' : null,
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
      status:              updated.status,
      distanceMeters:      distance,
      allowedRadiusMeters: radius,
      respondedAt:         updated.respondedAt?.toISOString(),
    })
  } catch (err) {
    console.error('[presence/respond]', err)
    return internalError()
  }
}
