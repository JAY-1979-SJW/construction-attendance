/**
 * GET /api/worker/documents/[id]/download
 * 근로자 본인 문서 다운로드 (본인 문서만)
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getWorkerSession } from '@/lib/auth/guards'

export async function GET(
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
    return NextResponse.json({ success: false, message: '접근 권한이 없습니다.' }, { status: 403 })
  }

  const text = doc.contentText || `[${doc.documentType}] ${doc.worker.name} - ${doc.documentDate ?? ''}`
  const fileName = `${doc.documentType}_${doc.worker.name}_${doc.documentDate ?? 'draft'}.txt`
  const encoded = encodeURIComponent(fileName)

  return new NextResponse(text, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename*=UTF-8''${encoded}`,
    },
  })
}
