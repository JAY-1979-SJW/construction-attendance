import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { runCompanySettlement } from '@/lib/labor/subcontractor-settlement'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

export async function POST(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { monthKey, siteId, companyId } = body

  if (!monthKey) return NextResponse.json({ error: 'monthKey required' }, { status: 400 })

  try {
    const count = await runCompanySettlement({ monthKey, siteId, companyId })

    await writeAuditLog({
      actorUserId: session.sub,
      actorType: 'ADMIN',
      actorRole: session.role,
      actionType: 'SUBCONTRACTOR_SETTLEMENT_RUN',
      targetType: 'CompanySettlement',
      targetId: monthKey,
      summary: `하도급 정산 실행: ${monthKey} (${count}건)`,
      metadataJson: { monthKey, siteId, companyId, count },
    })

    return NextResponse.json({ success: true, count })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '정산 실패'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
