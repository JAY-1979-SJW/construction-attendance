import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { ok, unauthorized, notFound } from '@/lib/utils/response'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { id } = await params
  const receipt = await prisma.goodsReceipt.findUnique({
    where: { id },
    include: {
      purchaseOrder: { select: { id: true, orderNo: true, status: true } },
      items: {
        include: {
          poItem: {
            select: {
              id:               true,
              itemNameSnapshot: true,
              specSnapshot:     true,
              unitSnapshot:     true,
              orderedQuantity:  true,
              receivedQuantity: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (!receipt) return notFound('입고전표를 찾을 수 없습니다.')

  return ok(receipt)
}
