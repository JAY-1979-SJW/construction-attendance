import { NextRequest, NextResponse } from 'next/server'
import { getWorkerSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { unauthorized } from '@/lib/utils/response'

/**
 * POST /api/worker/materials/requests/[id]/cancel
 * 청구서 취소 (DRAFT 또는 SUBMITTED 상태만 가능)
 */
export async function POST(
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
    select: { id: true, status: true },
  })

  if (!request) {
    return NextResponse.json({ success: false, error: '청구서를 찾을 수 없습니다.' }, { status: 404 })
  }

  if (!['DRAFT', 'SUBMITTED'].includes(request.status)) {
    return NextResponse.json(
      { success: false, error: `현재 상태(${request.status})에서는 취소할 수 없습니다.` },
      { status: 409 }
    )
  }

  await prisma.$transaction([
    prisma.materialRequest.update({
      where: { id: request.id },
      data:  { status: 'CANCELLED' },
    }),
    prisma.materialRequestHistory.create({
      data: {
        requestId:  request.id,
        fromStatus: request.status as never,
        toStatus:   'CANCELLED',
        actorId:    session.sub,
        actorType:  'WORKER',
        reason:     '근로자 취소',
      },
    }),
  ])

  return NextResponse.json({ success: true })
}
