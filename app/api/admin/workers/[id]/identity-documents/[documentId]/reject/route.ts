import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession, requireRole, MUTATE_ROLES } from '@/lib/auth/guards'
import { rejectDocument } from '@/lib/identity/identity-document-service'

export async function POST(req: NextRequest, { params }: { params: { id: string; documentId: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const deny = requireRole(session, MUTATE_ROLES)
  if (deny) return deny
  const body = await req.json().catch(() => ({}))
  if (!['REJECTED', 'RESCAN_REQUIRED'].includes(body.reviewStatus)) return NextResponse.json({ error: '유효하지 않은 상태' }, { status: 400 })
  try {
    await rejectDocument(params.id, params.documentId, body.reviewStatus, body.reason ?? '', session.sub, session.role ?? 'ADMIN')
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : '실패' }, { status: 400 })
  }
}
