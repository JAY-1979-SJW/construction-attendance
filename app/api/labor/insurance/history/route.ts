import { NextRequest } from 'next/server'
import { requireCompanyAdmin } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, unauthorized, forbidden, internalError } from '@/lib/utils/response'

// GET /api/labor/insurance/history?month=YYYY-MM
export async function GET(req: NextRequest) {
  try {
    let session: Awaited<ReturnType<typeof requireCompanyAdmin>>
    try {
      session = await requireCompanyAdmin()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : ''
      return msg === 'UNAUTHORIZED' ? unauthorized() : forbidden()
    }

    const month = req.nextUrl.searchParams.get('month')
    const where: Record<string, unknown> = { companyId: session.companyId }
    if (month) where.monthKey = month

    const items = await prisma.insuranceSubmissionHistory.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        worker: { select: { id: true, name: true, jobTitle: true } },
      },
    })

    return ok(items)
  } catch (err) {
    console.error('[labor/insurance/history GET]', err)
    return internalError()
  }
}
