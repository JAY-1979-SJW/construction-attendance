import { prisma } from '@/lib/db/prisma'
import type { DocPackageOverallStatus } from '@prisma/client'

/**
 * 근로자 문서 패키지의 집계 컬럼과 overallStatus를 재계산한다.
 * 문서 상태가 변경될 때마다 호출해야 한다.
 */
export async function recalcWorkerDocumentPackage(
  workerId: string,
  siteId: string | null,
): Promise<void> {
  const pkg = siteId
    ? await prisma.workerDocumentPackage.findUnique({
        where: { workerId_siteId: { workerId, siteId } },
        include: { onboardingDocs: true },
      })
    : await prisma.workerDocumentPackage.findFirst({
        where: { workerId, siteId: null },
        include: { onboardingDocs: true },
      })

  if (!pkg) return

  const docs = pkg.onboardingDocs.filter((d) => d.status !== 'NOT_REQUIRED')
  const requiredCount = docs.length

  let approved = 0
  let rejected = 0
  let pending = 0 // SUBMITTED
  let missing = 0 // NOT_SUBMITTED
  let expired = 0

  for (const doc of docs) {
    switch (doc.status) {
      case 'APPROVED':
        approved++
        break
      case 'REJECTED':
        rejected++
        break
      case 'SUBMITTED':
        pending++
        break
      case 'EXPIRED':
        expired++
        break
      case 'NOT_SUBMITTED':
      default:
        missing++
        break
    }
  }

  // 상태 계산 규칙 (우선순위 순)
  let overallStatus: DocPackageOverallStatus
  if (rejected > 0) {
    overallStatus = 'REJECTED'
  } else if (expired > 0) {
    overallStatus = 'EXPIRED'
  } else if (missing > 0) {
    overallStatus = 'NOT_READY'
  } else if (pending > 0) {
    overallStatus = 'UNDER_REVIEW'
  } else if (approved === requiredCount && requiredCount > 0) {
    overallStatus = 'READY'
  } else {
    overallStatus = 'NOT_READY'
  }

  const now = new Date()

  await prisma.workerDocumentPackage.update({
    where: { id: pkg.id },
    data: {
      overallStatus,
      requiredDocCount: requiredCount,
      approvedDocCount: approved,
      rejectedDocCount: rejected,
      pendingDocCount: pending,
      missingDocCount: missing,
      expiredDocCount: expired,
      readyAt: overallStatus === 'READY' ? (pkg.readyAt ?? now) : null,
    },
  })
}
