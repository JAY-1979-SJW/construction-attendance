import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAdminSession } from '@/lib/auth/guards'
import { ok, badRequest, unauthorized, conflict } from '@/lib/utils/response'
import { receiveGoods } from '@/lib/materials/goods-receipt-service'

const ItemSchema = z.object({
  poItemId:       z.string().min(1),
  quantity:       z.number().positive('수량은 0보다 커야 합니다.'),
  inspectionNote: z.string().optional(),
})

const ReceiveSchema = z.object({
  items: z.array(ItemSchema).min(1, '입고 항목이 최소 1개 이상 필요합니다.'),
  memo:  z.string().optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = ReceiveSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.errors[0].message)

  try {
    const result = await receiveGoods({
      purchaseOrderId: id,
      items:           parsed.data.items,
      memo:            parsed.data.memo,
      userId:          session.sub,
    })
    return ok(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '입고 처리 실패'
    return conflict(message)
  }
}
