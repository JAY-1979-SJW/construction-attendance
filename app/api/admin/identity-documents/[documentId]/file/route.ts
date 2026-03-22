/**
 * GET /api/admin/identity-documents/[documentId]/file
 *
 * variant 파라미터:
 *   masked   — 마스킹 이미지 (ADMIN, SUPER_ADMIN, VIEWER 열람 가능)
 *   original — 원본 이미지   (ADMIN, SUPER_ADMIN 전용)
 *   download — 원본 다운로드 (SUPER_ADMIN 전용 + 감사로그)
 *
 * 모든 열람은 감사로그에 기록된다.
 * 원본/다운로드는 권한 위반 시도도 로그에 기록된다.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { readIdentityFile } from '@/lib/storage/identity-storage'
import { logAccess } from '@/lib/identity/identity-document-service'

const ORIGINAL_ROLES   = ['SUPER_ADMIN', 'ADMIN']
const DOWNLOAD_ROLES   = ['SUPER_ADMIN']

function getClientIp(req: NextRequest): string | null {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    null
  )
}

export async function GET(req: NextRequest, { params }: { params: { documentId: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const variant    = new URL(req.url).searchParams.get('variant') ?? 'masked'
  const ipAddress  = getClientIp(req)
  const doc        = await prisma.workerIdentityDocument.findUnique({ where: { id: params.documentId } })
  if (!doc) return NextResponse.json({ error: '문서를 찾을 수 없습니다.' }, { status: 404 })

  // ── 권한 검사 ────────────────────────────────────────────────
  if (variant === 'original' && !ORIGINAL_ROLES.includes(session.role ?? '')) {
    await logAccess({
      workerId: doc.workerId, documentId: doc.id,
      actionType: 'VIEW_ORIGINAL',
      actorUserId: session.sub, actorRole: session.role ?? '',
      ipAddress: ipAddress ?? undefined,
      reason: '권한 위반 시도 — VIEW_ORIGINAL 거부',
    })
    return NextResponse.json({ error: '원본 열람 권한이 없습니다.' }, { status: 403 })
  }

  if (variant === 'download' && !DOWNLOAD_ROLES.includes(session.role ?? '')) {
    await logAccess({
      workerId: doc.workerId, documentId: doc.id,
      actionType: 'DOWNLOAD_ORIGINAL',
      actorUserId: session.sub, actorRole: session.role ?? '',
      ipAddress: ipAddress ?? undefined,
      reason: '권한 위반 시도 — DOWNLOAD_ORIGINAL 거부',
    })
    return NextResponse.json({ error: '원본 다운로드는 최고 관리자만 가능합니다.' }, { status: 403 })
  }

  // ── 파일 읽기 ────────────────────────────────────────────────
  const isDownload = variant === 'download'
  const isOriginal = variant === 'original' || isDownload
  const fileKey    = isOriginal ? doc.originalFileKey : (doc.maskedFileKey ?? doc.originalFileKey)

  try {
    const buffer = await readIdentityFile(fileKey)

    // 감사로그
    const actionType = isDownload ? 'DOWNLOAD_ORIGINAL' : isOriginal ? 'VIEW_ORIGINAL' : 'VIEW_MASKED'
    await logAccess({
      workerId: doc.workerId, documentId: doc.id,
      actionType,
      actorUserId: session.sub, actorRole: session.role ?? '',
      ipAddress: ipAddress ?? undefined,
    })

    const headers: Record<string, string> = {
      'Content-Type':             isOriginal ? doc.fileMimeType : 'image/jpeg',
      'Cache-Control':            'no-store, no-cache, must-revalidate',
      'X-Content-Type-Options':   'nosniff',
      'Content-Security-Policy':  "default-src 'none'",
    }

    // 다운로드 시 Content-Disposition: attachment
    if (isDownload) {
      const ext = doc.fileMimeType === 'image/png' ? 'png' : 'jpg'
      headers['Content-Disposition'] = `attachment; filename="id-original-${doc.workerId.slice(-8)}.${ext}"`
    }

    return new NextResponse(new Uint8Array(buffer), { headers })
  } catch {
    return NextResponse.json({ error: '파일을 읽을 수 없습니다.' }, { status: 500 })
  }
}
