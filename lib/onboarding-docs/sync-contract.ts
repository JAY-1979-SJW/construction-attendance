import { prisma } from '@/lib/db/prisma'
import type { ContractStatus, OnboardingDocStatus } from '@prisma/client'
import { ensurePackageExists } from './ensure-package'
import { recalcWorkerDocumentPackage } from './recalc-package'

/**
 * 계약 상태 변경 시 onboarding_documents(CONTRACT)와 동기화한다.
 * 계약 API에서 승인/반려/서명 등의 상태 변경 후 반드시 호출할 것.
 */
export async function syncContractDocumentStatus(contractId: string): Promise<void> {
  const contract = await prisma.workerContract.findUnique({
    where: { id: contractId },
    select: { id: true, workerId: true, siteId: true, contractStatus: true },
  })

  if (!contract) return

  const siteId = contract.siteId ?? null

  // 패키지와 문서가 존재하는지 확인, 없으면 생성
  await ensurePackageExists(contract.workerId, siteId)

  // 계약 상태 → 문서 상태 매핑
  const statusMap: Record<ContractStatus, OnboardingDocStatus> = {
    DRAFT: 'NOT_SUBMITTED',
    SIGNED: 'SUBMITTED',           // 레거시
    REVIEW_REQUESTED: 'SUBMITTED',
    ACTIVE: 'APPROVED',
    REJECTED: 'REJECTED',
    ENDED: 'APPROVED',             // 종료된 계약은 문서 반려가 아님
  }

  const docStatus = statusMap[contract.contractStatus]

  const now = new Date()
  const updateData: Record<string, unknown> = {
    status: docStatus,
    contractId: contract.id,
  }

  if (docStatus === 'SUBMITTED') {
    updateData.submittedAt = now
  } else if (docStatus === 'APPROVED') {
    updateData.approvedAt = now
    updateData.reviewedAt = now
  } else if (docStatus === 'REJECTED') {
    updateData.rejectedAt = now
    updateData.reviewedAt = now
  }

  await prisma.onboardingDocument.updateMany({
    where: {
      workerId: contract.workerId,
      ...(siteId ? { siteId } : { siteId: null }),
      docType: 'CONTRACT',
    },
    data: updateData as any,
  })

  // 패키지 집계 재계산
  await recalcWorkerDocumentPackage(contract.workerId, siteId)
}
