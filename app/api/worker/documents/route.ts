/**
 * GET /api/worker/documents
 * 근로자 본인의 서류 목록 조회
 * - 안전서류 (SafetyDocument)
 * - 근로계약서 (WorkerContract)
 * - 약관 동의 이력 (UserConsent)
 */
import { getWorkerSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, unauthorized, internalError } from '@/lib/utils/response'

export async function GET() {
  try {
    const session = await getWorkerSession()
    if (!session) return unauthorized()

    const [safetyDocuments, contracts, consents] = await Promise.all([
      prisma.safetyDocument.findMany({
        where: { workerId: session.sub },
        select: {
          id: true,
          documentType: true,
          status: true,
          documentDate: true,
          signedAt: true,
          signedBy: true,
          expiresAt: true,
          reviewedAt: true,
          site: { select: { id: true, name: true } },
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.workerContract.findMany({
        where: { workerId: session.sub },
        select: {
          id: true,
          contractKind: true,
          contractTemplateType: true,
          contractStatus: true,
          startDate: true,
          endDate: true,
          signedAt: true,
          site: { select: { id: true, name: true } },
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.userConsent.findMany({
        where: { workerId: session.sub },
        select: {
          id: true,
          consentType: true,
          agreed: true,
          agreedAt: true,
          policyDocument: {
            select: { id: true, title: true, version: true },
          },
        },
        orderBy: { agreedAt: 'desc' },
      }),
    ])

    return ok({ safetyDocuments, contracts, consents })
  } catch (err) {
    console.error('[worker/documents GET]', err)
    return internalError()
  }
}
