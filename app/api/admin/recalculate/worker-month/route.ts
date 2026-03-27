import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { recalculateWorkerMonth } from '@/lib/labor/recalculate'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

export async function POST(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { monthKey, workerIds, reason } = body

  if (!monthKey || !workerIds?.length) {
    return NextResponse.json({ error: 'monthKey and workerIds required' }, { status: 400 })
  }

  try {
    await recalculateWorkerMonth({ monthKey, workerIds, actedBy: session.sub, reason })

    await writeAuditLog({
      actorUserId: session.sub,
      actorType: 'ADMIN',
      actorRole: session.role,
      actionType: 'RECALCULATE_WORKER_MONTH',
      targetType: 'WorkerMonth',
      targetId: monthKey,
      summary: `근로자별 월 재산출: ${monthKey} (${workerIds.length}명)`,
      metadataJson: { monthKey, workerIds, reason },
    })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '재산출 실패'
    return NextResponse.json({ error: msg }, { status: 422 })
  }
}
