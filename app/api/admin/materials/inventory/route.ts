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

  // 기준: APPROVED 청구서의 항목 전체 (발주 여부 무관)
  const reqItems = await prisma.materialRequestItem.findMany({
    where: {
      request: {
        status: 'APPROVED',
        ...(siteId ? { siteId } : {}),
      },
    },
    select: {
      id:           true,
      itemName:     true,
      spec:         true,
      unit:         true,
      requestedQty: true,
      request: {
        select: {
          siteId: true,
          site:   { select: { id: true, name: true } },
        },
      },
      // 연결된 발주 항목 (취소된 발주 제외)
      purchaseOrderItems: {
        where: { purchaseOrder: { status: { not: 'CANCELLED' } } },
        select: {
          orderedQuantity:  true,
          receivedQuantity: true,
        },
      },
    },
  })

  // 현장 × 자재명 단위로 집계
  type Key = string
  const map = new Map<Key, {
    siteId:       string | null
    siteName:     string
    itemName:     string
    spec:         string | null
    unit:         string | null
    requestedQty: Decimal
    orderedQty:   Decimal
    receivedQty:  Decimal
  }>()

  for (const item of reqItems) {
    const sId   = item.request.siteId ?? '__no_site__'
    const sName = item.request.site?.name ?? '현장 미지정'
    const key: Key = `${sId}::${item.itemName}::${item.spec ?? ''}`

    if (!map.has(key)) {
      map.set(key, {
        siteId:       item.request.siteId,
        siteName:     sName,
        itemName:     item.itemName,
        spec:         item.spec ?? null,
        unit:         item.unit ?? null,
        requestedQty: new Decimal(0),
        orderedQty:   new Decimal(0),
        receivedQty:  new Decimal(0),
      })
    }

    const row = map.get(key)!
    row.requestedQty = row.requestedQty.plus(item.requestedQty)

    for (const poi of item.purchaseOrderItems) {
      row.orderedQty  = row.orderedQty.plus(poi.orderedQuantity)
      row.receivedQty = row.receivedQty.plus(poi.receivedQuantity)
    }
  }

  const rows = Array.from(map.values())
    .map(r => ({
      siteId:            r.siteId,
      siteName:          r.siteName,
      itemName:          r.itemName,
      spec:              r.spec,
      unit:              r.unit,
      requestedQty:      r.requestedQty.toFixed(4),
      orderedQty:        r.orderedQty.toFixed(4),
      receivedQty:       r.receivedQty.toFixed(4),
      pendingReceiveQty: Decimal.max(0, r.orderedQty.minus(r.receivedQty)).toFixed(4),
      pendingOrderQty:   Decimal.max(0, r.requestedQty.minus(r.orderedQty)).toFixed(4),
    }))
    .sort((a, b) => (a.siteName + a.itemName).localeCompare(b.siteName + b.itemName))

  const sites = await prisma.site.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  return ok({ rows, sites })
}
