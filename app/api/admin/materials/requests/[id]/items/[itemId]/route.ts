import { NextRequest } from 'next/server'
import { z } from 'zod'
import { Decimal } from '@prisma/client/runtime/library'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { ok, badRequest, unauthorized, notFound, conflict } from '@/lib/utils/response'

const PatchItemSchema = z.object({
  requestedQty:    z.number().positive().optional(),
  unitPrice:       z.number().nonnegative().optional().nullable(),
  isUrgent:        z.boolean().optional(),
  allowSubstitute: z.boolean().optional(),
  notes:           z.string().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { id, itemId } = await params
  const request = await prisma.materialRequest.findUnique({ where: { id }, select: { status: true } })
  if (!request) return notFound('청구서를 찾을 수 없습니다.')
  if (request.status !== 'DRAFT') {
    return conflict('작성중 상태에서만 항목을 수정할 수 있습니다.')
  }

  const item = await prisma.materialRequestItem.findFirst({
    where: { id: itemId, requestId: id },
  })
  if (!item) return notFound('항목을 찾을 수 없습니다.')

  const body = await req.json().catch(() => null)
  const parsed = PatchItemSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.errors[0].message)

  const d = parsed.data
  const updated = await prisma.materialRequestItem.update({
    where: { id: itemId },
    data: {
      ...(d.requestedQty != null && { requestedQty: new Decimal(d.requestedQty) }),
      ...(d.unitPrice !== undefined && {
        unitPrice: d.unitPrice != null ? new Decimal(d.unitPrice) : null,
      }),
      ...(d.isUrgent != null && { isUrgent: d.isUrgent }),
      ...(d.allowSubstitute != null && { allowSubstitute: d.allowSubstitute }),
      ...(d.notes !== undefined && { notes: d.notes }),
    },
  })

  return ok(updated)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { id, itemId } = await params
  const request = await prisma.materialRequest.findUnique({ where: { id }, select: { status: true } })
  if (!request) return notFound('청구서를 찾을 수 없습니다.')
  if (request.status !== 'DRAFT') {
    return conflict('작성중 상태에서만 항목을 삭제할 수 있습니다.')
  }

  const item = await prisma.materialRequestItem.findFirst({
    where: { id: itemId, requestId: id },
  })
  if (!item) return notFound('항목을 찾을 수 없습니다.')

  await prisma.materialRequestItem.delete({ where: { id: itemId } })
  return ok({ deleted: true })
}
