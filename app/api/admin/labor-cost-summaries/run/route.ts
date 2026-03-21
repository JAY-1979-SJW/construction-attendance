import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { runLaborCostSummary } from '@/lib/labor/labor-cost-summary'

export async function POST(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { monthKey, siteId } = body

  if (!monthKey) return NextResponse.json({ error: 'monthKey required' }, { status: 400 })

  try {
    const count = await runLaborCostSummary({ monthKey, siteId })
    return NextResponse.json({ success: true, summaryCount: count })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '집계 실패'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
