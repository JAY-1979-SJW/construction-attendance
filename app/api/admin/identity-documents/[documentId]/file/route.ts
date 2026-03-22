import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { readIdentityFile } from '@/lib/storage/identity-storage'
import { logAccess } from '@/lib/identity/identity-document-service'

const ORIGINAL_ROLES = ['SUPER_ADMIN', 'ADMIN']

export async function GET(req: NextRequest, { params }: { params: { documentId: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const variant = new URL(req.url).searchParams.get('variant') ?? 'masked'
  const doc = await prisma.workerIdentityDocument.findUnique({ where: { id: params.documentId } })
  if (!doc) return NextResponse.json({ error: '문서를 찾을 수 없습니다.' }, { status: 404 })

  if (variant === 'original' && !ORIGINAL_ROLES.includes(session.role ?? '')) {
    return NextResponse.json({ error: '원본 열람 권한이 없습니다.' }, { status: 403 })
  }

  const fileKey = variant === 'original' ? doc.originalFileKey : (doc.maskedFileKey ?? doc.originalFileKey)
  try {
    const buffer = await readIdentityFile(fileKey)
    await logAccess({
      workerId: doc.workerId, documentId: doc.id,
      actionType: variant === 'original' ? 'VIEW_ORIGINAL' : 'VIEW_MASKED',
      actorUserId: session.sub, actorRole: session.role ?? '',
    })
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': variant === 'masked' ? 'image/jpeg' : doc.fileMimeType,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return NextResponse.json({ error: '파일을 읽을 수 없습니다.' }, { status: 500 })
  }
}
