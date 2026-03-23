import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { requireCompanyAdmin } from '@/lib/auth/guards'
import { ok, unauthorized, forbidden, internalError } from '@/lib/utils/response'

export async function GET(request: NextRequest) {
  try {
    let session
    try {
      session = await requireCompanyAdmin()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : ''
      if (msg === 'UNAUTHORIZED') return unauthorized()
      if (msg === 'FORBIDDEN') return forbidden()
      throw e
    }

    const { searchParams } = new URL(request.url)
    const statusParam = searchParams.get('status')

    // 이 회사에 배정된 근로자 ID 목록
    const assignments = await prisma.workerCompanyAssignment.findMany({
      where: { companyId: session.companyId, validTo: null },
      select: { workerId: true },
    })
    const companyWorkerIds = assignments.map((a) => a.workerId)

    const where = {
      workerId: { in: companyWorkerIds },
      ...(statusParam ? { status: statusParam as 'PENDING' | 'APPROVED' | 'REJECTED' } : {}),
    }

    const [total, requests] = await Promise.all([
      prisma.deviceChangeRequest.count({ where }),
      prisma.deviceChangeRequest.findMany({
        where,
        include: { worker: { select: { name: true } } },
        orderBy: { requestedAt: 'desc' },
      }),
    ])

    return ok({
      items: requests.map((r) => ({
        id: r.id,
        workerName: r.worker.name,
        deviceName: r.newDeviceName,
        status: r.status,
        createdAt: r.requestedAt.toISOString(),
      })),
      total,
    })
  } catch (err) {
    console.error('[company/devices GET]', err)
    return internalError()
  }
}
