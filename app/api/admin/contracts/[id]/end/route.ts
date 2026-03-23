import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { writeAdminAuditLog } from '@/lib/audit/write-audit-log'

// POST /api/admin/contracts/[id]/end
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const contract = await prisma.workerContract.findUnique({ where: { id: params.id } })
  if (!contract) return NextResponse.json({ error: '계약 없음' }, { status: 404 })

  if (contract.contractStatus === 'ENDED') {
    return NextResponse.json({ error: '이미 종료된 계약입니다.' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const endDate = body.endDate || new Date().toISOString().slice(0, 10)

  await prisma.workerContract.update({
    where: { id: params.id },
    data:  {
      contractStatus: 'ENDED' as never,
      isActive:       false,
      endDate,
    },
  })

  await writeAdminAuditLog({
    adminId: session.sub, actionType: 'CONTRACT_END',
    targetType: 'WorkerContract', targetId: params.id,
    description: `계약 종료 처리 (종료일: ${endDate})`,
  })

  return NextResponse.json({ success: true, endDate })
}
