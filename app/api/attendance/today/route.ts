import { getWorkerSession } from '@/lib/auth/guards'
import { getTodayStatus } from '@/lib/attendance/get-today-status'
import { ok, unauthorized, internalError } from '@/lib/utils/response'

export async function GET() {
  try {
    const session = await getWorkerSession()
    if (!session) return unauthorized()

    const status = await getTodayStatus(session.sub)
    return ok(status)
  } catch (err) {
    console.error('[attendance/today]', err)
    return internalError()
  }
}
