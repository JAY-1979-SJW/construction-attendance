import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth/session'
import { ok, unauthorized, notFound, conflict, badRequest } from '@/lib/utils/response'
import { transitionStatus, TransitionError } from '@/lib/materials/request-service'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { id } = await params
  const request = await prisma.materialRequest.findUnique({
    where: { id },
    select: { status: true, _count: { select: { items: true } } },
  })
  if (!request) return notFound('청구서를 찾을 수 없습니다.')
  if (request._count.items === 0) {
    return badRequest('항목이 1개 이상 있어야 제출할 수 있습니다.')
  }

  try {
    await transitionStatus({
      requestId: id,
      from: request.status,
      to: 'SUBMITTED',
      actorId: session.sub,
      extra: { submittedAt: new Date() },
    })
  } catch (e) {
    if (e instanceof TransitionError) return conflict(e.message)
    throw e
  }

  return ok({ status: 'SUBMITTED' })
}
