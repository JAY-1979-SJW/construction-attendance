/**
 * POST /api/admin/workers/[id]/documents/batch-approve
 * 근로자 문서 일괄 승인 + 투입 확정
 * SUBMITTED 상태 문서를 한번에 APPROVED로 변경
 */
import { NextRequest } from 'next/server'
import { getAdminSession, requireRole, MUTATE_ROLES } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, unauthorized, notFound, badRequest, internalError } from '@/lib/utils/response'
import { recalcWorkerDocumentPackage } from '@/lib/onboarding-docs'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, MUTATE_ROLES)
    if (deny) return deny

    const { id: workerId } = await params
    const body = await req.json().catch(() => ({}))
    const { siteId } = body

    const worker = await prisma.worker.findUnique({
      where: { id: workerId },
      select: { id: true, name: true },
    })
    if (!worker) return notFound('근로자를 찾을 수 없습니다.')

    // SUBMITTED 상태 문서 일괄 조회
    const where: Record<string, unknown> = {
      workerId,
      status: 'SUBMITTED',
    }
    if (siteId) where.siteId = siteId

    const pendingDocs = await prisma.onboardingDocument.findMany({
      where: where as any,
      select: { id: true, docType: true, packageId: true, siteId: true },
    })

    if (pendingDocs.length === 0) {
      return badRequest('승인 대기 중인 문서가 없습니다.')
    }

    // 일괄 APPROVED 처리
    const now = new Date()
    await prisma.onboardingDocument.updateMany({
      where: { id: { in: pendingDocs.map(d => d.id) } },
      data: {
        status: 'APPROVED',
        approvedAt: now,
        reviewedAt: now,
        reviewerId: session.sub,
      },
    })

    // 각 리뷰 기록 생성
    for (const doc of pendingDocs) {
      await prisma.onboardingDocReview.create({
        data: {
          onboardingDocId: doc.id,
          submissionId: null,
          reviewerId: session.sub,
          action: 'APPROVE',
        },
      })
    }

    // 패키지 재계산
    const packageIds = Array.from(new Set(pendingDocs.map(d => d.packageId)))
    for (const pkgId of packageIds) {
      const pkg = await prisma.workerDocumentPackage.findUnique({
        where: { id: pkgId },
        select: { workerId: true, siteId: true },
      })
      if (pkg) await recalcWorkerDocumentPackage(pkg.workerId, pkg.siteId)
    }

    // 알림 생성
    await prisma.workerNotification.create({
      data: {
        workerId,
        type: 'DOC_APPROVED',
        title: '서류 일괄 승인',
        body: `${pendingDocs.length}건의 서류가 승인되었습니다.`,
      },
    }).catch(() => {})

    await writeAuditLog({
      actorUserId: session.sub,
      actorType: 'ADMIN',
      actionType: 'DOCUMENT_BATCH_APPROVE',
      targetType: 'Worker',
      targetId: workerId,
      summary: `문서 일괄 승인: ${worker.name} — ${pendingDocs.length}건 (${pendingDocs.map(d => d.docType).join(', ')})`,
    })

    return ok({
      approved: pendingDocs.length,
      docTypes: pendingDocs.map(d => d.docType),
    }, `${pendingDocs.length}건의 서류가 일괄 승인되었습니다.`)
  } catch (err) {
    console.error('[workers/documents/batch-approve]', err)
    return internalError()
  }
}
