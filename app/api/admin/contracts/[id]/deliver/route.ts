/**
 * POST /api/admin/contracts/[id]/deliver
 * 계약서 교부 처리: deliveredAt, deliveredMethod 기록 + ISSUED 상태
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession, canAccessSite, siteAccessDenied } from '@/lib/auth/guards'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const contract = await prisma.workerContract.findUnique({
    where: { id: params.id },
    include: { worker: { select: { name: true } } },
  })
  if (!contract) return NextResponse.json({ error: '계약 없음' }, { status: 404 })
  if (contract.siteId && !await canAccessSite(session, contract.siteId)) return siteAccessDenied()
  if (!contract.signedAt) {
    return NextResponse.json({ error: '서명 완료 후 교부 가능합니다' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const { deliveredMethod, deliveredDocId } = body as {
    deliveredMethod?: 'EMAIL' | 'KAKAO' | 'PAPER' | 'APP'
    deliveredDocId?: string
  }

  const now = new Date()

  await prisma.$transaction(async (tx) => {
    await tx.workerContract.update({
      where: { id: params.id },
      data: {
        deliveredAt: now,
        deliveredMethod: deliveredMethod || 'APP',
      },
    })

    if (deliveredDocId) {
      await tx.contractVersion.updateMany({
        where: { contractId: params.id, versionNo: contract.currentVersion },
        data: { deliveredDocId },
      })
    }

    // 교부된 문서 상태 업데이트
    if (deliveredDocId) {
      await tx.generatedDocument.update({
        where: { id: deliveredDocId },
        data: { status: 'ISSUED' },
      })
    }
  })

  void writeAuditLog({
    actorUserId: session.sub, actorType: 'ADMIN',
    actionType: 'CONTRACT_DELIVER',
    targetType: 'WorkerContract',
    targetId: params.id,
    summary: `계약서 교부: ${contract.worker.name} / ${deliveredMethod || 'APP'}`,
  })

  return NextResponse.json({ success: true, data: { deliveredAt: now, deliveredMethod } })
}
