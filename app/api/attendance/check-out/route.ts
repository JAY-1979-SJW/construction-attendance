import { NextRequest } from 'next/server'
import { checkOutSchema } from '@/lib/validators/attendance'
import { processCheckOut } from '@/lib/attendance/check-out'
import { getWorkerSession } from '@/lib/auth/guards'
import { ok, badRequest, unauthorized, internalError } from '@/lib/utils/response'

export async function POST(request: NextRequest) {
  try {
    const session = await getWorkerSession()
    if (!session) return unauthorized()

    const body = await request.json()
    const parsed = checkOutSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const result = await processCheckOut({
      workerId: session.sub,
      ...parsed.data,
    })

    if (!result.success) {
      return badRequest(result.message)
    }

    return ok({ distance: result.distance }, result.message)
  } catch (err) {
    console.error('[attendance/check-out]', err)
    return internalError()
  }
}
