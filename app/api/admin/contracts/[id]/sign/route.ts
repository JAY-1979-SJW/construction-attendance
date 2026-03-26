/**
 * POST /api/admin/contracts/[id]/sign
 * 계약서 서명 처리: signedAt, signedBy 기록 + 상태 SIGNED로 변경 + 버전 스냅샷 생성
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession, canAccessSite, siteAccessDenied } from '@/lib/auth/guards'
import { writeAdminAuditLog } from '@/lib/audit/write-audit-log'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const contract = await prisma.workerContract.findUnique({
    where: { id: params.id },
    include: { worker: { select: { id: true, name: true } } },
  })
  if (!contract) return NextResponse.json({ error: '계약 없음' }, { status: 404 })
  if (contract.siteId && !await canAccessSite(session, contract.siteId)) return siteAccessDenied()
  if (contract.signedAt) {
    return NextResponse.json({ error: '이미 서명된 계약서입니다' }, { status: 409 })
  }

  const body = await req.json().catch(() => ({}))
  const { signedBy, signedDocId } = body as { signedBy?: string; signedDocId?: string }

  const now = new Date()

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.workerContract.update({
      where: { id: params.id },
      data: {
        signedAt: now,
        signedBy: signedBy || contract.worker.name,
        contractStatus: 'ACTIVE',
        isActive: true,
      },
    })

    // 버전 스냅샷 업데이트 (현재 버전에 signedDocId 기록)
    if (signedDocId) {
      await tx.contractVersion.updateMany({
        where: { contractId: params.id, versionNo: contract.currentVersion },
        data: { signedDocId },
      })
    }

    return result
  })

  await writeAdminAuditLog({
    adminId: session.sub,
    actionType: 'CONTRACT_SIGN',
    targetType: 'WorkerContract',
    targetId: params.id,
    description: `계약서 서명 완료: ${contract.worker.name}`,
  })

  return NextResponse.json({ success: true, data: { signedAt: now } })
}
