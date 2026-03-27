/**
 * GET /api/my/documents
 * 내 문서 패키지 상태 요약 반환 (근로자 모바일용)
 */
import { prisma } from '@/lib/db/prisma'
import { getWorkerSession } from '@/lib/auth/guards'
import { ok, unauthorized } from '@/lib/utils/response'
import { ensurePackageExists, DOC_TYPE_LABELS, recalcWorkerDocumentPackage } from '@/lib/onboarding-docs'

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

  // 패키지 보장 + 만료 자동 감지를 위한 recalc
  await ensurePackageExists(workerId, siteId)
  await recalcWorkerDocumentPackage(workerId, siteId)

  // siteId가 null인 경우 findFirst 사용 (Prisma unique 쿼리는 nullable 필드에 null 직접 전달 불가)
  const pkgInclude = {
    site: { select: { id: true, name: true } },
    onboardingDocs: {
      orderBy: { docType: 'asc' as const },
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
  }
  const pkg = siteId
    ? await prisma.workerDocumentPackage.findUnique({
        where: { workerId_siteId: { workerId, siteId } },
        include: pkgInclude,
      })
    : await prisma.workerDocumentPackage.findFirst({
        where: { workerId, siteId: null },
        include: pkgInclude,
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
      expiredDocCount: pkg.expiredDocCount,
      site: pkg.site,
    },
    documents,
  })
}
