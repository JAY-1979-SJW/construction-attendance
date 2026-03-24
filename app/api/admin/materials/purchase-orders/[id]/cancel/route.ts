import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { ok, unauthorized, notFound, conflict } from '@/lib/utils/response'
import { transitionPOStatus, PurchaseOrderTransitionError } from '@/lib/materials/purchase-order-service'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { id } = await params
  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    select: { status: true },
  })
  if (!order) return notFound('발주서를 찾을 수 없습니다.')

  const body = await req.json().catch(() => ({}))

  try {
    await transitionPOStatus({
      orderId: id,
      from:    order.status,
      to:      'CANCELLED',
      userId:  session.sub,
      reason:  body?.reason ?? undefined,
      extra:   { cancelledAt: new Date() },
    })
  } catch (e) {
    if (e instanceof PurchaseOrderTransitionError) return conflict(e.message)
    throw e
  }

  return ok({ status: 'CANCELLED' })
}
