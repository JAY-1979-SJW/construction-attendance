import { getWorkerSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { unauthorized, ok } from '@/lib/utils/response'

/**
 * GET /api/worker/required-documents
 *
 * 근로자에게 필요한 모든 문서 목록 반환 (미동의 + 동의완료 구분)
 * 포함 범위:
 *   1. GLOBAL 문서 (전체 공통)
 *   2. 근로자 소속 업체 COMPANY 문서
 *   3. 근로자 배정 현장 SITE 문서
 *   4. 근로계약서 (WorkerContract 기반 가상 문서)
 *
 * 버전 판정:
 *   WorkerDocConsent.agreedVersion === ConsentDoc.version 일 때만 동의 유효
 *   버전 불일치(문서 업데이트됨) → agreedAt=null 반환 → 재동의 대상
 *
 * Response: { docs: DocItem[], pendingCount: number }
 * DocItem: {
 *   id: string,           // ConsentDoc.id 또는 "labor-contract:<contractId>"
 *   docType: string,
 *   title: string,
 *   contentMd: string,
 *   isRequired: boolean,
 *   scope: string,
 *   agreedAt: string | null,
 * }
 */
export async function GET() {
  const session = await getWorkerSession()
  if (!session) return unauthorized()

  const workerId = session.sub

  const now = new Date()

  // 근로자 기본 정보 + 소속 업체/현장
  const worker = await prisma.worker.findUnique({
    where: { id: workerId },
    select: {
      laborContractAgreedAt: true,
      companyAssignments: {
        where: {
          validFrom: { lte: now },
          OR: [{ validTo: null }, { validTo: { gte: now } }],
        },
        select: { companyId: true },
        take: 5,
      },
      siteAssignments: {
        where: { isActive: true },
        select: { siteId: true },
        take: 10,
      },
    },
  })
  if (!worker) return unauthorized()

  const companyIds = worker.companyAssignments.map(a => a.companyId)
  const siteIds    = worker.siteAssignments.map(a => a.siteId)

  // ConsentDoc 목록 조회 (GLOBAL + 소속 업체 + 배정 현장)
  const docs = await prisma.consentDoc.findMany({
    where: {
      isActive: true,
      OR: [
        { scope: 'GLOBAL' },
        { scope: 'COMPANY', companyId: { in: companyIds } },
        { scope: 'SITE',    siteId:    { in: siteIds    } },
      ],
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: {
      workerConsents: {
        where: { workerId },
        select: { agreedAt: true, agreedVersion: true },
        take: 1,
      },
    },
  })

  // 근로계약서 (가상 문서) — ACTIVE 우선
  const contract = await prisma.workerContract.findFirst({
    where: {
      workerId,
      contractStatus: { in: ['ACTIVE', 'REVIEW_REQUESTED'] },
    },
    orderBy: [
      { contractStatus: 'asc' }, // ACTIVE < REVIEW_REQUESTED alphabetically
      { createdAt: 'desc' },
    ],
    select: { id: true, contractStatus: true },
  })

  // 결과 조립
  const result = [
    // ConsentDoc 기반 문서
    ...docs.map(doc => ({
      id:         doc.id,
      docType:    doc.docType,
      title:      doc.title,
      contentMd:  doc.contentMd,
      version:    doc.version,
      isRequired: doc.isRequired,
      scope:      doc.scope,
      // agreedVersion이 현재 doc.version과 일치할 때만 동의 유효
      // 불일치(문서 업데이트 후 미재동의) → null 반환 → 재동의 대상
      agreedAt: (() => {
        const consent = doc.workerConsents[0]
        if (!consent) return null
        if (consent.agreedVersion !== doc.version) return null
        return consent.agreedAt.toISOString()
      })(),
    })),
    // 근로계약서 가상 문서
    ...(contract
      ? [{
          id:         `labor-contract:${contract.id}`,
          docType:    'LABOR_CONTRACT',
          title:      '근로계약서',
          contentMd:  '', // 상세는 /api/worker/my-contract 에서 조회
          isRequired: true,
          scope:      'GLOBAL',
          agreedAt:   worker.laborContractAgreedAt?.toISOString() ?? null,
        }]
      : []),
  ]

  const pendingCount = result.filter(d => d.isRequired && !d.agreedAt).length

  return ok({ docs: result, pendingCount })
}
