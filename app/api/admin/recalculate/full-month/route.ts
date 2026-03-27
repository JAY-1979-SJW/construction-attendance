import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { recalculateFullMonth } from '@/lib/labor/recalculate'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

export async function POST(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { monthKey, reason } = body

  if (!monthKey) {
    return NextResponse.json({ error: 'monthKey required' }, { status: 400 })
  }

  try {
    await recalculateFullMonth({ monthKey, actedBy: session.sub, reason })

    await writeAuditLog({
      actorUserId: session.sub,
      actorType: 'ADMIN',
      actorRole: session.role,
      actionType: 'RECALCULATE_FULL_MONTH',
      targetType: 'FullMonth',
      targetId: monthKey,
      summary: `전체 월 재산출: ${monthKey}`,
      metadataJson: { monthKey, reason },
    })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '재산출 실패'
    return NextResponse.json({ error: msg }, { status: 422 })
  }
}
