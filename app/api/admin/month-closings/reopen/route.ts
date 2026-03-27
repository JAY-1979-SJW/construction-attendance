import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { reopenMonth } from '@/lib/labor/month-closing'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

export async function POST(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { monthKey, reason } = body

  if (!monthKey || !reason) return NextResponse.json({ error: 'monthKey and reason required' }, { status: 400 })

  try {
    await reopenMonth(monthKey, session.sub, reason)

    await writeAuditLog({
      actorUserId: session.sub,
      actorType: 'ADMIN',
      actorRole: session.role,
      actionType: 'MONTH_CLOSING_REOPEN',
      targetType: 'MonthClosing',
      targetId: monthKey,
      summary: `월 마감 재오픈: ${monthKey} (사유: ${reason})`,
    })

    return NextResponse.json({ success: true, message: `${monthKey} 재오픈 완료` })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '재오픈 실패'
    return NextResponse.json({ error: msg }, { status: 422 })
  }
}
