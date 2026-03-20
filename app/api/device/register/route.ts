import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getWorkerSession } from '@/lib/auth/guards'
import { registerDevice } from '@/lib/auth/device'
import { signToken } from '@/lib/auth/jwt'
import { ok, badRequest, unauthorized, internalError } from '@/lib/utils/response'

const schema = z.object({
  deviceToken: z.string().min(10),
  deviceName: z.string().min(1),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getWorkerSession()
    if (!session) return unauthorized()

    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const { deviceToken, deviceName } = parsed.data

    await registerDevice(session.sub, deviceToken, deviceName)

    // device 포함 JWT 재발급
    const newToken = await signToken({
      sub: session.sub,
      type: 'worker',
      deviceToken,
    })

    const responseData = { registered: true, deviceToken }
    const response = NextResponse.json({ success: true, data: responseData, message: '기기가 등록되었습니다.' })
    response.cookies.set('worker_token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    return response
  } catch (err) {
    console.error('[device/register]', err)
    return internalError()
  }
}
