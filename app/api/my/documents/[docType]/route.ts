/**
 * GET /api/my/documents/[docType]
 * 문서 상세, 상태, 반려사유, 제출본 정보, 템플릿 내용 반환
 */
import { prisma } from '@/lib/db/prisma'
import { getWorkerSession } from '@/lib/auth/guards'
import { ok, unauthorized, notFound } from '@/lib/utils/response'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ docType: string }> }
) {
  const { docType } = await params
  const session = await getWorkerSession()
  if (!session) return unauthorized()

  // 근로자의 패키지에서 해당 문서 찾기
  const doc = await prisma.onboardingDocument.findFirst({
    where: {
      workerId: session.sub,
      docType: docType as any,
    },
    include: {
      submissions: {
        orderBy: { submissionNo: 'desc' },
        take: 5,
        include: {
          file: { select: { id: true, originalFilename: true, mimeType: true, path: true } },
        },
      },
      reviews: {
        orderBy: { createdAt: 'desc' },
        take: 3,
      },
    },
  })

  if (!doc) return notFound('문서를 찾을 수 없습니다.')

  // 활성 템플릿 가져오기
  const template = await prisma.onboardingDocTemplate.findFirst({
    where: { docType: docType as any, isActive: true },
    orderBy: { versionNo: 'desc' },
    select: { id: true, title: true, contentHtml: true, versionNo: true },
  })

  return ok({ document: doc, template })
}
