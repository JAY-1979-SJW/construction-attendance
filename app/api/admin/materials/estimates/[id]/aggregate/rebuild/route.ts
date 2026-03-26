import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { ok, unauthorized, notFound, internalError } from '@/lib/utils/response'
import { rebuildAggregation } from '@/lib/materials/rebuild-aggregation'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { id } = await params
  const doc = await prisma.estimateDocument.findUnique({
    where: { id },
    select: { id: true },
  })
  if (!doc) return notFound('내역서를 찾을 수 없습니다')

  try {
    const result = await rebuildAggregation(id, session.sub)
    return ok(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : '재집계 실패'
    return internalError(msg)
  }
}
