/**
 * POST /api/admin/workers/[id]/documents/[docType]/review
 * 관리자가 문서를 승인(APPROVE) 또는 반려(REJECT)
 * body: { action: 'APPROVE' | 'REJECT', reason?: string, siteId?: string }
 */
import { z } from 'zod'
import { getAdminSession, requireRole, MUTATE_ROLES } from '@/lib/auth/guards'
import { reviewWorkerDocument } from '@/lib/onboarding-docs'
import { ok, unauthorized, badRequest, internalError } from '@/lib/utils/response'
import { prisma } from '@/lib/db/prisma'

const schema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  reason: z.string().max(500).optional(),
  siteId: z.string().optional(),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; docType: string }> }
) {
  const { id: workerId, docType } = await params
  const session = await getAdminSession()
  if (!session) return unauthorized()
  const deny = requireRole(session, MUTATE_ROLES)
  if (deny) return deny

  const body = await req.json().catch(() => ({}))
  const parsed = schema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.errors[0].message)

  const { action, reason, siteId } = parsed.data

  if (action === 'REJECT' && !reason?.trim()) {
    return badRequest('반려 사유를 입력하세요.')
  }

  // siteId 결정: 명시 안 하면 해당 근로자의 첫 패키지에서 가져옴
  let resolvedSiteId: string | null = siteId ?? null
  if (!resolvedSiteId) {
    const pkg = await prisma.workerDocumentPackage.findFirst({
      where: { workerId },
      select: { siteId: true },
    })
    resolvedSiteId = pkg?.siteId ?? null
  }

  try {
    const result = await reviewWorkerDocument({
      workerId,
      siteId: resolvedSiteId,
      docType: docType as any,
      action: action as any,
      reviewerId: session.sub,
      reason,
    })

    // 알림 생성
    const docLabel = {
      CONTRACT: '근로계약서',
      PRIVACY_CONSENT: '개인정보 동의서',
      HEALTH_DECLARATION: '건강 각서',
      HEALTH_CERTIFICATE: '건강증명서',
      SAFETY_ACK: '안전서류',
    }[docType] ?? docType

    await prisma.workerNotification.create({
      data: {
        workerId,
        type: action === 'APPROVE' ? 'DOC_APPROVED' : 'DOC_REJECTED',
        title: `${docLabel} ${action === 'APPROVE' ? '승인' : '반려'}`,
        body: action === 'APPROVE'
          ? `${docLabel}이(가) 승인되었습니다.`
          : `${docLabel}이(가) 반려되었습니다. 사유: ${reason}`,
        linkUrl: '/my/documents',
        referenceId: result.docId,
      },
    })

    return ok(result)
  } catch (err: any) {
    return internalError(err.message)
  }
}
