/**
 * GET /api/admin/workers/[id]/documents/[docType]/history
 * 문서 제출/검토 이력 조회
 * query: siteId (optional)
 */
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { ok, unauthorized, notFound } from '@/lib/utils/response'

const includeRelations = {
  submissions: {
    orderBy: { submissionNo: 'desc' as const },
    include: {
      file: { select: { id: true, originalFilename: true, mimeType: true } },
    },
  },
  reviews: {
    orderBy: { createdAt: 'desc' as const },
    include: {
      reviewer: { select: { id: true, name: true } },
    },
  },
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; docType: string }> }
) {
  const { id: workerId, docType } = await params
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const url = new URL(req.url)
  const siteId = url.searchParams.get('siteId')

  const doc = siteId
    ? await prisma.onboardingDocument.findUnique({
        where: { workerId_siteId_docType: { workerId, siteId, docType: docType as any } },
        include: includeRelations,
      })
    : await prisma.onboardingDocument.findFirst({
        where: { workerId, siteId: null, docType: docType as any },
        include: includeRelations,
      })

  if (!doc) return notFound('문서를 찾을 수 없습니다.')

  return ok(doc)
}
