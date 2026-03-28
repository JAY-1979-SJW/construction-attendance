import { prisma } from '@/lib/db/prisma'
import { REQUIRED_DOC_TYPES, DOC_TYPE_LABELS } from './constants'
import type { WorkerDocumentPackage, OnboardingDocType } from '@prisma/client'

/**
 * 현장 문서정책에 따른 활성 문서 유형 조회.
 * SiteDocumentPolicy 레코드가 없으면 기본값(5종 전체 필수) 사용.
 */
async function getActiveDocTypes(siteId: string | null): Promise<{ docType: OnboardingDocType; isRequired: boolean }[]> {
  if (!siteId) {
    return REQUIRED_DOC_TYPES.map(dt => ({ docType: dt, isRequired: true }))
  }

  const policies = await prisma.siteDocumentPolicy.findMany({
    where: { siteId },
  })

  // 정책 레코드가 없으면 기본값 사용
  if (policies.length === 0) {
    return REQUIRED_DOC_TYPES.map(dt => ({ docType: dt, isRequired: true }))
  }

  // 활성 문서만 반환
  return policies
    .filter(p => p.isActive)
    .map(p => ({ docType: p.docType, isRequired: p.isRequired }))
}

/**
 * 근로자의 문서 패키지가 없으면 생성하고 문서 row도 함께 초기화한다.
 * 현장 문서정책(SiteDocumentPolicy)이 있으면 그에 따라 문서를 생성하고,
 * 없으면 기본 5종 전체 필수로 생성한다.
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

  // 현장 문서정책에 따른 활성 문서 유형 조회
  const docTypes = await getActiveDocTypes(siteId)
  const requiredCount = docTypes.filter(d => d.isRequired).length

  // 패키지 + 문서 생성 (트랜잭션)
  return prisma.$transaction(async (tx) => {
    const pkg = await tx.workerDocumentPackage.create({
      data: {
        workerId,
        siteId: siteId || null,
        scope: siteId ? 'SITE' : 'GLOBAL',
        requiredDocCount: requiredCount,
        missingDocCount: requiredCount,
      },
    })

    for (const { docType, isRequired } of docTypes) {
      await tx.onboardingDocument.create({
        data: {
          workerId,
          siteId: siteId || null,
          packageId: pkg.id,
          docType,
          title: DOC_TYPE_LABELS[docType],
          // 선택 문서는 NOT_REQUIRED로 생성
          status: isRequired ? 'NOT_SUBMITTED' : 'NOT_REQUIRED',
        },
      })
    }

    return pkg
  })
}
