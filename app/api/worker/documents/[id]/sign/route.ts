/**
 * POST /api/worker/documents/[id]/sign
 * 근로자 본인이 안전문서에 서명
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getWorkerSession } from '@/lib/auth/guards'

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getWorkerSession()
  if (!session) {
    return NextResponse.json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 })
  }

  const doc = await prisma.safetyDocument.findUnique({
    where: { id: params.id },
    include: { worker: { select: { id: true, name: true } } },
  })

  if (!doc) {
    return NextResponse.json({ success: false, message: '문서를 찾을 수 없습니다.' }, { status: 404 })
  }

  if (doc.workerId !== session.sub) {
    return NextResponse.json({ success: false, message: '본인 문서만 서명할 수 있습니다.' }, { status: 403 })
  }

  if (doc.status === 'SIGNED') {
    return NextResponse.json({ success: false, message: '이미 서명된 문서입니다.' }, { status: 409 })
  }

  const now = new Date()
  await prisma.safetyDocument.update({
    where: { id: params.id },
    data: {
      status: 'SIGNED',
      signedAt: now,
      signedBy: doc.worker.name,
    },
  })

  return NextResponse.json({ success: true, data: { signedAt: now } })
}
