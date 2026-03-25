import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { requireCompanyAdmin } from '@/lib/auth/guards'
import { ok, unauthorized, forbidden, internalError } from '@/lib/utils/response'

// GET /api/labor/documents?status=&type=
export async function GET(req: NextRequest) {
  try {
    let session: Awaited<ReturnType<typeof requireCompanyAdmin>>
    try {
      session = await requireCompanyAdmin()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : ''
      return msg === 'UNAUTHORIZED' ? unauthorized() : forbidden()
    }

    const { searchParams } = req.nextUrl
    const statusParam = searchParams.get('status') || undefined
    const typeParam   = searchParams.get('type')   || undefined

    const companySites = await prisma.siteCompanyAssignment.findMany({
      where: { companyId: session.companyId },
      select: { siteId: true },
    })
    const siteIds = companySites.map((cp) => cp.siteId)

    const docs = await prisma.workerDocument.findMany({
      where: {
        ...(siteIds.length > 0 ? { siteId: { in: siteIds } } : { companyId: session.companyId }),
        ...(statusParam ? { status: statusParam as never } : {}),
        ...(typeParam   ? { documentType: typeParam as never } : {}),
      },
      include: {
        worker: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    const data = docs.map((d) => ({
      id: d.id,
      workerId: d.workerId,
      workerName: d.worker.name,
      documentType: d.documentType,
      status: d.status,
      expiresAt: d.expiresAt?.toISOString(),
      uploadedAt: d.createdAt.toISOString(),
      reviewedAt: d.reviewedAt?.toISOString(),
      reviewedBy: d.reviewedBy ?? undefined,
    }))

    return ok(data)
  } catch (err) {
    console.error('[labor/documents GET]', err)
    return internalError()
  }
}
