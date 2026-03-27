import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { applyToWorker } from '@/lib/identity/identity-document-service'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

export async function POST(req: NextRequest, { params }: { params: { id: string; documentId: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  try {
    const result = await applyToWorker(params.id, params.documentId, session.sub, session.role ?? 'ADMIN', body.overwritePolicy ?? 'FILL_EMPTY_ONLY')

    await writeAuditLog({
      actorUserId: session.sub,
      actorRole:   session.role,
      actionType:  'IDENTITY_DOCUMENT_APPLY',
      targetType:  'Worker',
      targetId:    params.id,
      summary:     `신분증 정보 적용: documentId=${params.documentId}, policy=${body.overwritePolicy ?? 'FILL_EMPTY_ONLY'}`,
      metadataJson: { documentId: params.documentId, overwritePolicy: body.overwritePolicy ?? 'FILL_EMPTY_ONLY' },
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : '실패' }, { status: 400 })
  }
}
