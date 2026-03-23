import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth/session'
import { ok, badRequest, unauthorized, notFound, conflict } from '@/lib/utils/response'
import { transitionStatus, TransitionError } from '@/lib/materials/request-service'

const Schema = z.object({ reason: z.string().min(1, '반려 사유를 입력하세요.') })

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

  const body = await req.json().catch(() => null)
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.errors[0].message)

  try {
    await transitionStatus({
      requestId: id,
      from: request.status,
      to: 'REJECTED',
      actorId: session.sub,
      reason: parsed.data.reason,
      extra: {
        rejectedAt:   new Date(),
        rejectedBy:   session.sub,
        rejectReason: parsed.data.reason,
      },
    })
  } catch (e) {
    if (e instanceof TransitionError) return conflict(e.message)
    throw e
  }

  return ok({ status: 'REJECTED' })
}
