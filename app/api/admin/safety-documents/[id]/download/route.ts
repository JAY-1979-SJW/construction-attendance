/**
 * GET /api/admin/safety-documents/[id]/download
 * 안전서류 텍스트 파일 다운로드
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const doc = await prisma.safetyDocument.findUnique({
    where: { id: params.id },
    include: { worker: { select: { name: true } } },
  })
  if (!doc) return NextResponse.json({ error: '문서 없음' }, { status: 404 })

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
