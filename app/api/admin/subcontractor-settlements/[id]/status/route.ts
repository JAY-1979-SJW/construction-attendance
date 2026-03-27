import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

const VALID_STATUSES = ['DRAFT', 'REVIEW_REQUIRED', 'CONFIRMED', 'HOLD']

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { status, reviewNote } = body

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'INVALID_STATUS' }, { status: 400 })
  }

  const before = await prisma.companySettlement.findUnique({ where: { id: params.id } })

  const updated = await prisma.companySettlement.update({
    where: { id: params.id },
    data: {
      status,
      reviewNote,
      ...(status === 'CONFIRMED' ? { confirmedAt: new Date(), confirmedBy: session.sub } : {}),
    },
  })

  await writeAuditLog({
    actorUserId: session.sub,
    actorType: 'ADMIN',
    actorRole: session.role,
    actionType: 'SUBCONTRACTOR_SETTLEMENT_STATUS_UPDATE',
    targetType: 'CompanySettlement',
    targetId: params.id,
    summary: `하도급 정산 상태 변경: ${before?.status ?? '?'} → ${status}`,
    beforeJson: { status: before?.status, reviewNote: before?.reviewNote },
    afterJson: { status, reviewNote },
  })

  return NextResponse.json({ settlement: updated })
}
