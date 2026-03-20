import { NextRequest } from 'next/server'
import { checkInSchema } from '@/lib/validators/attendance'
import { processCheckIn } from '@/lib/attendance/check-in'
import { getWorkerSession } from '@/lib/auth/guards'
import { ok, badRequest, unauthorized, internalError } from '@/lib/utils/response'

export async function POST(request: NextRequest) {
  try {
    const session = await getWorkerSession()
    if (!session) return unauthorized()

    const body = await request.json()
    const parsed = checkInSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const result = await processCheckIn({
      workerId: session.sub,
      ...parsed.data,
    })

    if (!result.success) {
      return badRequest(result.message)
    }

    return ok({ attendanceId: result.attendanceId, distance: result.distance }, result.message)
  } catch (err) {
    console.error('[attendance/check-in]', err)
    return internalError()
  }
}
