import { NextRequest } from 'next/server'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { Decimal } from '@prisma/client/runtime/library'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { ok, created, badRequest, unauthorized, notFound, conflict } from '@/lib/utils/response'
import { getRemainingQty, buildPOItemSnapshot } from '@/lib/materials/purchase-order-service'

const AddItemSchema = z.object({
  materialRequestItemId: z.string().min(1),
  orderedQuantity:       z.number().positive('발주 수량은 0보다 커야 합니다.'),
  note:                  z.string().optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { id } = await params
  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    select: { status: true, materialRequestId: true },
  })
  if (!order) return notFound('발주서를 찾을 수 없습니다.')
  if (order.status !== 'DRAFT') {
    return conflict('작성중 상태에서만 항목을 추가할 수 있습니다.')
  }

  const body = await req.json().catch(() => null)
  const parsed = AddItemSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.errors[0].message)

  const { materialRequestItemId, orderedQuantity, note } = parsed.data

  // 청구서 소속 확인
  const reqItem = await prisma.materialRequestItem.findUnique({
    where: { id: materialRequestItemId },
    select: { requestId: true },
  })
  if (!reqItem || reqItem.requestId !== order.materialRequestId) {
    return badRequest('해당 청구서 소속 항목이 아닙니다.')
  }

  // 잔량 확인 (현재 발주서 자신 제외)
  const remaining = await getRemainingQty(materialRequestItemId, id)
  if (new Decimal(orderedQuantity).greaterThan(remaining)) {
    return conflict(`발주 수량(${orderedQuantity})이 잔량(${remaining})을 초과합니다.`)
  }

  const snap = await buildPOItemSnapshot(materialRequestItemId)
  const item = await prisma.purchaseOrderItem.create({
    data: {
      id:                    randomUUID(),
      purchaseOrderId:       id,
      materialRequestItemId,
      orderedQuantity:       new Decimal(orderedQuantity),
      receivedQuantity:      new Decimal(0),
      note:                  note ?? null,
      ...snap,
    },
  })

  return created(item)
}
