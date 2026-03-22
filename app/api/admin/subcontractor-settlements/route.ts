import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'

export async function GET(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const monthKey = searchParams.get('monthKey')
  const siteId = searchParams.get('siteId')
  const companyId = searchParams.get('companyId') ?? searchParams.get('subcontractorId')

  if (!monthKey) return NextResponse.json({ error: 'monthKey required' }, { status: 400 })

  const settlements = await prisma.companySettlement.findMany({
    where: {
      monthKey,
      ...(siteId ? { siteId } : {}),
      ...(companyId ? { companyId } : {}),
    },
    include: {
      site: { select: { id: true, name: true } },
      company: { select: { id: true, companyName: true, businessNumber: true } },
    },
    orderBy: [{ siteId: 'asc' }, { companyId: 'asc' }],
  })

  const totals = settlements.reduce((acc, s) => ({
    workerCount: acc.workerCount + s.workerCount,
    grossAmount: acc.grossAmount + s.grossAmount,
    taxAmount: acc.taxAmount + s.taxAmount,
    finalPayableAmount: acc.finalPayableAmount + s.finalPayableAmount,
  }), { workerCount: 0, grossAmount: 0, taxAmount: 0, finalPayableAmount: 0 })

  return NextResponse.json({ settlements, totals })
}
