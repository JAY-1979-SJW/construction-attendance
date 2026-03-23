import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminSession, requireRole, MUTATE_ROLES } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/audit/write-audit-log'
import { unauthorized, badRequest, notFound, internalError } from '@/lib/utils/response'

const patchSchema = z.object({
  action: z.enum(['BLOCK', 'UNBLOCK']),
  blockReason: z.string().max(200).optional(),
})

/**
 * PATCH /api/admin/devices/[id]
 * 기기 차단 / 차단 해제 (WorkerDevice.id 기준)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, MUTATE_ROLES)
    if (deny) return deny

    const body = await request.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.issues[0].message)

    const { action, blockReason } = parsed.data

    const device = await prisma.workerDevice.findUnique({
      where: { id: params.id },
      include: { worker: { select: { name: true, phone: true } } },
    })
    if (!device) return notFound('기기를 찾을 수 없습니다.')

    if (action === 'BLOCK') {
      await prisma.workerDevice.update({
        where: { id: params.id },
        data: {
          isBlocked: true,
          blockReason: blockReason ?? null,
          blockedAt: new Date(),
          blockedBy: session.sub,
        },
      })
    } else {
      await prisma.workerDevice.update({
        where: { id: params.id },
        data: {
          isBlocked: false,
          blockReason: null,
          blockedAt: null,
          blockedBy: null,
        },
      })
    }

    await writeAuditLog({
      actorUserId: session.sub,
      actorType: 'ADMIN',
      actionType: action === 'BLOCK' ? 'DEVICE_BLOCKED' : 'DEVICE_UNBLOCKED',
      targetType: 'WorkerDevice',
      targetId: params.id,
      summary: `기기 ${action === 'BLOCK' ? '차단' : '차단 해제'}: ${device.worker.name} (${device.worker.phone})`,
      metadataJson: { blockReason: blockReason ?? null, deviceToken: device.deviceToken },
    })

    return NextResponse.json({
      success: true,
      data: { id: params.id, isBlocked: action === 'BLOCK' },
    })
  } catch (err) {
    console.error('[admin/devices/[id] PATCH]', err)
    return internalError()
  }
}
