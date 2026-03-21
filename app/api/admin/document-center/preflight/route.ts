import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { runPreflight } from '@/lib/labor/document-preflight-service'

export async function POST(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { monthKey, templateCode, siteId, subcontractorId } = body

  if (!monthKey || !templateCode) {
    return NextResponse.json({ error: 'monthKey and templateCode required' }, { status: 400 })
  }

  try {
    const result = await runPreflight(templateCode, { monthKey, siteId, subcontractorId }, session.sub)
    return NextResponse.json(result)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '사전검사 실패'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
