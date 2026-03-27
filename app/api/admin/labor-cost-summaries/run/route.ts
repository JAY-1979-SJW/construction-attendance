import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { runLaborCostSummary } from '@/lib/labor/labor-cost-summary'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

export async function POST(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { monthKey, siteId } = body

  if (!monthKey) return NextResponse.json({ error: 'monthKey required' }, { status: 400 })

  try {
    const count = await runLaborCostSummary({ monthKey, siteId })

    await writeAuditLog({
      actorUserId: session.sub,
      actorType: 'ADMIN',
      actorRole: session.role,
      actionType: 'LABOR_COST_SUMMARY_RUN',
      targetType: 'LaborCostSummary',
      targetId: monthKey,
      summary: `노무비 집계 실행: ${monthKey} (${count}건)`,
      metadataJson: { monthKey, siteId, summaryCount: count },
    })

    return NextResponse.json({ success: true, summaryCount: count })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '집계 실패'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
