import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { ok, unauthorized } from '@/lib/utils/response'
import { Decimal } from '@prisma/client/runtime/library'

export async function GET(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { searchParams } = req.nextUrl
  const siteId = searchParams.get('siteId') ?? ''

  // 발주 항목 기준 집계 (취소된 발주 제외)
  const poItems = await prisma.purchaseOrderItem.findMany({
    where: {
      purchaseOrder: {
        status: { not: 'CANCELLED' },
        ...(siteId ? { siteId } : {}),
      },
    },
    select: {
      itemNameSnapshot:  true,
      specSnapshot:      true,
      unitSnapshot:      true,
      orderedQuantity:   true,
      receivedQuantity:  true,
      purchaseOrder: {
        select: {
          siteId: true,
          site:   { select: { id: true, name: true } },
          materialRequestId: true,
        },
      },
      materialRequestItem: {
        select: { requestedQty: true },
      },
    },
  })

  // 현장 × 자재명 단위로 집계
  type Key = string
  const map = new Map<Key, {
    siteId:   string | null
    siteName: string
    itemName: string
    spec:     string | null
    unit:     string | null
    requestedQty: Decimal
    orderedQty:   Decimal
    receivedQty:  Decimal
  }>()

  for (const item of poItems) {
    const sId   = item.purchaseOrder.siteId ?? '__no_site__'
    const sName = item.purchaseOrder.site?.name ?? '현장 미지정'
    const key: Key = `${sId}::${item.itemNameSnapshot}::${item.specSnapshot ?? ''}`

    if (!map.has(key)) {
      map.set(key, {
        siteId:       item.purchaseOrder.siteId,
        siteName:     sName,
        itemName:     item.itemNameSnapshot,
        spec:         item.specSnapshot ?? null,
        unit:         item.unitSnapshot ?? null,
        requestedQty: new Decimal(0),
        orderedQty:   new Decimal(0),
        receivedQty:  new Decimal(0),
      })
    }

    const row = map.get(key)!
    row.requestedQty = row.requestedQty.plus(item.materialRequestItem.requestedQty)
    row.orderedQty   = row.orderedQty.plus(item.orderedQuantity)
    row.receivedQty  = row.receivedQty.plus(item.receivedQuantity)
  }

  const rows = Array.from(map.values())
    .map(r => ({
      siteId:          r.siteId,
      siteName:        r.siteName,
      itemName:        r.itemName,
      spec:            r.spec,
      unit:            r.unit,
      requestedQty:    r.requestedQty.toFixed(4),
      orderedQty:      r.orderedQty.toFixed(4),
      receivedQty:     r.receivedQty.toFixed(4),
      pendingReceiveQty: r.orderedQty.minus(r.receivedQty).toFixed(4),
      pendingOrderQty:  r.requestedQty.minus(r.orderedQty).toFixed(4),
    }))
    .sort((a, b) => (a.siteName + a.itemName).localeCompare(b.siteName + b.itemName))

  // 현장 목록 (필터용)
  const sites = await prisma.site.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  return ok({ rows, sites })
}
