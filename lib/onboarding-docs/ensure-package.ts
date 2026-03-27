import { prisma } from '@/lib/db/prisma'
import { REQUIRED_DOC_TYPES, DOC_TYPE_LABELS } from './constants'
import type { WorkerDocumentPackage } from '@prisma/client'

/**
 * 근로자의 문서 패키지가 없으면 생성하고 5종 문서 row도 함께 초기화한다.
 * 이미 존재하면 기존 패키지를 반환한다.
 */
export async function ensurePackageExists(
  workerId: string,
  siteId: string | null,
): Promise<WorkerDocumentPackage> {
  // siteId가 null인 경우 findFirst 사용 (Prisma unique 쿼리는 nullable 필드에 null 직접 전달 불가)
  const existing = siteId
    ? await prisma.workerDocumentPackage.findUnique({
        where: { workerId_siteId: { workerId, siteId } },
      })
    : await prisma.workerDocumentPackage.findFirst({
        where: { workerId, siteId: null },
      })

  if (existing) return existing

  // 패키지 + 5종 문서 생성 (트랜잭션)
  return prisma.$transaction(async (tx) => {
    const pkg = await tx.workerDocumentPackage.create({
      data: {
        workerId,
        siteId: siteId || null,
        scope: siteId ? 'SITE' : 'GLOBAL',
      },
    })

    for (const docType of REQUIRED_DOC_TYPES) {
      await tx.onboardingDocument.create({
        data: {
          workerId,
          siteId: siteId || null,
          packageId: pkg.id,
          docType,
          title: DOC_TYPE_LABELS[docType],
        },
      })
    }

    return pkg
  })
}
