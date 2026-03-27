/**
 * POST /api/internal/document-packages/recalc
 * 운영/마이그레이션/배치용 패키지 재계산
 * body: { workerId?: string, all?: boolean }
 */
import { prisma } from '@/lib/db/prisma'
import { recalcWorkerDocumentPackage } from '@/lib/onboarding-docs'
import { ok, badRequest, unauthorized } from '@/lib/utils/response'

export async function POST(req: Request) {
  // CRON_SECRET 인증
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return unauthorized('인증 실패')
  }

  const body = await req.json().catch(() => ({}))
  const { workerId, all } = body as { workerId?: string; all?: boolean }

  if (!workerId && !all) {
    return badRequest('workerId 또는 all=true를 지정하세요.')
  }

  let recalcCount = 0

  if (all) {
    const packages = await prisma.workerDocumentPackage.findMany({
      select: { workerId: true, siteId: true },
    })
    for (const pkg of packages) {
      await recalcWorkerDocumentPackage(pkg.workerId, pkg.siteId)
      recalcCount++
    }
  } else {
    const packages = await prisma.workerDocumentPackage.findMany({
      where: { workerId },
      select: { workerId: true, siteId: true },
    })
    for (const pkg of packages) {
      await recalcWorkerDocumentPackage(pkg.workerId, pkg.siteId)
      recalcCount++
    }
  }

  return ok({ recalcCount })
}
