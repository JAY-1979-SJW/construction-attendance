import { NextRequest } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { ok, unauthorized, badRequest, internalError } from '@/lib/utils/response'
import { generateDraftConfirmations } from '@/lib/labor/work-confirmations'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

// POST /api/admin/work-confirmations/generate
// { monthKey, siteId?, workerId? }
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const body = await req.json().catch(() => ({}))
    const { monthKey, siteId, workerId } = body

    if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
      return badRequest('INVALID_MONTH_KEY')
    }

    // 1. 일별 집계 먼저 수행 (해당 월 전체)
    const { aggregateAttendanceDays } = await import('@/lib/labor/attendance-days')
    const [year, month] = monthKey.split('-').map(Number)
    const endDay = new Date(year, month, 0).getDate()
    let aggTotal = 0
    for (let d = 1; d <= endDay; d++) {
      const workDate = `${monthKey}-${String(d).padStart(2, '0')}`
      const r = await aggregateAttendanceDays({ workDate, siteId, workerId })
      aggTotal += r.created + r.updated
    }

    // 2. DRAFT 근무확정 생성
    const result = await generateDraftConfirmations({ monthKey, siteId, workerId })

    await writeAuditLog({
      actorUserId: session.sub,
      actorType: 'ADMIN',
      actorRole: session.role,
      actionType: 'WORK_CONFIRMATION_GENERATE',
      targetType: 'MonthlyWorkConfirmation',
      targetId: monthKey,
      summary: `근무확정 DRAFT 생성: ${monthKey} (집계 ${aggTotal}건, 생성 ${result.created ?? 0}건)`,
      metadataJson: { monthKey, siteId, workerId, aggregated: aggTotal, ...result },
    })

    return ok({ aggregated: aggTotal, ...result, monthKey })
  } catch (err) {
    console.error('[work-confirmations/generate]', err)
    return internalError()
  }
}
