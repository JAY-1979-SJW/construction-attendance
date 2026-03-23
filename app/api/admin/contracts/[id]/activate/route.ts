import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { writeAdminAuditLog } from '@/lib/audit/write-audit-log'

// POST /api/admin/contracts/[id]/activate
// 기존 ACTIVE 계약 → ENDED 후 이 계약 → ACTIVE
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const contract = await prisma.workerContract.findUnique({ where: { id: params.id } })
  if (!contract) return NextResponse.json({ error: '계약 없음' }, { status: 404 })

  if (contract.contractStatus === 'ACTIVE') {
    return NextResponse.json({ error: '이미 활성 계약입니다.' }, { status: 400 })
  }
  if (contract.contractStatus === 'ENDED') {
    return NextResponse.json({ error: '종료된 계약은 다시 활성화할 수 없습니다.' }, { status: 400 })
  }

  // 같은 근로자의 기존 ACTIVE 계약 종료
  const prevActive = await prisma.workerContract.findFirst({
    where: { workerId: contract.workerId, contractStatus: 'ACTIVE', id: { not: params.id } },
  })

  await prisma.$transaction(async (tx) => {
    if (prevActive) {
      await tx.workerContract.update({
        where: { id: prevActive.id },
        data:  { contractStatus: 'ENDED' as never, isActive: false },
      })
    }
    await tx.workerContract.update({
      where: { id: params.id },
      data:  { contractStatus: 'ACTIVE' as never, isActive: true },
    })
  })

  await writeAdminAuditLog({
    adminId: session.sub, actionType: 'CONTRACT_ACTIVATE',
    targetType: 'WorkerContract', targetId: params.id,
    description: prevActive
      ? `기존 활성계약(${prevActive.id}) 종료 후 활성화`
      : '계약 활성화',
  })

  return NextResponse.json({ success: true, prevEndedId: prevActive?.id || null })
}
