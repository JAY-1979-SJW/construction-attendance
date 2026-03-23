import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth/session'
import { ok, unauthorized, notFound, conflict } from '@/lib/utils/response'
import { transitionStatus, TransitionError } from '@/lib/materials/request-service'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { id } = await params
  const request = await prisma.materialRequest.findUnique({
    where: { id },
    select: { status: true },
  })
  if (!request) return notFound('청구서를 찾을 수 없습니다.')

  const body = await req.json().catch(() => ({}))

  try {
    await transitionStatus({
      requestId: id,
      from: request.status,
      to: 'APPROVED',
      actorId: session.sub,
      reason: body?.notes ?? undefined,
      extra: { approvedAt: new Date(), approvedBy: session.sub },
    })
  } catch (e) {
    if (e instanceof TransitionError) return conflict(e.message)
    throw e
  }

  return ok({ status: 'APPROVED' })
}
