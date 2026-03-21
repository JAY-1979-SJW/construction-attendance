import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { ok, unauthorized, internalError } from '@/lib/utils/response'
import { toKSTDateString } from '@/lib/utils/date'

// GET /api/admin/attendance/presence-checks?date=2026-03-21
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date') ?? toKSTDateString()

    const items = await prisma.presenceCheck.findMany({
      where: { checkDate: date },
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
        needsReview:     true,
        reviewReason:    true,
        worker: { select: { name: true, company: true } },
        site:   { select: { name: true } },
      },
    })

    const result = items.map((pc) => ({
      id:             pc.id,
      workerName:     pc.worker.name,
      workerCompany:  pc.worker.company,
      siteName:       pc.site.name,
      slot:           pc.timeBucket,
      checkDate:      pc.checkDate,
      scheduledAt:    pc.scheduledAt.toISOString(),
      expiresAt:      pc.expiresAt?.toISOString() ?? null,
      status:         pc.status,
      respondedAt:    pc.respondedAt?.toISOString() ?? null,
      distanceMeters: pc.distanceMeters,
      needsReview:    pc.needsReview,
      reviewReason:   pc.reviewReason,
    }))

    return ok({ date, count: result.length, items: result })
  } catch (err) {
    console.error('[admin/presence-checks]', err)
    return internalError()
  }
}
