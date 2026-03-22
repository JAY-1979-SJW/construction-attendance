import { NextRequest } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, unauthorized, notFound, internalError } from '@/lib/utils/response'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { jobId } = await params

    const job = await prisma.bulkSiteImportJob.findUnique({
      where: { id: jobId },
      include: {
        rows: {
          orderBy: { rowNumber: 'asc' },
          select: {
            id: true,
            rowNumber: true,
            siteName: true,
            rawAddress: true,
            normalizedAddress: true,
            latitude: true,
            longitude: true,
            allowedRadiusMeters: true,
            validationStatus: true,
            validationMessage: true,
            approvedBy: true,
            approvedAt: true,
            importedSiteId: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    })

    if (!job) return notFound('작업을 찾을 수 없습니다.')

    return ok(job)
  } catch (err) {
    console.error('[site-imports/[jobId] GET]', err)
    return internalError()
  }
}
