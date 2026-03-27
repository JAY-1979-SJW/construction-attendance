/**
 * POST /api/my/documents/[docType]/resubmit
 * 반려 후 재제출
 * body: { siteId?: string, signatureData?: string, agreedItems?: string[] }
 */
import { z } from 'zod'
import { getWorkerSession } from '@/lib/auth/guards'
import { submitWorkerDocument } from '@/lib/onboarding-docs'
import { ok, unauthorized, badRequest, conflict, internalError } from '@/lib/utils/response'
import { prisma } from '@/lib/db/prisma'

const schema = z.object({
  siteId: z.string().optional(),
  signatureData: z.string().optional(),
  agreedItems: z.array(z.string()).optional(),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ docType: string }> }
) {
  const { docType } = await params
  const session = await getWorkerSession()
  if (!session) return unauthorized()

  if (docType === 'CONTRACT') {
    return badRequest('계약서 재제출은 기존 계약 플로우를 사용하세요.')
  }

  const body = await req.json().catch(() => ({}))
  const parsed = schema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.errors[0].message)

  // siteId 결정
  let siteId: string | null = parsed.data.siteId ?? null
  if (!siteId) {
    const contract = await prisma.workerContract.findFirst({
      where: { workerId: session.sub, contractStatus: { in: ['ACTIVE', 'REVIEW_REQUESTED'] } },
      orderBy: { createdAt: 'desc' },
      select: { siteId: true },
    })
    siteId = contract?.siteId ?? null
  }

  // 문서가 REJECTED 상태인지 확인
  const doc = siteId
    ? await prisma.onboardingDocument.findUnique({
        where: { workerId_siteId_docType: { workerId: session.sub, siteId, docType: docType as any } },
        select: { status: true },
      })
    : await prisma.onboardingDocument.findFirst({
        where: { workerId: session.sub, siteId: null, docType: docType as any },
        select: { status: true },
      })

  if (!doc) return badRequest('문서를 찾을 수 없습니다.')
  if (doc.status !== 'REJECTED' && doc.status !== 'EXPIRED') {
    return conflict('반려 또는 만료 상태의 문서만 재제출할 수 있습니다.')
  }

  try {
    const submission = await submitWorkerDocument({
      workerId: session.sub,
      siteId,
      docType: docType as any,
      submitMethod: 'SIGN',
      sourcePayload: {
        signatureData: parsed.data.signatureData,
        agreedItems: parsed.data.agreedItems,
      },
    })

    return ok({ submissionId: submission.id, status: 'SUBMITTED' })
  } catch (err: any) {
    return internalError(err.message)
  }
}
