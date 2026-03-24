import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { ok, badRequest, unauthorized, notFound, conflict } from '@/lib/utils/response'

const PatchSchema = z.object({
  vendorId:             z.string().optional().nullable(),
  memo:                 z.string().optional().nullable(),
  deliveryRequestedDate: z.string().optional().nullable(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { id } = await params
  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      materialRequest: { select: { id: true, requestNo: true, title: true, status: true } },
      site:            { select: { id: true, name: true } },
      items: {
        orderBy: { createdAt: 'asc' },
      },
      history: { orderBy: { createdAt: 'desc' } },
    },
  })
  if (!order) return notFound('발주서를 찾을 수 없습니다.')

  return ok(order)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { id } = await params
  const order = await prisma.purchaseOrder.findUnique({ where: { id }, select: { status: true } })
  if (!order) return notFound('발주서를 찾을 수 없습니다.')
  if (order.status !== 'DRAFT') {
    return conflict('작성중 상태에서만 수정할 수 있습니다.')
  }

  const body = await req.json().catch(() => null)
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.errors[0].message)

  const { vendorId, memo, deliveryRequestedDate } = parsed.data
  const updated = await prisma.purchaseOrder.update({
    where: { id },
    data: {
      ...(vendorId !== undefined && { vendorId }),
      ...(memo !== undefined && { memo }),
      ...(deliveryRequestedDate !== undefined && {
        deliveryRequestedDate: deliveryRequestedDate ? new Date(deliveryRequestedDate) : null,
      }),
      updatedAt: new Date(),
    },
    select: { id: true, status: true, updatedAt: true },
  })

  return ok(updated)
}
