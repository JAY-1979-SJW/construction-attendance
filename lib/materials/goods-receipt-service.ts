import { prisma } from '@/lib/db/prisma'
import { randomUUID } from 'crypto'
import { Decimal } from '@prisma/client/runtime/library'

// ─── 입고번호 생성 ────────────────────────────────────────────────────────────
export async function generateReceiptNo(): Promise<string> {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const prefix = `GR-${ymd}-`
  const last = await prisma.goodsReceipt.findFirst({
    where: { receiptNo: { startsWith: prefix } },
    orderBy: { receiptNo: 'desc' },
    select: { receiptNo: true },
  })
  const seq = last ? parseInt(last.receiptNo.split('-')[2] ?? '0', 10) + 1 : 1
  return `${prefix}${String(seq).padStart(4, '0')}`
}

// ─── 입고 처리 ────────────────────────────────────────────────────────────────
export interface ReceiveItem {
  poItemId:       string
  quantity:       number
  inspectionNote?: string
}

export async function receiveGoods(opts: {
  purchaseOrderId: string
  items:           ReceiveItem[]
  memo?:           string
  userId:          string
}): Promise<{ receiptNo: string; newStatus: string }> {
  const { purchaseOrderId, items, memo, userId } = opts

  // 발주서 + 품목 조회
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    select: {
      status: true,
      items: {
        select: {
          id:               true,
          orderedQuantity:  true,
          receivedQuantity: true,
        },
      },
    },
  })
  if (!po) throw new Error('발주서를 찾을 수 없습니다.')
  if (!['ISSUED', 'PARTIALLY_RECEIVED'].includes(po.status)) {
    throw new Error('발행됨 또는 부분입고 상태에서만 입고 처리가 가능합니다.')
  }

  // 항목별 잔량 검증
  const poItemMap = new Map(po.items.map((i) => [i.id, i] as const))
  for (const item of items) {
    const poItem = poItemMap.get(item.poItemId)
    if (!poItem) throw new Error(`발주 항목 ${item.poItemId}을 찾을 수 없습니다.`)
    const remaining = new Decimal(poItem.orderedQuantity).minus(poItem.receivedQuantity)
    if (new Decimal(item.quantity).greaterThan(remaining)) {
      throw new Error(`입고 수량(${item.quantity})이 잔량(${remaining})을 초과합니다.`)
    }
    if (new Decimal(item.quantity).lessThanOrEqualTo(0)) {
      throw new Error('입고 수량은 0보다 커야 합니다.')
    }
  }

  const receiptNo = await generateReceiptNo()
  const receiptId = randomUUID()
  const now       = new Date()

  await prisma.$transaction(async (tx) => {
    // 1. GoodsReceipt 생성
    await tx.goodsReceipt.create({
      data: {
        id:               receiptId,
        receiptNo,
        purchaseOrderId,
        receivedByUserId: userId,
        receivedAt:       now,
        memo:             memo ?? null,
      },
    })

    // 2. GoodsReceiptItem 생성 + PurchaseOrderItem.receivedQuantity 갱신
    for (const item of items) {
      await tx.goodsReceiptItem.create({
        data: {
          id:             randomUUID(),
          goodsReceiptId: receiptId,
          poItemId:       item.poItemId,
          quantity:       new Decimal(item.quantity),
          inspectionNote: item.inspectionNote ?? null,
        },
      })
      await tx.purchaseOrderItem.update({
        where: { id: item.poItemId },
        data: {
          receivedQuantity: {
            increment: new Decimal(item.quantity),
          },
          updatedAt: now,
        },
      })
    }

    // 3. 전체 입고 여부 확인
    const updatedItems = await tx.purchaseOrderItem.findMany({
      where: { purchaseOrderId },
      select: { orderedQuantity: true, receivedQuantity: true },
    })
    const allReceived = updatedItems.every((i: { orderedQuantity: { toString(): string }; receivedQuantity: { toString(): string } }) =>
      new Decimal(i.receivedQuantity.toString()).greaterThanOrEqualTo(i.orderedQuantity.toString())
    )
    const newStatus = allReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED'

    // 4. PurchaseOrder 상태 갱신
    await tx.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: { status: newStatus, updatedAt: now },
    })

    // 5. 상태 이력 기록
    await tx.purchaseOrderStatusHistory.create({
      data: {
        id:              randomUUID(),
        purchaseOrderId,
        fromStatus:      po.status as never,
        toStatus:        newStatus as never,
        changedByUserId: userId,
        reason:          `입고처리 ${receiptNo}`,
      },
    })
  })

  // 상태 재조회
  const updated = await prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    select: { status: true },
  })

  return { receiptNo, newStatus: updated?.status ?? 'PARTIALLY_RECEIVED' }
}
