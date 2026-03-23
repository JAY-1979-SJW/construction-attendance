import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { rebuildAggregation } from '@/lib/materials/rebuild-aggregation'

// 중복 실행 방지용 인메모리 잠금 (단일 인스턴스 환경)
const rebuilding = new Set<string>()

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const doc = await prisma.estimateDocument.findUnique({ where: { id: params.id }, select: { id: true } })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (rebuilding.has(params.id)) {
    return NextResponse.json({ error: '재집계가 이미 실행 중입니다. 잠시 후 다시 시도하세요.' }, { status: 409 })
  }

  rebuilding.add(params.id)
  try {
    const triggeredBy = (session as { id?: string; email?: string }).id ?? (session as { id?: string; email?: string }).email ?? 'admin'
    const result = await rebuildAggregation(params.id, triggeredBy)
    return NextResponse.json({ success: true, data: result })
  } finally {
    rebuilding.delete(params.id)
  }
}
