import { prisma } from '@/lib/db/prisma'
import type { OnboardingDocType, DocSubmitMethod } from '@prisma/client'
import { recalcWorkerDocumentPackage } from './recalc-package'
import { ensurePackageExists } from './ensure-package'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

export interface SubmitDocumentInput {
  workerId: string
  siteId: string | null
  docType: OnboardingDocType
  submitMethod: DocSubmitMethod
  fileId?: string
  signedDocumentUrl?: string
  sourcePayload?: Record<string, unknown>
  note?: string
}

/**
 * 근로자가 문서를 제출/재제출한다.
 * - 문서 상태를 SUBMITTED로 변경
 * - 제출 이력(submission) 생성
 * - 패키지 재계산
 */
export async function submitWorkerDocument(input: SubmitDocumentInput) {
  const { workerId, siteId, docType, submitMethod, fileId, signedDocumentUrl, sourcePayload, note } = input

  // 패키지 보장
  await ensurePackageExists(workerId, siteId)

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

  const now = new Date()
  const nextVersion = doc.versionNo + (doc.status === 'REJECTED' || doc.status === 'EXPIRED' ? 1 : 0)

  // 제출 이력의 다음 번호
  const lastSubmission = await prisma.onboardingDocSubmission.findFirst({
    where: { onboardingDocId: doc.id },
    orderBy: { submissionNo: 'desc' },
    select: { submissionNo: true },
  })
  const submissionNo = (lastSubmission?.submissionNo ?? 0) + 1

  // 트랜잭션: 문서 상태 업데이트 + 제출 이력 생성
  const submission = await prisma.$transaction(async (tx) => {
    const sub = await tx.onboardingDocSubmission.create({
      data: {
        onboardingDocId: doc.id,
        workerId,
        docType,
        submissionNo,
        statusSnapshot: 'SUBMITTED',
        submitMethod,
        fileId: fileId ?? null,
        signedDocumentUrl: signedDocumentUrl ?? null,
        sourcePayload: (sourcePayload ?? undefined) as any,
        submittedByWorkerId: workerId,
        submittedAt: now,
        note: note ?? null,
      },
    })

    await tx.onboardingDocument.update({
      where: { id: doc.id },
      data: {
        status: 'SUBMITTED',
        versionNo: nextVersion,
        submittedAt: now,
        rejectedAt: null,
        rejectionReason: null,
        latestSubmissionId: sub.id,
      },
    })

    return sub
  })

  // 패키지 재계산
  await recalcWorkerDocumentPackage(workerId, siteId)

  // 감사로그
  await writeAuditLog({
    actorUserId: workerId,
    actorType: 'WORKER',
    actionType: 'ONBOARDING_DOC_SUBMITTED',
    targetType: 'OnboardingDocument',
    targetId: doc.id,
    summary: `문서 제출: ${docType} (제출 #${submissionNo})`,
    metadataJson: { docType, submissionNo, submitMethod },
  })

  return submission
}
