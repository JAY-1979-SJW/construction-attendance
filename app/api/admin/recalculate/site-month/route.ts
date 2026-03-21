import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { recalculateSiteMonth } from '@/lib/labor/recalculate'

export async function POST(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { monthKey, siteId, reason } = body

  if (!monthKey || !siteId) {
    return NextResponse.json({ error: 'monthKey and siteId required' }, { status: 400 })
  }

  try {
    await recalculateSiteMonth({ monthKey, siteId, actedBy: session.sub, reason })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '재산출 실패'
    return NextResponse.json({ error: msg }, { status: 422 })
  }
}
