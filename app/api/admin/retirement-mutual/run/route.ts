import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { runRetirementMutual } from '@/lib/labor/retirement-mutual-engine'

export async function POST(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { monthKey, siteId } = body

  if (!monthKey) return NextResponse.json({ error: 'monthKey required' }, { status: 400 })

  try {
    const result = await runRetirementMutual({ monthKey, siteId, actedBy: session.sub })
    return NextResponse.json({ success: true, ...result })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '퇴직공제 실행 실패'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
