/**
 * GET /api/my/documents
 * 내 문서 패키지 상태 요약 반환 (근로자 모바일용)
 */
import { prisma } from '@/lib/db/prisma'
import { getWorkerSession } from '@/lib/auth/guards'
import { ok, unauthorized } from '@/lib/utils/response'
import { ensurePackageExists, DOC_TYPE_LABELS } from '@/lib/onboarding-docs'

export async function GET() {
  const session = await getWorkerSession()
  if (!session) return unauthorized()

  const workerId = session.sub

  // 가장 최근 활성 계약에서 siteId 가져오기
  const activeContract = await prisma.workerContract.findFirst({
    where: { workerId, contractStatus: { in: ['ACTIVE', 'REVIEW_REQUESTED', 'DRAFT'] } },
    orderBy: { createdAt: 'desc' },
    select: { siteId: true },
  })

  const siteId = activeContract?.siteId ?? null

  // 패키지 보장
  await ensurePackageExists(workerId, siteId)

  const pkg = await prisma.workerDocumentPackage.findUnique({
    where: { workerId_siteId: { workerId, siteId: siteId ?? '' } },
    include: {
      site: { select: { id: true, name: true } },
      onboardingDocs: {
        orderBy: { docType: 'asc' },
        select: {
          id: true,
          docType: true,
          status: true,
          title: true,
          rejectionReason: true,
          submittedAt: true,
          approvedAt: true,
          rejectedAt: true,
          expiresAt: true,
          versionNo: true,
        },
      },
    },
  })

  if (!pkg) return ok({ package: null, documents: [] })

  // 문서별 라벨 보강
  const documents = pkg.onboardingDocs.map((doc) => ({
    ...doc,
    label: DOC_TYPE_LABELS[doc.docType] ?? doc.docType,
  }))

  return ok({
    package: {
      id: pkg.id,
      overallStatus: pkg.overallStatus,
      requiredDocCount: pkg.requiredDocCount,
      approvedDocCount: pkg.approvedDocCount,
      rejectedDocCount: pkg.rejectedDocCount,
      pendingDocCount: pkg.pendingDocCount,
      missingDocCount: pkg.missingDocCount,
      site: pkg.site,
    },
    documents,
  })
}
