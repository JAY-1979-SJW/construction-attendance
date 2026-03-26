import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { ok, badRequest, unauthorized, notFound } from '@/lib/utils/response'

const VALID_STATUSES = ['DRAFT', 'REVIEWED', 'CONFIRMED'] as const
const PatchSchema = z.object({
  status: z.enum(VALID_STATUSES),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; aggId: string }> }
) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { id, aggId } = await params
  const row = await prisma.materialAggregateRow.findFirst({
    where: { id: aggId, documentId: id },
    select: { id: true },
  })
  if (!row) return notFound('집계 행을 찾을 수 없습니다')

  const body = await req.json().catch(() => null)
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.errors[0].message)

  const { status } = parsed.data
  const now = new Date()

  await prisma.materialAggregateRow.update({
    where: { id: aggId },
    data: {
      aggregationStatus: status,
      ...(status === 'CONFIRMED' && {
        confirmedBy: session.sub,
        confirmedAt: now,
      }),
      ...(status !== 'CONFIRMED' && {
        confirmedBy: null,
        confirmedAt: null,
      }),
    },
  })

  return ok({ id: aggId, status })
}
