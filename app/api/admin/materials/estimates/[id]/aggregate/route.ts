import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { AggregationStatus } from '@prisma/client'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const discipline = searchParams.get('discipline') ?? undefined
  const reviewOnly = searchParams.get('reviewOnly') === 'true'
  const aggStatus = searchParams.get('status') ?? undefined // DRAFT | REVIEWED | CONFIRMED

  const where = {
    documentId: params.id,
    ...(discipline ? { discipline } : {}),
    ...(reviewOnly ? { reviewRequired: true } : {}),
    ...(aggStatus ? { aggregationStatus: aggStatus as AggregationStatus } : {}),
  }

  const items = await prisma.materialAggregateRow.findMany({
    where,
    orderBy: [{ discipline: 'asc' }, { itemCategory: 'asc' }, { normalizedItemName: 'asc' }],
  })

  return NextResponse.json({ success: true, data: items })
}
