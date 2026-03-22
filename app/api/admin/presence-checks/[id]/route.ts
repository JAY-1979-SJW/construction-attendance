import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { ok, unauthorized, notFound, internalError } from '@/lib/utils/response'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const pc = await prisma.presenceCheck.findUnique({
      where: { id: params.id },
      include: {
        worker: { select: { id: true, name: true, phone: true } },
        site:   { select: { id: true, name: true, address: true, latitude: true, longitude: true, allowedRadius: true } },
        auditLogs: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    })
    if (!pc) return notFound('NOT_FOUND')

    return ok({
      id:                  pc.id,
      checkDate:           pc.checkDate,
      timeBucket:          pc.timeBucket,
      status:              pc.status,
      scheduledAt:         pc.scheduledAt.toISOString(),
      expiresAt:           pc.expiresAt?.toISOString() ?? null,
      respondedAt:         pc.respondedAt?.toISOString() ?? null,
      closedAt:            (pc as never as { closedAt: Date | null }).closedAt?.toISOString() ?? null,
      // Location
      siteLat:             pc.site.latitude,
      siteLng:             pc.site.longitude,
      siteAddress:         pc.site.address,
      responseLat:         pc.latitude,
      responseLng:         pc.longitude,
      accuracyMeters:      pc.accuracyMeters,
      distanceMeters:      pc.distanceMeters,
      allowedRadiusMeters: pc.appliedRadiusMeters ?? pc.site.allowedRadius,
      // Worker
      workerId:            pc.worker.id,
      workerName:          pc.worker.name,
      workerCompany:       '',
      workerPhone:         pc.worker.phone,
      // Site
      siteId:              pc.site.id,
      siteName:            pc.site.name,
      // Review
      needsReview:         pc.needsReview,
      reviewReason:        pc.reviewReason,
      reviewedBy:          pc.reviewedBy,
      reviewedAt:          pc.reviewedAt?.toISOString() ?? null,
      adminNote:           pc.adminNote,
      reissueCount:        pc.reissueCount,
      reissuedFromId:      (pc as never as { reissuedFromId: string | null }).reissuedFromId,
      // Audit
      auditLogs: pc.auditLogs.map((l) => ({
        id:                l.id,
        action:            l.action,
        actorType:         l.actorType,
        actorNameSnapshot: l.actorNameSnapshot,
        fromStatus:        l.fromStatus,
        toStatus:          l.toStatus,
        message:           l.message,
        createdAt:         l.createdAt.toISOString(),
      })),
    })
  } catch (err) {
    console.error('[admin/presence-checks/:id]', err)
    return internalError()
  }
}
