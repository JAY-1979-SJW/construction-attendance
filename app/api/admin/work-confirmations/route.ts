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
        worker: { select: { id: true, name: true, company: true, jobTitle: true, employmentType: true, incomeType: true } },
        site:   { select: { id: true, name: true } },
        attendanceDay: { select: { firstCheckInAt: true, lastCheckOutAt: true, presenceStatus: true } },
      },
      orderBy: [{ workDate: 'asc' }, { worker: { name: 'asc' } }],
    })

    // 월 집계 요약
    const summary = {
      total:     items.length,
      draft:     items.filter((i) => i.confirmationStatus === 'DRAFT').length,
      confirmed: items.filter((i) => i.confirmationStatus === 'CONFIRMED').length,
      excluded:  items.filter((i) => i.confirmationStatus === 'EXCLUDED').length,
      totalAmount: items.filter((i) => i.confirmationStatus === 'CONFIRMED')
                       .reduce((s, i) => s + i.confirmedTotalAmount, 0),
    }

    return ok({ items, summary, monthKey })
  } catch (err) {
    console.error('[work-confirmations GET]', err)
    return internalError()
  }
}
