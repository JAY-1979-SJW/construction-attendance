import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; aggregateId: string } }
) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const agg = await prisma.materialAggregateRow.findUnique({
    where: { id: params.aggregateId },
  })
  if (!agg || agg.documentId !== params.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let sourceIds: string[] = []
  try {
    sourceIds = agg.sourceRowIdsJson ? JSON.parse(agg.sourceRowIdsJson) : []
  } catch { sourceIds = [] }

  const rows = await prisma.estimateBillRow.findMany({
    where: { id: { in: sourceIds } },
    orderBy: [{ sheetName: 'asc' }, { rowNo: 'asc' }],
    include: { normalized: true },
  })

  return NextResponse.json({ success: true, data: rows })
}
