import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession, requireRole, MUTATE_ROLES } from '@/lib/auth/guards'
import { verifyDocument } from '@/lib/identity/identity-document-service'

export async function POST(req: NextRequest, { params }: { params: { id: string; documentId: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const deny = requireRole(session, MUTATE_ROLES)
  if (deny) return deny
  try {
    await verifyDocument(params.id, params.documentId, session.sub, session.role ?? 'ADMIN')
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : '실패' }, { status: 400 })
  }
}
