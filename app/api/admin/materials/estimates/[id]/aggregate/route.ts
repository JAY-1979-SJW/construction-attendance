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
  const reviewOnly = searchParams.get('reviewOnly') === 'true'

  const where: Record<string, unknown> = { documentId: id }
  if (reviewOnly) where.reviewRequired = true

  const rows = await prisma.materialAggregateRow.findMany({
    where,
    select: {
      id:                 true,
      normalizedItemName: true,
      normalizedSpec:     true,
      normalizedUnit:     true,
      totalQuantity:      true,
      totalAmount:        true,
      sourceRowCount:     true,
      reviewRequired:     true,
      discipline:         true,
      itemCategory:       true,
      aggregationStatus:  true,
      manualOverrideUsed: true,
      confirmedBy:        true,
      confirmedAt:        true,
      regeneratedAt:      true,
      groupKey:           true,
    },
    orderBy: [{ discipline: 'asc' }, { normalizedItemName: 'asc' }],
  })

  // Decimal을 string으로 직렬화
  const serialized = rows.map(row => ({
    ...row,
    totalQuantity: String(row.totalQuantity),
    totalAmount:   row.totalAmount != null ? String(row.totalAmount) : null,
    confirmedAt:   row.confirmedAt ? row.confirmedAt.toISOString() : null,
    regeneratedAt: row.regeneratedAt ? row.regeneratedAt.toISOString() : null,
  }))

  return ok(serialized)
}
