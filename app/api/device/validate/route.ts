import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getWorkerSession } from '@/lib/auth/guards'
import { validateDevice } from '@/lib/auth/device'
import { ok, badRequest, unauthorized, internalError } from '@/lib/utils/response'

const schema = z.object({
  deviceToken: z.string().min(1),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getWorkerSession()
    if (!session) return unauthorized()

    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const isValid = await validateDevice(session.sub, parsed.data.deviceToken)

    return ok({ valid: isValid })
  } catch (err) {
    console.error('[device/validate]', err)
    return internalError()
  }
}
