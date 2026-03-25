import { NextRequest } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, unauthorized, badRequest, internalError } from '@/lib/utils/response'

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { searchParams } = new URL(req.url)
    const monthKey = searchParams.get('monthKey')
    const siteId = searchParams.get('siteId')
    const organizationType = searchParams.get('organizationType')

    if (!monthKey) return badRequest('monthKey required')

    const summaries = await prisma.laborCostSummary.findMany({
      where: {
        monthKey,
        ...(siteId ? { siteId } : {}),
        ...(organizationType ? { organizationType: organizationType as never } : {}),
      },
      include: {
        site:    { select: { id: true, name: true } },
        company: { select: { id: true, companyName: true } },
      },
      orderBy: [{ siteId: 'asc' }, { organizationType: 'asc' }],
    })

    const items = summaries.map((s) => ({
      id:                   s.id,
      siteName:             s.site.name,
      siteId:               s.siteId,
      orgType:              s.organizationType,
      companyName:          s.company?.companyName ?? '—',
      workerCount:          s.workerCount,
      mandays:              Number(s.confirmedWorkUnits),
      totalWage:            s.grossAmount,
      taxableAmount:        s.taxableAmount,
      withholdingTax:       s.withholdingTaxAmount,
      npTargetCount:        s.nationalPensionTargetCount,
      hiTargetCount:        s.healthInsuranceTargetCount,
      eiTargetCount:        s.employmentInsuranceTargetCount,
      retirementMutualDays: s.retirementMutualTargetDays,
    }))

    const totals = {
      workerCount:    items.reduce((a, r) => a + r.workerCount, 0),
      mandays:        Math.round(items.reduce((a, r) => a + r.mandays, 0) * 100) / 100,
      totalWage:      items.reduce((a, r) => a + r.totalWage, 0),
      withholdingTax: items.reduce((a, r) => a + r.withholdingTax, 0),
    }

    return ok({ items, totals })
  } catch (err) {
    console.error('[labor-cost-summaries/GET]', err)
    return internalError()
  }
}
