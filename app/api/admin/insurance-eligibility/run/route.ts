import { NextRequest } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { ok, unauthorized, badRequest, internalError } from '@/lib/utils/response'
import { runInsuranceEligibility } from '@/lib/labor/insurance'
import { isMonthLocked } from '@/lib/labor/month-closing'

// POST /api/admin/insurance-eligibility/run
// { monthKey, workerId? }
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const body = await req.json().catch(() => ({}))
    const { monthKey, workerId } = body

    if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
      return badRequest('INVALID_MONTH_KEY')
    }

    const locked = await isMonthLocked(monthKey)
    if (locked) return badRequest('마감 완료된 월입니다. 재오픈 후 수정하세요.')

    const result = await runInsuranceEligibility({ monthKey, workerId })
    return ok({ monthKey, ...result })
  } catch (err) {
    console.error('[insurance-eligibility/run]', err)
    return internalError()
  }
}
