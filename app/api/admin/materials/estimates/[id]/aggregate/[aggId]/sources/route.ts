import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { ok, unauthorized, notFound } from '@/lib/utils/response'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; aggId: string }> }
) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { id, aggId } = await params
  const aggRow = await prisma.materialAggregateRow.findFirst({
    where: { id: aggId, documentId: id },
    select: { sourceRowIdsJson: true },
  })
  if (!aggRow) return notFound('집계 행을 찾을 수 없습니다')

  let sourceRowIds: string[] = []
  if (aggRow.sourceRowIdsJson) {
    try { sourceRowIds = JSON.parse(aggRow.sourceRowIdsJson) } catch { sourceRowIds = [] }
  }

  if (sourceRowIds.length === 0) return ok([])

  const rows = await prisma.estimateBillRow.findMany({
    where: { id: { in: sourceRowIds } },
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
      overrides: {
        select: {
          id:          true,
          fieldName:   true,
          beforeValue: true,
          afterValue:  true,
          reason:      true,
          changedBy:   true,
          changedAt:   true,
        },
        orderBy: { changedAt: 'desc' },
      },
    },
    orderBy: [{ sheetName: 'asc' }, { rowNo: 'asc' }],
  })

  const serialized = rows.map(row => ({
    ...row,
    manualQuantity: row.manualQuantity != null ? String(row.manualQuantity) : null,
    overriddenAt:   row.overriddenAt ? row.overriddenAt.toISOString() : null,
    overrides:      row.overrides.map(o => ({
      ...o,
      changedAt: o.changedAt.toISOString(),
    })),
  }))

  return ok(serialized)
}
