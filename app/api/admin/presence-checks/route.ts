import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession, buildSiteScopeWhere, canAccessSite, siteAccessDeniedWithLog } from '@/lib/auth/guards'
import { ok, unauthorized, internalError } from '@/lib/utils/response'
import { toKSTDateString } from '@/lib/utils/date'

// GET /api/admin/presence-checks?date=&status=&siteId=&workerName=&onlyNeedsReview=&onlyNoResponse=
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { searchParams } = new URL(req.url)
    const date            = searchParams.get('date') ?? toKSTDateString()
    const status          = searchParams.get('status') ?? undefined
    const siteId          = searchParams.get('siteId') ?? undefined
    const workerName      = searchParams.get('workerName') ?? undefined
    const onlyNeedsReview = searchParams.get('onlyNeedsReview') === 'true'
    const onlyNoResponse  = searchParams.get('onlyNoResponse') === 'true'

    // ── site scope 강제 ──────────────────────────────────────────────────────
    let siteScopeFilter: Record<string, unknown> = {}
    if (siteId) {
      if (!await canAccessSite(session, siteId)) return siteAccessDeniedWithLog(session, siteId)
      siteScopeFilter = { siteId }
    } else {
      const scope = await buildSiteScopeWhere(session)
      if (scope === false) return ok({ items: [], summary: { total: 0, completed: 0, pending: 0, noResponse: 0, needsReview: 0 } })
      siteScopeFilter = scope as Record<string, unknown>
    }
    // ────────────────────────────────────────────────────────────────────────

    const items = await prisma.presenceCheck.findMany({
      where: {
        ...siteScopeFilter,
        checkDate: date,
        ...(status          ? { status: status as never }  : {}),
        ...(onlyNeedsReview ? { needsReview: true }        : {}),
        ...(onlyNoResponse  ? { status: 'NO_RESPONSE' as never } : {}),
        ...(workerName      ? { worker: { name: { contains: workerName, mode: 'insensitive' as never } } } : {}),
      },
      orderBy: [{ scheduledAt: 'asc' }],
      select: {
        id:              true,
        checkDate:       true,
        timeBucket:      true,
        scheduledAt:     true,
        expiresAt:       true,
        status:          true,
        respondedAt:     true,
        distanceMeters:  true,
        accuracyMeters:  true,
        needsReview:     true,
        reviewReason:    true,
        adminNote:       true,
        reviewedBy:      true,
        reviewedAt:      true,
        reissueCount:    true,
        worker: { select: { id: true, name: true } },
        site:   { select: { id: true, name: true } },
      },
    })

    const result = items.map((pc) => ({
      id:             pc.id,
      workerId:       pc.worker.id,
      workerName:     pc.worker.name,
      workerCompany:  '',
      siteId:         pc.site.id,
      siteName:       pc.site.name,
      slot:           pc.timeBucket,
      checkDate:      pc.checkDate,
      scheduledAt:    pc.scheduledAt.toISOString(),
      expiresAt:      pc.expiresAt?.toISOString() ?? null,
      status:         pc.status,
      respondedAt:    pc.respondedAt?.toISOString() ?? null,
      distanceMeters: pc.distanceMeters,
      accuracyMeters: pc.accuracyMeters,
      needsReview:    pc.needsReview,
      reviewReason:   pc.reviewReason,
      adminNote:      pc.adminNote,
      reviewedBy:     pc.reviewedBy,
      reviewedAt:     pc.reviewedAt?.toISOString() ?? null,
      reissueCount:   pc.reissueCount,
    }))

    // Summary counts
    const summary = {
      total:       result.length,
      completed:   result.filter((i) => i.status === 'COMPLETED' || i.status === 'MANUALLY_CONFIRMED').length,
      pending:     result.filter((i) => i.status === 'PENDING').length,
      noResponse:  result.filter((i) => i.status === 'NO_RESPONSE' || i.status === 'MISSED').length,
      outOfFence:  result.filter((i) => i.status === 'OUT_OF_GEOFENCE' || i.status === 'MANUALLY_REJECTED').length,
      review:      result.filter((i) => i.status === 'REVIEW_REQUIRED').length,
      needsReview: result.filter((i) => i.needsReview).length,
    }

    return ok({ date, summary, count: result.length, items: result })
  } catch (err) {
    console.error('[admin/presence-checks]', err)
    return internalError()
  }
}
