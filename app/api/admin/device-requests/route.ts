import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAdminSession, requireRole, MUTATE_ROLES } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, badRequest, unauthorized, notFound, internalError } from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

const actionSchema = z.object({
  requestId: z.string(),
  action: z.enum(['APPROVE', 'REJECT']),
  note: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') ?? 'PENDING'
    const page = parseInt(searchParams.get('page') ?? '1', 10)
    const pageSize = 20

    const [total, requests] = await Promise.all([
      prisma.deviceChangeRequest.count({ where: { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' } }),
      prisma.deviceChangeRequest.findMany({
        where: { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' },
        include: { worker: { select: { name: true, phone: true, company: true } } },
        orderBy: { requestedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    return ok({
      items: requests.map((r) => ({
        id: r.id,
        workerName: r.worker.name,
        workerPhone: r.worker.phone,
        company: r.worker.company,
        oldDeviceToken: r.oldDeviceToken,
        newDeviceToken: r.newDeviceToken,
        newDeviceName: r.newDeviceName,
        reason: r.reason,
        status: r.status,
        requestedAt: r.requestedAt,
        processedAt: r.processedAt,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (err) {
    console.error('[admin/device-requests GET]', err)
    return internalError()
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, MUTATE_ROLES)
    if (deny) return deny

    const body = await request.json()
    const parsed = actionSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const { requestId, action, note } = parsed.data

    const req = await prisma.deviceChangeRequest.findUnique({
      where: { id: requestId },
      include: { worker: true },
    })
    if (!req) return notFound('요청을 찾을 수 없습니다.')
    if (req.status !== 'PENDING') return badRequest('이미 처리된 요청입니다.')

    if (action === 'APPROVE') {
      // 기존 기기 비활성화 후 신규 기기 등록
      await prisma.$transaction(async (tx) => {
        // 기존 활성 기기 비활성화
        await tx.workerDevice.updateMany({
          where: { workerId: req.workerId, isActive: true },
          data: { isActive: false, isPrimary: false },
        })
        // 신규 기기 등록
        await tx.workerDevice.create({
          data: {
            workerId: req.workerId,
            deviceToken: req.newDeviceToken,
            deviceName: req.newDeviceName,
            isPrimary: true,
            isActive: true,
            lastLoginAt: new Date(),
          },
        })
        // 요청 상태 업데이트
        await tx.deviceChangeRequest.update({
          where: { id: requestId },
          data: {
            status: 'APPROVED',
            processedAt: new Date(),
            processedBy: session.sub,
          },
        })
      })
    } else {
      await prisma.deviceChangeRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          processedAt: new Date(),
          processedBy: session.sub,
        },
      })
    }

    await writeAuditLog({
      adminId: session.sub,
      actionType: action === 'APPROVE' ? 'APPROVE_DEVICE_CHANGE' : 'REJECT_DEVICE_CHANGE',
      targetType: 'DeviceChangeRequest',
      targetId: requestId,
      description: `기기 변경 ${action === 'APPROVE' ? '승인' : '반려'}: ${req.worker.name} / ${note ?? ''}`,
    })

    return ok(null, action === 'APPROVE' ? '기기 변경이 승인되었습니다.' : '기기 변경이 반려되었습니다.')
  } catch (err) {
    console.error('[admin/device-requests POST]', err)
    return internalError()
  }
}
