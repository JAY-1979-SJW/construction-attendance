import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { runSubcontractorSettlement } from '@/lib/labor/subcontractor-settlement'

export async function POST(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { monthKey, siteId, subcontractorId } = body

  if (!monthKey) return NextResponse.json({ error: 'monthKey required' }, { status: 400 })

  try {
    const count = await runSubcontractorSettlement({ monthKey, siteId, subcontractorId })
    return NextResponse.json({ success: true, count })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '정산 실패'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
