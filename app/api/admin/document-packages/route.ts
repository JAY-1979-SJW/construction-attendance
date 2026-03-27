/**
 * GET /api/admin/document-packages
 * 문서 패키지 목록 (필터: status, siteId, keyword)
 * 검토대기 문서 목록용
 */
import { prisma } from '@/lib/db/prisma'
import { getAdminSession, buildSiteScopeWhere } from '@/lib/auth/guards'
import { ok, unauthorized } from '@/lib/utils/response'
import type { Prisma } from '@prisma/client'

export async function GET(req: Request) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const url = new URL(req.url)
  const status = url.searchParams.get('status')
  const siteId = url.searchParams.get('siteId')
  const docStatus = url.searchParams.get('docStatus') // SUBMITTED 등
  const keyword = url.searchParams.get('keyword')
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1))
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize') ?? 20)))

  // 현장 접근 권한 필터
  const siteScope = await buildSiteScopeWhere(session)

  const where: Prisma.WorkerDocumentPackageWhereInput = {
    ...(status ? { overallStatus: status as any } : {}),
    ...(siteId ? { siteId } : (siteScope && typeof siteScope === 'object' && 'siteId' in siteScope) ? { siteId: (siteScope as any).siteId } : {}),
    ...(keyword
      ? {
          worker: {
            OR: [
              { name: { contains: keyword, mode: 'insensitive' } },
              { phone: { contains: keyword } },
            ],
          },
        }
      : {}),
  }

  const [total, packages] = await Promise.all([
    prisma.workerDocumentPackage.count({ where }),
    prisma.workerDocumentPackage.findMany({
      where,
      include: {
        worker: { select: { id: true, name: true, phone: true, jobTitle: true } },
        site: { select: { id: true, name: true } },
        onboardingDocs: {
          orderBy: { docType: 'asc' },
          select: {
            id: true,
            docType: true,
            status: true,
            rejectionReason: true,
            submittedAt: true,
            reviewedAt: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  // 검토대기 문서만 별도 필터링
  let pendingDocs: any[] = []
  if (docStatus === 'SUBMITTED') {
    const docs = await prisma.onboardingDocument.findMany({
      where: {
        status: 'SUBMITTED',
        ...(siteId ? { siteId } : {}),
      },
      include: {
        worker: { select: { id: true, name: true, phone: true } },
        site: { select: { id: true, name: true } },
      },
      orderBy: { submittedAt: 'desc' },
      take: 100,
    })
    pendingDocs = docs
  }

  return ok({
    total,
    page,
    pageSize,
    packages,
    pendingDocs,
  })
}
