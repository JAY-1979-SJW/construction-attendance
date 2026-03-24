import { NextRequest } from 'next/server'
import { z } from 'zod'
import { Decimal } from '@prisma/client/runtime/library'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { ok, badRequest, unauthorized, notFound, conflict } from '@/lib/utils/response'
import { getRemainingQty } from '@/lib/materials/purchase-order-service'

const PatchSchema = z.object({
  orderedQuantity: z.number().positive().optional(),
  note:            z.string().optional().nullable(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { id, itemId } = await params
  const order = await prisma.purchaseOrder.findUnique({ where: { id }, select: { status: true } })
  if (!order) return notFound('발주서를 찾을 수 없습니다.')
  if (order.status !== 'DRAFT') {
    return conflict('작성중 상태에서만 항목을 수정할 수 있습니다.')
  }

  const poItem = await prisma.purchaseOrderItem.findUnique({
    where: { id: itemId },
    select: { purchaseOrderId: true, materialRequestItemId: true },
  })
  if (!poItem || poItem.purchaseOrderId !== id) return notFound('항목을 찾을 수 없습니다.')

  const body = await req.json().catch(() => null)
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.errors[0].message)

  const { orderedQuantity, note } = parsed.data

  if (orderedQuantity !== undefined) {
    const remaining = await getRemainingQty(poItem.materialRequestItemId, id)
    if (new Decimal(orderedQuantity).greaterThan(remaining)) {
      return conflict(`발주 수량(${orderedQuantity})이 잔량(${remaining})을 초과합니다.`)
    }
  }

  const updated = await prisma.purchaseOrderItem.update({
    where: { id: itemId },
    data: {
      ...(orderedQuantity !== undefined && { orderedQuantity: new Decimal(orderedQuantity) }),
      ...(note !== undefined && { note }),
      updatedAt: new Date(),
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
  const order = await prisma.purchaseOrder.findUnique({ where: { id }, select: { status: true } })
  if (!order) return notFound('발주서를 찾을 수 없습니다.')
  if (order.status !== 'DRAFT') {
    return conflict('작성중 상태에서만 항목을 삭제할 수 있습니다.')
  }

  const poItem = await prisma.purchaseOrderItem.findUnique({
    where: { id: itemId },
    select: { purchaseOrderId: true },
  })
  if (!poItem || poItem.purchaseOrderId !== id) return notFound('항목을 찾을 수 없습니다.')

  await prisma.purchaseOrderItem.delete({ where: { id: itemId } })

  return ok({ deleted: true })
}
