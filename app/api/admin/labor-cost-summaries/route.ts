import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'

export async function GET(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const monthKey = searchParams.get('monthKey')
  const siteId = searchParams.get('siteId')
  const organizationType = searchParams.get('organizationType')

  if (!monthKey) return NextResponse.json({ error: 'monthKey required' }, { status: 400 })

  const summaries = await prisma.laborCostSummary.findMany({
    where: {
      monthKey,
      ...(siteId ? { siteId } : {}),
      ...(organizationType ? { organizationType: organizationType as never } : {}),
    },
    include: {
      site: { select: { id: true, name: true } },
      company: { select: { id: true, companyName: true } },
    },
    orderBy: [{ siteId: 'asc' }, { organizationType: 'asc' }],
  })

  // 합계 계산
  const totals = summaries.reduce((acc, s) => ({
    workerCount: acc.workerCount + s.workerCount,
    grossAmount: acc.grossAmount + s.grossAmount,
    taxableAmount: acc.taxableAmount + s.taxableAmount,
    withholdingTaxAmount: acc.withholdingTaxAmount + s.withholdingTaxAmount,
    retirementMutualTargetDays: acc.retirementMutualTargetDays + s.retirementMutualTargetDays,
  }), { workerCount: 0, grossAmount: 0, taxableAmount: 0, withholdingTaxAmount: 0, retirementMutualTargetDays: 0 })

  return NextResponse.json({ summaries, totals })
}
