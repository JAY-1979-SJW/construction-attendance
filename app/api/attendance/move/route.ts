import { NextRequest } from 'next/server'
import { moveSchema } from '@/lib/validators/attendance'
import { processMove } from '@/lib/attendance/move'
import { getWorkerSession } from '@/lib/auth/guards'
import { ok, badRequest, unauthorized, internalError } from '@/lib/utils/response'

export async function POST(request: NextRequest) {
  try {
    const session = await getWorkerSession()
    if (!session) return unauthorized()

    const body = await request.json()
    const parsed = moveSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const result = await processMove({
      workerId: session.sub,
      ...parsed.data,
    })

    if (!result.success) {
      return badRequest(result.message)
    }

    return ok(
      {
        eventId: result.eventId,
        distance: result.distance,
        newSiteId: result.newSiteId,
        newSiteName: result.newSiteName,
      },
      result.message
    )
  } catch (err) {
    console.error('[attendance/move]', err)
    return internalError()
  }
}
