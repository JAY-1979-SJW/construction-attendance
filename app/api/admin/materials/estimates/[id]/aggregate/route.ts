import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const discipline = searchParams.get('discipline') ?? undefined

  const where = {
    documentId: params.id,
    ...(discipline ? { discipline } : {}),
  }

  const items = await prisma.materialAggregateRow.findMany({
    where,
    orderBy: [{ discipline: 'asc' }, { itemCategory: 'asc' }, { normalizedItemName: 'asc' }],
  })

  return NextResponse.json({ success: true, data: items })
}
