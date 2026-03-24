import { prisma } from '@/lib/db/prisma'
import { PurchaseOrderStatus } from '@prisma/client'
import { randomUUID } from 'crypto'
import { Decimal } from '@prisma/client/runtime/library'

// ─── 상태 전이표 ──────────────────────────────────────────────────────────────
const ALLOWED: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  DRAFT:              ['ISSUED', 'CANCELLED'],
  ISSUED:             ['PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'],
  PARTIALLY_RECEIVED: ['RECEIVED', 'CANCELLED'],
  RECEIVED:           [],
  CANCELLED:          [],
}

export class PurchaseOrderTransitionError extends Error {
  constructor(
    message: string,
    public readonly from: PurchaseOrderStatus,
    public readonly to: PurchaseOrderStatus
  ) {
    super(message)
    this.name = 'PurchaseOrderTransitionError'
  }
}

export function assertPOTransition(from: PurchaseOrderStatus, to: PurchaseOrderStatus) {
  if (!ALLOWED[from]?.includes(to)) {
    throw new PurchaseOrderTransitionError(`상태 전이 불가: ${from} → ${to}`, from, to)
  }
}

// ─── 발주번호 생성 ────────────────────────────────────────────────────────────
export async function generateOrderNo(): Promise<string> {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const prefix = `PO-${ymd}-`
  const last = await prisma.purchaseOrder.findFirst({
    where: { orderNo: { startsWith: prefix } },
    orderBy: { orderNo: 'desc' },
    select: { orderNo: true },
  })
  const seq = last ? parseInt(last.orderNo.split('-')[2] ?? '0', 10) + 1 : 1
  return `${prefix}${String(seq).padStart(4, '0')}`
}

// ─── 잔량 계산 ────────────────────────────────────────────────────────────────
// 특정 청구항목에 대한 발주 가능 잔량
// excludeOrderId: 수정 시 자기 자신 제외
export async function getRemainingQty(
  materialRequestItemId: string,
  excludeOrderId?: string
): Promise<Decimal> {
  const item = await prisma.materialRequestItem.findUnique({
    where: { id: materialRequestItemId },
    select: { requestedQty: true },
  })
  if (!item) throw new Error('청구 항목을 찾을 수 없습니다.')

  const where: Record<string, unknown> = {
    materialRequestItemId,
    purchaseOrder: { status: { not: 'CANCELLED' } },
  }
  if (excludeOrderId) {
    where.purchaseOrderId = { not: excludeOrderId }
  }

  const agg = await prisma.purchaseOrderItem.aggregate({
    where,
    _sum: { orderedQuantity: true },
  })

  const ordered = agg._sum.orderedQuantity ?? new Decimal(0)
  return new Decimal(item.requestedQty).minus(ordered)
}

// ─── 상태 전이 트랜잭션 ───────────────────────────────────────────────────────
export async function transitionPOStatus(opts: {
  orderId:  string
  from:     PurchaseOrderStatus
  to:       PurchaseOrderStatus
  userId?:  string
  reason?:  string
  extra?:   Partial<{
    orderedAt:   Date
    issuedAt:    Date
    cancelledAt: Date
  }>
}): Promise<void> {
  assertPOTransition(opts.from, opts.to)

  await prisma.$transaction([
    prisma.purchaseOrder.update({
      where: { id: opts.orderId },
      data: { status: opts.to, updatedAt: new Date(), ...opts.extra },
    }),
    prisma.purchaseOrderStatusHistory.create({
      data: {
        id:              randomUUID(),
        purchaseOrderId: opts.orderId,
        fromStatus:      opts.from,
        toStatus:        opts.to,
        changedByUserId: opts.userId ?? null,
        reason:          opts.reason ?? null,
      },
    }),
  ])
}

// ─── 발주 항목 스냅샷 빌드 ───────────────────────────────────────────────────
export async function buildPOItemSnapshot(materialRequestItemId: string) {
  const item = await prisma.materialRequestItem.findUnique({
    where: { id: materialRequestItemId },
    select: {
      itemName:         true,
      spec:             true,
      unit:             true,
      disciplineCode:   true,
      subDisciplineCode: true,
      requestedQty:     true,
      notes:            true,
      requestId:        true,
    },
  })
  if (!item) throw new Error('청구 항목을 찾을 수 없습니다.')
  return {
    itemNameSnapshot:          item.itemName,
    specSnapshot:              item.spec ?? null,
    unitSnapshot:              item.unit ?? null,
    disciplineCodeSnapshot:    item.disciplineCode ?? null,
    subDisciplineCodeSnapshot: item.subDisciplineCode ?? null,
    requestQuantitySnapshot:   item.requestedQty,
    requestNoteSnapshot:       item.notes ?? null,
    requestId:                 item.requestId,
  }
}

// ─── 청구항목별 발주 현황 계산 ────────────────────────────────────────────────
export type OrderStatus = 'NONE' | 'PARTIAL' | 'FULL'

export async function getRequestItemOrderStatus(requestId: string) {
  const items = await prisma.materialRequestItem.findMany({
    where: { requestId },
    select: {
      id:           true,
      itemCode:     true,
      itemName:     true,
      spec:         true,
      unit:         true,
      requestedQty: true,
      isUrgent:     true,
      purchaseOrderItems: {
        where: { purchaseOrder: { status: { not: 'CANCELLED' } } },
        select: { orderedQuantity: true, purchaseOrderId: true },
      },
    },
  })

  return items.map(item => {
    const ordered = item.purchaseOrderItems.reduce(
      (sum, poi) => sum.plus(poi.orderedQuantity),
      new Decimal(0)
    )
    const remaining = new Decimal(item.requestedQty).minus(ordered)
    let orderStatus: OrderStatus = 'NONE'
    if (ordered.greaterThanOrEqualTo(item.requestedQty)) orderStatus = 'FULL'
    else if (ordered.greaterThan(0)) orderStatus = 'PARTIAL'

    return {
      id:           item.id,
      itemCode:     item.itemCode,
      itemName:     item.itemName,
      spec:         item.spec,
      unit:         item.unit,
      requestedQty: item.requestedQty,
      orderedQty:   ordered,
      remainingQty: remaining.lessThan(0) ? new Decimal(0) : remaining,
      orderStatus,
      isUrgent:     item.isUrgent,
    }
  })
}
