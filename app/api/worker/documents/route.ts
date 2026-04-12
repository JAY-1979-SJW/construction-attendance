/**
 * GET /api/worker/documents
 * 근로자 본인의 서류 목록 조회
 * - 안전서류 (SafetyDocument)
 * - 근로계약서 (WorkerContract)
 * - 약관 동의 이력 (UserConsent — 구 시스템)
 * - 앱 공통 문서 동의 이력 (WorkerDocConsent — 신 시스템)
 */
import { getWorkerSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, unauthorized, internalError } from '@/lib/utils/response'

export async function GET() {
  try {
    const session = await getWorkerSession()
    if (!session) return unauthorized()

    const [safetyDocuments, contracts, consents, docConsents] = await Promise.all([
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
      // 앱 공통 문서 동의 이력 (신 시스템)
      prisma.workerDocConsent.findMany({
        where: { workerId: session.sub },
        select: {
          id: true,
          agreedAt: true,
          consentDoc: {
            select: { id: true, docType: true, title: true, version: true, scope: true },
          },
        },
        orderBy: { agreedAt: 'desc' },
      }),
    ])

    return ok({ safetyDocuments, contracts, consents, docConsents })
  } catch (err) {
    console.error('[worker/documents GET]', err)
    return internalError()
  }
}
