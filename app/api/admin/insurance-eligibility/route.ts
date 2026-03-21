import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { ok, unauthorized, internalError } from '@/lib/utils/response'

// GET /api/admin/insurance-eligibility?monthKey=YYYY-MM&filter=all|eligible|ineligible|review
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { searchParams } = new URL(req.url)
    const monthKey = searchParams.get('monthKey') ?? ''
    const filter   = searchParams.get('filter')   ?? 'all'

    if (!monthKey) return ok({ items: [] })

    let whereExtra = {}
    if (filter === 'eligible')   whereExtra = { nationalPensionEligible: true }
    if (filter === 'ineligible') whereExtra = { nationalPensionEligible: false }

    const items = await prisma.insuranceEligibilitySnapshot.findMany({
      where: { monthKey, ...whereExtra },
      include: {
        worker: { select: { id: true, name: true, company: true, employmentType: true, incomeType: true } },
      },
      orderBy: { worker: { name: 'asc' } },
    })

    return ok({ items, total: items.length, monthKey })
  } catch (err) {
    console.error('[insurance-eligibility GET]', err)
    return internalError()
  }
}
