import { NextRequest } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { ok, unauthorized, badRequest, internalError } from '@/lib/utils/response'
import { runTaxCalculation } from '@/lib/labor/tax'

// POST /api/admin/wage-calculations/run
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

    const result = await runTaxCalculation({ monthKey, workerId })
    return ok({ monthKey, ...result })
  } catch (err) {
    console.error('[wage-calculations/run]', err)
    return internalError()
  }
}
