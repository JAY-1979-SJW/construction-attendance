import { getWorkerSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { unauthorized, notFound, forbidden, ok } from '@/lib/utils/response'

/**
 * GET /api/worker/contracts/[id]/document
 * 근로자 본인의 계약서 본문(렌더링된 문서) 조회
 * GeneratedDocument.contentJson (RenderedContract 구조) 반환
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getWorkerSession()
  if (!session) return unauthorized()

  const contract = await prisma.workerContract.findUnique({
    where: { id },
    select: {
      workerId:             true,
      contractTemplateType: true,
      contractStatus:       true,
      companyName:          true,
      startDate:            true,
      endDate:              true,
      signedAt:             true,
      workerSignatureData:  true,
    },
  })

  if (!contract) return notFound()
  if (contract.workerId !== session.sub) return forbidden()

  // 해당 계약에 연결된 최신 GeneratedDocument 조회
  const doc = await prisma.generatedDocument.findFirst({
    where: {
      contractId: id,
      documentType: { in: ['DAILY_CONTRACT', 'REGULAR_CONTRACT', 'SERVICE_CONTRACT'] },
    },
    orderBy: { generatedAt: 'desc' },
    select: {
      id:          true,
      contentJson: true,
      contentText: true,
      status:      true,
      generatedAt: true,
    },
  })

  return ok({
    contractId:          id,
    contractStatus:      contract.contractStatus,
    contractTemplateType: contract.contractTemplateType,
    signedAt:            contract.signedAt,
    hasWorkerSignature:  !!contract.workerSignatureData,
    document: doc
      ? {
          id:          doc.id,
          contentJson: doc.contentJson,
          contentText: doc.contentText,
          status:      doc.status,
          generatedAt: doc.generatedAt,
        }
      : null,
  })
}
