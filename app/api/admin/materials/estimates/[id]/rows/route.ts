import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const discipline = searchParams.get('discipline') ?? undefined
  const sheetId = searchParams.get('sheetId') ?? undefined
  const rowType = searchParams.get('rowType') ?? undefined
  const reviewOnly = searchParams.get('reviewOnly') === 'true'
  const candidateOnly = searchParams.get('candidateOnly') === 'true'
  const unmappedOnly = searchParams.get('unmappedOnly') === 'true'
  const excludedOnly = searchParams.get('excludedOnly') === 'true'
  const overriddenOnly = searchParams.get('overriddenOnly') === 'true'
  const hasManualGroupKey = searchParams.get('hasManualGroupKey') === 'true'
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const pageSize = 100

  const where: Record<string, unknown> = {
    documentId: params.id,
    ...(discipline ? { discipline } : {}),
    ...(sheetId ? { sheetId } : {}),
    ...(rowType ? { rowType } : {}),
    ...(reviewOnly ? { reviewRequired: true } : {}),
    ...(candidateOnly ? { aggregateCandidate: true } : {}),
    ...(excludedOnly ? { excludeFromAggregation: true } : {}),
    ...(overriddenOnly ? { overriddenAt: { not: null } } : {}),
    ...(hasManualGroupKey ? { manualGroupKey: { not: null } } : {}),
    ...(unmappedOnly ? {
      normalized: { normalizationSource: 'UNMAPPED' }
    } : {}),
  }

  const [total, items] = await Promise.all([
    prisma.estimateBillRow.count({ where }),
    prisma.estimateBillRow.findMany({
      where,
      orderBy: [{ sheetName: 'asc' }, { rowNo: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { normalized: true },
    }),
  ])

  return NextResponse.json({ success: true, data: { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) } })
}
