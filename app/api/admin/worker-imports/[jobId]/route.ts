/**
 * GET /api/admin/worker-imports/[jobId] — Job 상세 + 행 목록
 */
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

    const job = await prisma.bulkWorkerImportJob.findUnique({
      where: { id: jobId },
      include: {
        rows: { orderBy: { rowNumber: 'asc' } },
      },
    })

    if (!job) return notFound('작업을 찾을 수 없습니다.')
    return ok(job)
  } catch (err) {
    console.error('[worker-imports jobId GET]', err)
    return internalError()
  }
}
