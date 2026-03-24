import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { ok, unauthorized, notFound, conflict, badRequest } from '@/lib/utils/response'
import { transitionPOStatus, PurchaseOrderTransitionError } from '@/lib/materials/purchase-order-service'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { id } = await params
  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    select: { status: true, _count: { select: { items: true } } },
  })
  if (!order) return notFound('발주서를 찾을 수 없습니다.')
  if (order._count.items === 0) {
    return badRequest('항목이 1개 이상 있어야 발행할 수 있습니다.')
  }

  try {
    await transitionPOStatus({
      orderId: id,
      from:    order.status,
      to:      'ISSUED',
      userId:  session.sub,
      extra:   { issuedAt: new Date(), orderedAt: new Date() },
    })
  } catch (e) {
    if (e instanceof PurchaseOrderTransitionError) return conflict(e.message)
    throw e
  }

  return ok({ status: 'ISSUED' })
}
