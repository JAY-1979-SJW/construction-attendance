import { prisma } from '@/lib/db/prisma'
import type { OnboardingDocType, DocReviewAction } from '@prisma/client'
import { recalcWorkerDocumentPackage } from './recalc-package'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

export interface ReviewDocumentInput {
  workerId: string
  siteId: string | null
  docType: OnboardingDocType
  action: DocReviewAction
  reviewerId: string
  reason?: string
}

/**
 * 관리자가 문서를 승인/반려한다.
 * - 문서 상태를 APPROVED 또는 REJECTED로 변경
 * - 검토 이력(review) 생성
 * - CONTRACT 문서인 경우 계약 상태도 동기화
 * - 패키지 재계산
 */
export async function reviewWorkerDocument(input: ReviewDocumentInput) {
  const { workerId, siteId, docType, action, reviewerId, reason } = input

  const doc = siteId
    ? await prisma.onboardingDocument.findUnique({
        where: { workerId_siteId_docType: { workerId, siteId, docType } },
      })
    : await prisma.onboardingDocument.findFirst({
        where: { workerId, siteId: null, docType },
      })

  if (!doc) {
    throw new Error(`OnboardingDocument not found: ${workerId}/${siteId}/${docType}`)
  }

  if (doc.status !== 'SUBMITTED') {
    throw new Error(`문서가 검토 가능 상태가 아닙니다: 현재 ${doc.status}`)
  }

  const now = new Date()
  const newStatus = action === 'APPROVE' ? 'APPROVED' as const : 'REJECTED' as const

  await prisma.$transaction(async (tx) => {
    // 검토 이력 생성
    await tx.onboardingDocReview.create({
      data: {
        onboardingDocId: doc.id,
        submissionId: doc.latestSubmissionId,
        action,
        reviewerId,
        reason: reason ?? null,
      },
    })

    // 문서 상태 업데이트
    await tx.onboardingDocument.update({
      where: { id: doc.id },
      data: {
        status: newStatus,
        reviewedAt: now,
        reviewerId,
        ...(newStatus === 'APPROVED'
          ? { approvedAt: now }
          : { rejectedAt: now, rejectionReason: reason ?? null }),
      },
    })

    // CONTRACT 문서인 경우 계약 상태 동기화
    if (docType === 'CONTRACT' && doc.contractId) {
      const contractStatus = action === 'APPROVE' ? 'ACTIVE' : 'REJECTED'
      await tx.workerContract.update({
        where: { id: doc.contractId },
        data: {
          contractStatus,
          ...(contractStatus === 'ACTIVE'
            ? { approvedAt: now, approvedBy: reviewerId }
            : { rejectedAt: now, rejectedBy: reviewerId, rejectReason: reason }),
        },
      })
    }
  })

  // 패키지 재계산
  await recalcWorkerDocumentPackage(workerId, siteId)

  // 감사로그
  await writeAuditLog({
    actorUserId: reviewerId,
    actorType: 'ADMIN',
    actionType: action === 'APPROVE' ? 'ONBOARDING_DOC_APPROVED' : 'ONBOARDING_DOC_REJECTED',
    targetType: 'OnboardingDocument',
    targetId: doc.id,
    summary: `문서 ${action === 'APPROVE' ? '승인' : '반려'}: ${docType}`,
    reason,
    metadataJson: { docType, workerId },
  })

  return { docId: doc.id, status: newStatus }
}
