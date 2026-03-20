import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminSession, requireRole, MUTATE_ROLES } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/audit/write-audit-log'
import { unauthorized, badRequest, notFound, internalError } from '@/lib/utils/response'

const patchSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  adminNote: z.string().max(500).optional(),
})

/**
 * PATCH /api/admin/device-requests/[id]
 * 기기 변경 요청 승인 또는 반려
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

    const { action } = parsed.data

    const req = await prisma.deviceChangeRequest.findUnique({
      where: { id: params.id },
      include: { worker: { select: { name: true, phone: true } } },
    })
    if (!req) return notFound('기기 변경 요청을 찾을 수 없습니다.')
    if (req.status !== 'PENDING') return badRequest('이미 처리된 요청입니다.')

    if (action === 'APPROVE') {
      await prisma.$transaction([
        // 기존 활성 기기 비활성화
        prisma.workerDevice.updateMany({
          where: { workerId: req.workerId, isActive: true },
          data: { isActive: false, isPrimary: false },
        }),
        // 새 기기 등록
        prisma.workerDevice.create({
          data: {
            workerId: req.workerId,
            deviceToken: req.newDeviceToken,
            deviceName: req.newDeviceName,
            isPrimary: true,
            isActive: true,
          },
        }),
        // 요청 상태 업데이트
        prisma.deviceChangeRequest.update({
          where: { id: params.id },
          data: { status: 'APPROVED', processedAt: new Date(), processedBy: session.sub },
        }),
      ])
    } else {
      await prisma.deviceChangeRequest.update({
        where: { id: params.id },
        data: { status: 'REJECTED', processedAt: new Date(), processedBy: session.sub },
      })
    }

    const actionType = action === 'APPROVE' ? 'APPROVE_DEVICE_CHANGE' : 'REJECT_DEVICE_CHANGE'
    await writeAuditLog({
      adminId: session.sub,
      actionType,
      targetType: 'DeviceChangeRequest',
      targetId: params.id,
      description: `기기 변경 ${action === 'APPROVE' ? '승인' : '반려'}: ${req.worker.name} (${req.worker.phone})`,
    })

    return NextResponse.json({ success: true, data: { id: params.id, status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED' } })
  } catch (err) {
    console.error('[admin/device-requests/[id]]', err)
    return internalError()
  }
}
