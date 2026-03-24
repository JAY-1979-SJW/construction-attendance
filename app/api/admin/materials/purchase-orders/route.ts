import { NextRequest } from 'next/server'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { Decimal } from '@prisma/client/runtime/library'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { ok, created, badRequest, unauthorized, conflict, notFound } from '@/lib/utils/response'
import {
  generateOrderNo,
  getRemainingQty,
  buildPOItemSnapshot,
} from '@/lib/materials/purchase-order-service'

const ItemSchema = z.object({
  materialRequestItemId: z.string().min(1),
  orderedQuantity:       z.number().positive('발주 수량은 0보다 커야 합니다.'),
  note:                  z.string().optional(),
})

const CreateSchema = z.object({
  materialRequestId:    z.string().min(1, '청구서 ID가 필요합니다.'),
  siteId:               z.string().optional(),
  vendorId:             z.string().optional(),
  memo:                 z.string().optional(),
  deliveryRequestedDate: z.string().optional(),
  items:                z.array(ItemSchema).optional(),
})

export async function GET(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { searchParams } = req.nextUrl
  const status           = searchParams.get('status') ?? ''
  const materialRequestId = searchParams.get('materialRequestId') ?? ''
  const siteId           = searchParams.get('siteId') ?? ''
  const page             = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const pageSize         = Math.min(50, parseInt(searchParams.get('pageSize') ?? '20', 10))

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (materialRequestId) where.materialRequestId = materialRequestId
  if (siteId) where.siteId = siteId

  const [total, orders] = await Promise.all([
    prisma.purchaseOrder.count({ where }),
    prisma.purchaseOrder.findMany({
      where,
      select: {
        id:               true,
        orderNo:          true,
        status:           true,
        orderedByUserId:  true,
        issuedAt:         true,
        createdAt:        true,
        deliveryRequestedDate: true,
        materialRequest:  { select: { id: true, requestNo: true, title: true } },
        site:             { select: { id: true, name: true } },
        _count:           { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip:  (page - 1) * pageSize,
      take:  pageSize,
    }),
  ])

  return ok({ orders, total, page, pageSize, totalPages: Math.ceil(total / pageSize) })
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const body = await req.json().catch(() => null)
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.errors[0].message)

  const { materialRequestId, siteId, vendorId, memo, deliveryRequestedDate, items } = parsed.data

  // 청구서 상태 검증
  const materialRequest = await prisma.materialRequest.findUnique({
    where: { id: materialRequestId },
    select: { status: true, siteId: true },
  })
  if (!materialRequest) return notFound('청구서를 찾을 수 없습니다.')
  if (materialRequest.status !== 'APPROVED') {
    return conflict('승인된 청구서에서만 발주를 생성할 수 있습니다.')
  }

  const orderId  = randomUUID()
  const orderNo  = await generateOrderNo()

  // 항목별 잔량 검증
  if (items && items.length > 0) {
    for (const item of items) {
      // 해당 항목이 이 청구서 소속인지 확인
      const reqItem = await prisma.materialRequestItem.findUnique({
        where: { id: item.materialRequestItemId },
        select: { requestId: true },
      })
      if (!reqItem || reqItem.requestId !== materialRequestId) {
        return badRequest(`항목 ${item.materialRequestItemId}은 해당 청구서 소속이 아닙니다.`)
      }
      const remaining = await getRemainingQty(item.materialRequestItemId)
      if (new Decimal(item.orderedQuantity).greaterThan(remaining)) {
        return conflict(`발주 수량이 잔량(${remaining})을 초과합니다.`)
      }
    }
  }

  const order = await prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.create({
      data: {
        id:               orderId,
        orderNo,
        materialRequestId,
        siteId:           siteId ?? materialRequest.siteId ?? null,
        vendorId:         vendorId ?? null,
        orderedByUserId:  session.sub,
        memo:             memo ?? null,
        deliveryRequestedDate: deliveryRequestedDate ? new Date(deliveryRequestedDate) : null,
        status:           'DRAFT',
      },
    })

    await tx.purchaseOrderStatusHistory.create({
      data: {
        id:              randomUUID(),
        purchaseOrderId: orderId,
        fromStatus:      null,
        toStatus:        'DRAFT',
        changedByUserId: session.sub,
      },
    })

    if (items && items.length > 0) {
      for (const item of items) {
        const snap = await buildPOItemSnapshot(item.materialRequestItemId)
        await tx.purchaseOrderItem.create({
          data: {
            id:                    randomUUID(),
            purchaseOrderId:       orderId,
            materialRequestItemId: item.materialRequestItemId,
            orderedQuantity:       new Decimal(item.orderedQuantity),
            receivedQuantity:      new Decimal(0),
            note:                  item.note ?? null,
            ...snap,
          },
        })
      }
    }

    return po
  })

  return created({ id: order.id, orderNo: order.orderNo })
}
