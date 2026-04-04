import { NextRequest } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { ok, unauthorized, badRequest, internalError } from '@/lib/utils/response'
import { autoConfirmQualified } from '@/lib/labor/work-confirmations'
import { isMonthLocked } from '@/lib/labor/month-closing'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

/**
 * POST /api/admin/work-confirmations/auto-confirm
 * { monthKey, siteId?, workerId? }
 *
 * 근무 인정 규칙 자동 판정 + 확정:
 *   - presenceStatus = NORMAL
 *   - confirmedWorkType = FULL_DAY (실근로 ≥ 480분 = 07:00~16:00 기준)
 *   - 기준 미충족 건은 DRAFT 유지 (수동 검토 대기)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const body = await req.json().catch(() => ({}))
    const { monthKey, siteId, workerId } = body

    if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
      return badRequest('INVALID_MONTH_KEY')
    }

    const locked = await isMonthLocked(monthKey)
    if (locked) return badRequest('마감 완료된 월입니다. 재오픈 후 수정하세요.')

    const result = await autoConfirmQualified({
      monthKey,
      siteId,
      workerId,
      confirmedBy: session.sub,
    })

    await writeAuditLog({
      actorUserId: session.sub,
      actorType:   'ADMIN',
      actorRole:   session.role,
      actionType:  'WORK_CONFIRMATION_AUTO_CONFIRM',
      targetType:  'MonthlyWorkConfirmation',
      targetId:    monthKey,
      summary:     `근무 인정 자동 판정: ${monthKey} — 확정 ${result.autoConfirmed}건, 검토 대기 ${result.skipped}건`,
      metadataJson: { monthKey, siteId, workerId, ...result },
    })

    return ok({
      monthKey,
      autoConfirmed: result.autoConfirmed,   // NORMAL + FULL_DAY → 자동 확정
      pendingReview: result.skipped,          // 기준 미충족 → DRAFT 유지
      errors:        result.errors,
    })
  } catch (err) {
    console.error('[work-confirmations/auto-confirm]', err)
    return internalError()
  }
}
