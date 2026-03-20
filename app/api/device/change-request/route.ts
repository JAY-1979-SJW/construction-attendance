import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getWorkerSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, badRequest, unauthorized, internalError } from '@/lib/utils/response'

const schema = z.object({
  newDeviceToken: z.string().min(10),
  newDeviceName: z.string().min(1),
  reason: z.string().min(5),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getWorkerSession()
    if (!session) return unauthorized()

    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const { newDeviceToken, newDeviceName, reason } = parsed.data

    // 기존 기본 기기 토큰 조회
    const primaryDevice = await prisma.workerDevice.findFirst({
      where: { workerId: session.sub, isPrimary: true, isActive: true },
    })

    // 대기 중인 요청 중복 체크
    const pending = await prisma.deviceChangeRequest.findFirst({
      where: { workerId: session.sub, status: 'PENDING' },
    })
    if (pending) {
      return badRequest('이미 처리 대기 중인 기기 변경 요청이 있습니다.')
    }

    await prisma.deviceChangeRequest.create({
      data: {
        workerId: session.sub,
        oldDeviceToken: primaryDevice?.deviceToken ?? null,
        newDeviceToken,
        newDeviceName,
        reason,
      },
    })

    return ok(null, '기기 변경 요청이 접수되었습니다. 관리자 승인 후 사용 가능합니다.')
  } catch (err) {
    console.error('[device/change-request]', err)
    return internalError()
  }
}
