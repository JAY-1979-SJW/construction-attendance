import { NextRequest, NextResponse } from 'next/server'
import { getWorkerSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { unauthorized } from '@/lib/utils/response'

/**
 * GET /api/worker/materials/requests/[id]
 * 자재청구서 상세
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getWorkerSession()
  if (!session) return unauthorized()

  const request = await prisma.materialRequest.findFirst({
    where: {
      id:                params.id,
      workerRequesterId: session.sub,
      actorType:         'WORKER',
    },
    include: {
      site:  { select: { id: true, name: true } },
      items: {
        select: {
          id:           true,
          itemName:     true,
          spec:         true,
          unit:         true,
          requestedQty: true,
          notes:        true,
        },
      },
      history: {
        orderBy: { createdAt: 'asc' },
        select: {
          fromStatus: true,
          toStatus:   true,
          reason:     true,
          createdAt:  true,
        },
      },
    },
  })

  if (!request) {
    return NextResponse.json({ success: false, error: '청구서를 찾을 수 없습니다.' }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: request })
}
