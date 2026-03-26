import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession, buildWorkerScopeWhere } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { readDocumentFile } from '@/lib/storage/document-storage'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

function getClientIp(req: NextRequest): string | null {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: workerId, documentId } = await params
  const { searchParams } = new URL(request.url)
  const inline = searchParams.get('inline') === '1'  // inline=1 이면 브라우저에서 열기, 아니면 다운로드

  // site scope 검사: workerId가 접근 가능한 범위인지 확인
  const scopeWhere = await buildWorkerScopeWhere(session)
  if (scopeWhere === false) return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
  if (Object.keys(scopeWhere).length > 0) {
    const allowed = await prisma.worker.findFirst({
      where: { id: workerId, ...scopeWhere },
      select: { id: true },
    })
    if (!allowed) return NextResponse.json({ error: '이 근로자에 대한 접근 권한이 없습니다.' }, { status: 403 })
  }

  const doc = await prisma.workerDocument.findFirst({
    where: { id: documentId, workerId },
    include: {
      file: true,
      worker: { select: { name: true } },
    },
  })

  if (!doc) return NextResponse.json({ error: '문서를 찾을 수 없습니다.' }, { status: 404 })

  // 신분증은 SUPER_ADMIN/ADMIN만 직접 열람 허용
  const sensitiveTypes = ['ID_CARD']
  const allowedRoles   = ['SUPER_ADMIN', 'ADMIN']
  if (sensitiveTypes.includes(doc.documentType) && !allowedRoles.includes(session.role ?? '')) {
    return NextResponse.json({ error: '열람 권한이 없습니다.' }, { status: 403 })
  }

  let buffer: Buffer
  try {
    buffer = await readDocumentFile(doc.file.path)
  } catch {
    return NextResponse.json({ error: '파일을 읽을 수 없습니다.' }, { status: 500 })
  }

  const actionType = inline ? 'DOCUMENT_VIEW' : 'DOCUMENT_DOWNLOAD'
  await writeAuditLog({
    actorUserId: session.sub,
    actorType: 'ADMIN',
    actionType,
    targetType: 'Worker',
    targetId: workerId,
    summary: `문서 ${inline ? '열람' : '다운로드'}: ${doc.worker.name} — ${doc.documentType} (${doc.file.originalFilename})`,
    ipAddress: getClientIp(request) ?? undefined,
    metadataJson: { documentId, documentType: doc.documentType, filename: doc.file.originalFilename },
  })

  const disposition = inline
    ? `inline; filename*=UTF-8''${encodeURIComponent(doc.file.originalFilename)}`
    : `attachment; filename*=UTF-8''${encodeURIComponent(doc.file.originalFilename)}`

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': doc.file.mimeType,
      'Content-Disposition': disposition,
      'Content-Length': String(buffer.length),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
