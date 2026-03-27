import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { uploadIdentityDocument } from '@/lib/identity/identity-document-service'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })

    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedMimes.includes(file.type)) return NextResponse.json({ error: '지원하지 않는 파일 형식입니다.' }, { status: 400 })
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: '파일 크기는 10MB 이하여야 합니다.' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await uploadIdentityDocument({
      workerId: params.id, buffer, mimeType: file.type,
      uploadedBy: session.sub, actorRole: session.role ?? 'ADMIN',
    })

    await writeAuditLog({
      actorUserId: session.sub,
      actorRole:   session.role,
      actionType:  'IDENTITY_DOCUMENT_UPLOAD',
      targetType:  'Worker',
      targetId:    params.id,
      summary:     `신분증 업로드: ${file.name}`,
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[identity upload]', err)
    return NextResponse.json({ error: '업로드 실패' }, { status: 500 })
  }
}
