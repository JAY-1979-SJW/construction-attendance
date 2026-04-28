/**
 * POST /api/admin/contracts/[id]/sign
 * 계약서 서명 처리: signedAt, signedBy 기록 + 상태 REVIEW_REQUESTED로 변경 (검토 대기)
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession, canAccessSite, siteAccessDenied } from '@/lib/auth/guards'
import { writeAuditLog } from '@/lib/audit/write-audit-log'
import { syncContractDocumentStatus } from '@/lib/onboarding-docs'

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

  // DRAFT 또는 REJECTED 상태에서만 서명 가능
  if (contract.contractStatus !== 'DRAFT' && contract.contractStatus !== 'REJECTED') {
    return NextResponse.json({ error: '서명 가능한 상태가 아닙니다 (DRAFT 또는 REJECTED만 가능)' }, { status: 409 })
  }

  const body = await req.json().catch(() => ({}))
  const { signedBy, signedDocId } = body as { signedBy?: string; signedDocId?: string }

  const now = new Date()

  await prisma.$transaction(async (tx) => {
    await tx.workerContract.update({
      where: { id: params.id },
      data: {
        signedAt: now,
        signedBy: signedBy || contract.worker.name,
        contractStatus: 'REVIEW_REQUESTED',
      },
    })

    if (signedDocId) {
      await tx.contractVersion.updateMany({
        where: { contractId: params.id, versionNo: contract.currentVersion },
        data: { signedDocId },
      })
    }
  })

  // 문서 패키지 동기화
  await syncContractDocumentStatus(params.id)

  void writeAuditLog({
    actorUserId: session.sub, actorType: 'ADMIN',
    actionType: 'CONTRACT_SIGN',
    targetType: 'WorkerContract',
    targetId: params.id,
    summary: `계약서 서명 → 검토 대기: ${contract.worker.name}`,
  })

  return NextResponse.json({ success: true, data: { signedAt: now, contractStatus: 'REVIEW_REQUESTED' } })
}
