import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getWorkerSession } from '@/lib/auth/guards'
import { ok, unauthorized, internalError } from '@/lib/utils/response'
import { toKSTDateString } from '@/lib/utils/date'

// GET /api/attendance/presence/my-pending
// 본인 기준 오늘 PENDING 체류확인 1건 반환 (없으면 item: null)
export async function GET(_req: NextRequest) {
  try {
    const session = await getWorkerSession()
    if (!session) return unauthorized()

    const today = toKSTDateString()
    const now   = new Date()

    const pc = await prisma.presenceCheck.findFirst({
      where: {
        workerId:  session.sub,
        checkDate: today,
        status:    'PENDING',
        expiresAt: { gte: now },  // 만료된 PENDING은 배치 전이라도 노출하지 않음
      },
      orderBy:  { scheduledAt: 'asc' },
      select: {
        id:                  true,
        timeBucket:          true,
        checkDate:           true,
        scheduledAt:         true,
        expiresAt:           true,
        appliedRadiusMeters: true,
        site: { select: { name: true, address: true } },
      },
    })

    if (!pc) return ok({ item: null })

    return ok({
      item: {
        id:              pc.id,
        timeBucket:      pc.timeBucket,
        checkDate:       pc.checkDate,
        siteName:        pc.site.name,
        siteAddress:     pc.site.address,
        scheduledAt:     pc.scheduledAt.toISOString(),
        expiresAt:       pc.expiresAt?.toISOString() ?? null,
        radiusMeters:    pc.appliedRadiusMeters ?? 30,
      },
    })
  } catch (err) {
    console.error('[presence/my-pending]', err)
    return internalError()
  }
}
