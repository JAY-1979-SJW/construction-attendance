import { NextRequest } from 'next/server'
import { ok, unauthorized, internalError } from '@/lib/utils/response'
import { aggregateAttendanceDays } from '@/lib/labor/attendance-days'
import { toKSTDateString } from '@/lib/utils/date'

// GET /api/cron/aggregate-attendance-days?date=YYYY-MM-DD&dryRun=true
// cron secret으로 보호
export async function GET(req: NextRequest) {
  try {
    const secret = req.headers.get('x-cron-secret')
    if (secret !== process.env.CRON_SECRET) return unauthorized()

    const { searchParams } = new URL(req.url)
    const workDate = searchParams.get('date') ?? toKSTDateString()
    const dryRun   = searchParams.get('dryRun') === 'true'

    if (dryRun) {
      return ok({ dryRun: true, workDate, message: '집계 시뮬레이션 — DB 변경 없음' })
    }

    const result = await aggregateAttendanceDays({ workDate })
    return ok({ workDate, ...result })
  } catch (err) {
    console.error('[cron/aggregate-attendance-days]', err)
    return internalError()
  }
}
