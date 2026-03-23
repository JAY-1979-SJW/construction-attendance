import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'

type AggStatus = 'DRAFT' | 'REVIEWED' | 'CONFIRMED'

// PATCH /api/admin/materials/estimates/[id]/aggregate/status
// 이 문서의 모든 집계행 상태를 일괄 변경
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const doc = await prisma.estimateDocument.findUnique({ where: { id: params.id }, select: { id: true } })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { status } = await req.json() as { status: AggStatus }
  const validStatuses: AggStatus[] = ['DRAFT', 'REVIEWED', 'CONFIRMED']
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: '유효하지 않은 상태입니다' }, { status: 400 })
  }

  const adminId = (session as { id?: string; email?: string }).id ?? (session as { id?: string; email?: string }).email ?? 'admin'
  const now = new Date()

  const result = await prisma.materialAggregateRow.updateMany({
    where: { documentId: params.id },
    data: {
      aggregationStatus: status,
      ...(status === 'CONFIRMED' ? { confirmedBy: adminId, confirmedAt: now } : {}),
      ...(status !== 'CONFIRMED' ? { confirmedBy: null, confirmedAt: null } : {}),
    },
  })

  return NextResponse.json({ success: true, data: { updatedCount: result.count } })
}
