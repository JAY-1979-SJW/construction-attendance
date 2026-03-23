import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'

type AggStatus = 'DRAFT' | 'REVIEWED' | 'CONFIRMED'

// PATCH /api/admin/materials/estimates/[id]/aggregate/[aggregateId]/status
// 집계 상태 변경: DRAFT → REVIEWED → CONFIRMED, 또는 확정 해제(CONFIRMED → REVIEWED)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; aggregateId: string } }
) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const agg = await prisma.materialAggregateRow.findUnique({ where: { id: params.aggregateId } })
  if (!agg || agg.documentId !== params.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { status } = await req.json() as { status: AggStatus }
  const validStatuses: AggStatus[] = ['DRAFT', 'REVIEWED', 'CONFIRMED']
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: '유효하지 않은 상태입니다' }, { status: 400 })
  }

  const adminId = (session as { id?: string; email?: string }).id ?? (session as { id?: string; email?: string }).email ?? 'admin'
  const now = new Date()

  const updated = await prisma.materialAggregateRow.update({
    where: { id: params.aggregateId },
    data: {
      aggregationStatus: status,
      ...(status === 'CONFIRMED' ? { confirmedBy: adminId, confirmedAt: now } : {}),
      ...(status !== 'CONFIRMED' ? { confirmedBy: null, confirmedAt: null } : {}),
    },
  })

  return NextResponse.json({ success: true, data: updated })
}
