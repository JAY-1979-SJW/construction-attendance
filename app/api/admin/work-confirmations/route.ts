import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { ok, unauthorized, internalError } from '@/lib/utils/response'

// GET /api/admin/work-confirmations?monthKey=YYYY-MM&siteId=&workerId=&status=
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { searchParams } = new URL(req.url)
    const monthKey  = searchParams.get('monthKey') ?? ''
    const siteId    = searchParams.get('siteId')   ?? undefined
    const workerId  = searchParams.get('workerId') ?? undefined
    const status    = searchParams.get('status')   ?? undefined

    if (!monthKey) return ok({ items: [], total: 0 })

    const items = await prisma.monthlyWorkConfirmation.findMany({
      where: {
        monthKey,
        ...(siteId   ? { siteId }   : {}),
        ...(workerId ? { workerId } : {}),
        ...(status   ? { confirmationStatus: status as never } : {}),
      },
      include: {
        worker: { select: { id: true, name: true, jobTitle: true, employmentType: true, incomeType: true } },
        site:   { select: { id: true, name: true } },
        attendanceDay: { select: { firstCheckInAt: true, lastCheckOutAt: true, presenceStatus: true, manualAdjustedYn: true } },
      },
      orderBy: [{ workDate: 'asc' }, { worker: { name: 'asc' } }],
    })

    // DRAFT 항목만 우선순위 정렬 적용 (비위험 순→위험 순→수동조정 하단, 동순위는 updatedAt desc)
    function draftPriority(item: typeof items[0]): number {
      if (item.attendanceDay?.manualAdjustedYn) return 90
      const ps = item.attendanceDay?.presenceStatus
      if (ps === 'REVIEW_REQUIRED')  return 10
      if (ps === 'OUT_OF_GEOFENCE')  return 20
      if (ps === 'NO_RESPONSE')      return 30
      const wt = item.confirmedWorkType
      if (wt === 'INVALID')          return 40
      if (wt === 'HALF_DAY')         return 50
      return 60
    }

    const sorted = status === 'DRAFT'
      ? [...items].sort((a, b) => {
          const diff = draftPriority(a) - draftPriority(b)
          if (diff !== 0) return diff
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        })
      : items

    // 월 집계 요약
    const summary = {
      total:     items.length,
      draft:     items.filter((i) => i.confirmationStatus === 'DRAFT').length,
      confirmed: items.filter((i) => i.confirmationStatus === 'CONFIRMED').length,
      excluded:  items.filter((i) => i.confirmationStatus === 'EXCLUDED').length,
      totalAmount: items.filter((i) => i.confirmationStatus === 'CONFIRMED')
                       .reduce((s, i) => s + i.confirmedTotalAmount, 0),
    }

    return ok({ items: sorted, summary, monthKey })
  } catch (err) {
    console.error('[work-confirmations GET]', err)
    return internalError()
  }
}
