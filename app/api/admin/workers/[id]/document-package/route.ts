/**
 * GET /api/admin/workers/[id]/document-package
 * 근로자 문서 패키지 + 문서별 상태 + 반려사유 + 최근 제출/검토 이력 반환
 */
import { prisma } from '@/lib/db/prisma'
import { getAdminSession, requireRole, MUTATE_ROLES } from '@/lib/auth/guards'
import { ok, unauthorized, notFound } from '@/lib/utils/response'
import { recalcWorkerDocumentPackage } from '@/lib/onboarding-docs'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workerId } = await params
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const worker = await prisma.worker.findUnique({
    where: { id: workerId },
    select: { id: true, name: true },
  })
  if (!worker) return notFound('근로자를 찾을 수 없습니다.')

  // 조회 시 만료 자동 감지를 위한 recalc 실행
  const existingPkgs = await prisma.workerDocumentPackage.findMany({
    where: { workerId },
    select: { workerId: true, siteId: true },
  })
  for (const p of existingPkgs) {
    await recalcWorkerDocumentPackage(p.workerId, p.siteId)
  }

  const packages = await prisma.workerDocumentPackage.findMany({
    where: { workerId },
    include: {
      onboardingDocs: {
        orderBy: { docType: 'asc' },
        include: {
          submissions: {
            orderBy: { submissionNo: 'desc' },
            take: 3,
          },
          reviews: {
            orderBy: { createdAt: 'desc' },
            take: 3,
            include: {
              reviewer: { select: { id: true, name: true } },
            },
          },
        },
      },
      site: { select: { id: true, name: true } },
    },
  })

  return ok({ worker, packages })
}
