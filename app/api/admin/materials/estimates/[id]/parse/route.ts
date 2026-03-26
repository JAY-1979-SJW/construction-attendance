import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { ok, unauthorized, notFound, conflict } from '@/lib/utils/response'
import { parseEstimateDocument } from '@/lib/materials/estimate-parser'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { id } = await params
  const doc = await prisma.estimateDocument.findUnique({
    where: { id },
    select: { parseStatus: true },
  })
  if (!doc) return notFound('내역서를 찾을 수 없습니다')
  if (doc.parseStatus === 'PARSING') return conflict('이미 파싱 중입니다')

  // 비동기 재파싱 (fire & forget)
  parseEstimateDocument(id).catch(() => {})

  return ok({ id, message: '재파싱 시작됨' })
}
