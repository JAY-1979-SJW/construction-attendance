/**
 * POST /api/my/documents/[docType]/submit-sign
 * 전자서명형 문서 제출 (개인정보 동의서, 건강 각서, 안전서류)
 * body: { siteId?: string, signatureData?: string, agreedItems?: string[] }
 */
import { z } from 'zod'
import { getWorkerSession } from '@/lib/auth/guards'
import { submitWorkerDocument } from '@/lib/onboarding-docs'
import { ok, unauthorized, badRequest, internalError } from '@/lib/utils/response'
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

  // CONTRACT는 이 엔드포인트가 아닌 기존 계약 서명 플로우 사용
  if (docType === 'CONTRACT') {
    return badRequest('계약서는 기존 계약 서명 플로우를 사용하세요.')
  }

  const validTypes = ['PRIVACY_CONSENT', 'HEALTH_DECLARATION', 'SAFETY_ACK']
  if (!validTypes.includes(docType)) {
    return badRequest(`유효하지 않은 문서 유형: ${docType}`)
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
