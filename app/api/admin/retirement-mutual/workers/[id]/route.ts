import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  const updated = await prisma.retirementMutualWorker.update({
    where: { id: params.id },
    data: body,
  })

  await writeAuditLog({
    actorUserId: session.sub,
    actorType: 'ADMIN',
    actorRole: session.role,
    actionType: 'RETIREMENT_MUTUAL_WORKER_UPDATE',
    targetType: 'RetirementMutualWorker',
    targetId: params.id,
    summary: `퇴직공제 근로자 정보 변경: ${params.id}`,
  })

  return NextResponse.json({ worker: updated })
}
