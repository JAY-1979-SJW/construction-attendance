import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { ok, unauthorized, notFound } from '@/lib/utils/response'
import { getRequestItemOrderStatus } from '@/lib/materials/purchase-order-service'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { id } = await params
  const request = await prisma.materialRequest.findUnique({
    where: { id },
    select: { id: true, status: true, requestNo: true, title: true },
  })
  if (!request) return notFound('청구서를 찾을 수 없습니다.')

  const items = await getRequestItemOrderStatus(id)

  return ok({
    request: { id: request.id, requestNo: request.requestNo, title: request.title, status: request.status },
    items,
  })
}
