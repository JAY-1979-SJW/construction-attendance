/**
 * GET /api/admin/workers/[id]/onboarding-docs/[docType]/file
 * 온보딩 문서의 최신 제출 파일을 반환 (건강증빙 등 UPLOAD 유형 미리보기용)
 * ?inline=1 → 브라우저에서 열기, 없으면 다운로드
 */
import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { readDocumentFile } from '@/lib/storage/document-storage'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docType: string }> }
) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: workerId, docType } = await params
  const { searchParams } = new URL(request.url)
  const inline = searchParams.get('inline') === '1'

  // 최신 제출 기록에서 fileId 조회
  const doc = await prisma.onboardingDocument.findFirst({
    where: { workerId, docType: docType as any },
    select: {
      id: true,
      latestSubmissionId: true,
      title: true,
    },
  })

  if (!doc?.latestSubmissionId) {
    return NextResponse.json({ error: '제출된 파일이 없습니다.' }, { status: 404 })
  }

  const submission = await prisma.onboardingDocSubmission.findUnique({
    where: { id: doc.latestSubmissionId },
    include: {
      file: true,
    },
  })

  if (!submission?.file) {
    return NextResponse.json({ error: '파일을 찾을 수 없습니다.' }, { status: 404 })
  }

  let buffer: Buffer
  try {
    buffer = await readDocumentFile(submission.file.path)
  } catch {
    return NextResponse.json({ error: '파일을 읽을 수 없습니다.' }, { status: 500 })
  }

  const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined
  await writeAuditLog({
    actorUserId: session.sub,
    actorType: 'ADMIN',
    actionType: inline ? 'DOCUMENT_VIEW' : 'DOCUMENT_DOWNLOAD',
    targetType: 'Worker',
    targetId: workerId,
    summary: `온보딩 문서 ${inline ? '열람' : '다운로드'}: ${doc.title || docType} (${submission.file.originalFilename})`,
    ipAddress,
    metadataJson: { docType, filename: submission.file.originalFilename },
  })

  const disposition = inline
    ? `inline; filename*=UTF-8''${encodeURIComponent(submission.file.originalFilename)}`
    : `attachment; filename*=UTF-8''${encodeURIComponent(submission.file.originalFilename)}`

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': submission.file.mimeType,
      'Content-Disposition': disposition,
      'Content-Length': String(buffer.length),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
