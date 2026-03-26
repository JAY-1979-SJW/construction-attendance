import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, unauthorized, internalError } from '@/lib/utils/response'

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { searchParams } = new URL(req.url)
    const monthKey = searchParams.get('monthKey')
    const siteId = searchParams.get('siteId')

    if (!monthKey) return NextResponse.json({ error: 'monthKey required' }, { status: 400 })

    const summaries = await prisma.retirementMutualMonthlySummary.findMany({
      where: { monthKey, ...(siteId ? { siteId } : {}) },
      include: {
        worker: { select: { id: true, name: true } },
        site: { select: { id: true, name: true } },
      },
      orderBy: [{ siteId: 'asc' }, { workerId: 'asc' }],
    })

    return ok({ items: summaries })
  } catch (err) {
    console.error('[retirement-mutual/monthly GET]', err)
    return internalError()
  }
}
