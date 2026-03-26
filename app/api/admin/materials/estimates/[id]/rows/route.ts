import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { ok, unauthorized, notFound } from '@/lib/utils/response'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { id } = await params
  const doc = await prisma.estimateDocument.findUnique({
    where: { id },
    select: { id: true },
  })
  if (!doc) return notFound('내역서를 찾을 수 없습니다')

  const { searchParams } = req.nextUrl
  const sheetId         = searchParams.get('sheetId') ?? ''
  const rowType         = searchParams.get('rowType') ?? ''
  const reviewOnly      = searchParams.get('reviewOnly') === 'true'
  const excludedOnly    = searchParams.get('excludedOnly') === 'true'
  const overriddenOnly  = searchParams.get('overriddenOnly') === 'true'
  const hasManualGroupKey = searchParams.get('hasManualGroupKey') === 'true'
  const page            = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const pageSize        = Math.min(100, parseInt(searchParams.get('pageSize') ?? '50', 10))

  const where: Record<string, unknown> = { documentId: id }
  if (sheetId) where.sheetId = sheetId
  if (rowType) where.rowType = rowType
  if (reviewOnly) where.reviewRequired = true
  if (excludedOnly) where.excludeFromAggregation = true
  if (overriddenOnly) where.overriddenAt = { not: null }
  if (hasManualGroupKey) where.manualGroupKey = { not: null }

  const [total, items] = await Promise.all([
    prisma.estimateBillRow.count({ where }),
    prisma.estimateBillRow.findMany({
      where,
      select: {
        id:                    true,
        rowNo:                 true,
        rowType:               true,
        sheetName:             true,
        sectionName:           true,
        rawItemName:           true,
        rawSpec:               true,
        rawUnit:               true,
        rawQuantity:           true,
        rawAmount:             true,
        aggregateCandidate:    true,
        reviewRequired:        true,
        reviewReasonsJson:     true,
        parseConfidence:       true,
        manualItemName:        true,
        manualSpec:            true,
        manualUnit:            true,
        manualQuantity:        true,
        manualGroupKey:        true,
        excludeFromAggregation: true,
        overrideReason:        true,
        overriddenAt:          true,
        normalized: {
          select: {
            normalizedItemName: true,
            normalizedSpec:     true,
            normalizedUnit:     true,
            groupKey:           true,
          },
        },
      },
      orderBy: [{ sheetId: 'asc' }, { rowNo: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  // manualQuantity를 string으로 직렬화 (Decimal → string)
  const serialized = items.map(row => ({
    ...row,
    manualQuantity: row.manualQuantity != null ? String(row.manualQuantity) : null,
    overriddenAt:   row.overriddenAt ? row.overriddenAt.toISOString() : null,
  }))

  return ok({ items: serialized, total, page, pageSize, totalPages: Math.ceil(total / pageSize) })
}
