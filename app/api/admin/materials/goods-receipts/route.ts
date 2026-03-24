import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { ok, unauthorized } from '@/lib/utils/response'

export async function GET(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { searchParams } = req.nextUrl
  const purchaseOrderId = searchParams.get('purchaseOrderId') ?? ''
  const page     = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const pageSize = Math.min(50, parseInt(searchParams.get('pageSize') ?? '20', 10))

  const where: Record<string, unknown> = {}
  if (purchaseOrderId) where.purchaseOrderId = purchaseOrderId

  const [total, receipts] = await Promise.all([
    prisma.goodsReceipt.count({ where }),
    prisma.goodsReceipt.findMany({
      where,
      select: {
        id:               true,
        receiptNo:        true,
        purchaseOrderId:  true,
        receivedByUserId: true,
        receivedAt:       true,
        memo:             true,
        createdAt:        true,
        purchaseOrder:    { select: { orderNo: true } },
        _count:           { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip:  (page - 1) * pageSize,
      take:  pageSize,
    }),
  ])

  return ok({ receipts, total, page, pageSize, totalPages: Math.ceil(total / pageSize) })
}
