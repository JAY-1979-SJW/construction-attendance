import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { precheckMonthClosing } from '@/lib/labor/month-closing'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

export async function POST(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { monthKey } = body

  if (!monthKey) return NextResponse.json({ error: 'monthKey required' }, { status: 400 })

  const result = await precheckMonthClosing(monthKey)

  await writeAuditLog({
    actorUserId: session.sub,
    actorType: 'ADMIN',
    actorRole: session.role,
    actionType: 'MONTH_CLOSING_PRECHECK',
    targetType: 'MonthClosing',
    targetId: monthKey,
    summary: `월 마감 사전점검 실행: ${monthKey}`,
  })

  return NextResponse.json(result)
}
