/**
 * POST /api/device/push-token
 *
 * 근로자 앱이 FCM 토큰을 서버에 등록/갱신한다.
 * 인증된 기기(worker_token 쿠키)만 호출 가능.
 *
 * Body: { fcmToken: string; deviceToken: string }
 */
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { getWorkerSession } from '@/lib/auth/guards'
import { ok, unauthorized, badRequest, internalError } from '@/lib/utils/response'

const schema = z.object({
  fcmToken:    z.string().min(10).max(4096),
  deviceToken: z.string().min(10),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getWorkerSession()
    if (!session) return unauthorized()

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const { fcmToken, deviceToken } = parsed.data

    // 해당 근로자의 기기 중 deviceToken이 일치하고 승인된 기기만 업데이트
    const updated = await prisma.workerDevice.updateMany({
      where: { workerId: session.sub, deviceToken, isActive: true },
      data: { fcmToken },
    })

    if (updated.count === 0) {
      return badRequest('승인된 기기를 찾을 수 없습니다.')
    }

    return ok({ registered: true })
  } catch (err) {
    console.error('[push-token] 등록 오류', err)
    return internalError()
  }
}
