import { NextRequest } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { ok, unauthorized, badRequest, internalError } from '@/lib/utils/response'
import { finalizeMonth } from '@/lib/labor/work-confirmations'
import { runInsuranceEligibility } from '@/lib/labor/insurance'
import { runTaxCalculation } from '@/lib/labor/tax'
import { isMonthLocked } from '@/lib/labor/month-closing'

// POST /api/admin/work-confirmations/finalize
// { monthKey, siteId? } — 해당 월 DRAFT 일괄 확정 + 보험판정 + 세금계산 자동 실행
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const body = await req.json().catch(() => ({}))
    const { monthKey, siteId } = body

    if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
      return badRequest('INVALID_MONTH_KEY')
    }

    const locked = await isMonthLocked(monthKey)
    if (locked) return badRequest('마감 완료된 월입니다. 재오픈 후 수정하세요.')

    const [confirmResult, insuranceResult, taxResult] = await Promise.all([
      finalizeMonth(monthKey, session.sub, siteId),
      runInsuranceEligibility({ monthKey }),
      runTaxCalculation({ monthKey }),
    ])

    return ok({
      monthKey,
      confirmed:       confirmResult.confirmed,
      insuranceResult,
      taxResult,
    })
  } catch (err) {
    console.error('[work-confirmations/finalize]', err)
    return internalError()
  }
}
