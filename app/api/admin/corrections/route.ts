import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'

export async function GET(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const domainType = searchParams.get('domainType')
  const actedBy = searchParams.get('actedBy')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const page = parseInt(searchParams.get('page') ?? '1')
  const pageSize = parseInt(searchParams.get('pageSize') ?? '50')

  const logs = await prisma.correctionLog.findMany({
    where: {
      ...(domainType ? { domainType: domainType as never } : {}),
      ...(actedBy ? { actedBy } : {}),
      ...(from || to ? {
        actedAt: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(to) } : {}),
        },
      } : {}),
    },
    orderBy: { actedAt: 'desc' },
    skip: (page - 1) * pageSize,
    take: pageSize,
  })

  const total = await prisma.correctionLog.count({
    where: {
      ...(domainType ? { domainType: domainType as never } : {}),
      ...(actedBy ? { actedBy } : {}),
    },
  })

  return NextResponse.json({ logs, total, page, pageSize })
}
