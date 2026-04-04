import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAdminSession, requireRole, MUTATE_ROLES } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, unauthorized, badRequest, internalError } from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

/**
 * POST /api/admin/device-requests/bulk
 * Body:
 *   { action: 'approve', ids: string[] }
 *   { action: 'reject',  ids: string[], rejectReason: string }
 * Response: { succeeded: number, failed: number, failedItems: { id, reason }[] }
 *
 * PENDING 상태인 항목만 처리. 이미 처리된 항목은 failed로 반환.
 */

const schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('approve'),
    ids: z.array(z.string()).min(1, 'ids가 필요합니다').max(100, '최대 100건까지 처리 가능합니다'),
  }),
  z.object({
    action: z.literal('reject'),
    ids: z.array(z.string()).min(1, 'ids가 필요합니다').max(100, '최대 100건까지 처리 가능합니다'),
    rejectReason: z.string().min(1, '반려 사유를 입력하세요.').max(200),
  }),
])

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, MUTATE_ROLES)
    if (deny) return deny

    const body = await req.json().catch(() => null)
    if (!body) return badRequest('요청 본문이 필요합니다')

    const parsed = schema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const { action, ids } = parsed.data

    // FK 선조회 원칙 — ids 전체 조회
    const deviceReqs = await prisma.deviceChangeRequest.findMany({
      where: { id: { in: ids } },
      include: { worker: { select: { name: true } } },
    })
    const reqMap = new Map(deviceReqs.map((r) => [r.id, r]))

    const succeeded: string[] = []
    const failedItems: { id: string; reason: string }[] = []

    if (action === 'approve') {
      for (const id of ids) {
        const dr = reqMap.get(id)
        if (!dr) { failedItems.push({ id, reason: 'NOT_FOUND' }); continue }
        if (dr.status !== 'PENDING') { failedItems.push({ id, reason: 'NOT_PENDING' }); continue }

        try {
          await prisma.$transaction(async (tx) => {
            // 기존 활성 기기 비활성화
            await tx.workerDevice.updateMany({
              where: { workerId: dr.workerId, isActive: true },
              data: { isActive: false, isPrimary: false },
            })
            // 신규 기기 등록
            await tx.workerDevice.upsert({
              where: { deviceToken: dr.newDeviceToken },
              update: {
                workerId: dr.workerId,
                deviceName: dr.newDeviceName,
                isPrimary: true,
                isActive: true,
                lastLoginAt: new Date(),
              },
              create: {
                workerId: dr.workerId,
                deviceToken: dr.newDeviceToken,
                deviceName: dr.newDeviceName,
                isPrimary: true,
                isActive: true,
                lastLoginAt: new Date(),
              },
            })
            // 요청 상태 업데이트
            await tx.deviceChangeRequest.update({
              where: { id },
              data: { status: 'APPROVED', processedAt: new Date(), processedBy: session.sub },
            })
          })

          await writeAuditLog({
            actorUserId: session.sub,
            actorType: 'ADMIN',
            actorRole: session.role ?? undefined,
            actionType: 'APPROVE_DEVICE_CHANGE',
            targetType: 'DeviceChangeRequest',
            targetId: id,
            summary: `[대량] 기기 변경 승인 — ${dr.worker.name} / ${dr.newDeviceName}`,
            metadataJson: { bulk: true, workerId: dr.workerId },
          })

          succeeded.push(id)
        } catch (err) {
          console.error(`[device-requests/bulk/approve] id=${id}`, err)
          failedItems.push({ id, reason: 'INTERNAL_ERROR' })
        }
      }
    } else {
      // action === 'reject'
      const { rejectReason } = parsed.data as { action: 'reject'; ids: string[]; rejectReason: string }

      for (const id of ids) {
        const dr = reqMap.get(id)
        if (!dr) { failedItems.push({ id, reason: 'NOT_FOUND' }); continue }
        if (dr.status !== 'PENDING') { failedItems.push({ id, reason: 'NOT_PENDING' }); continue }

        try {
          await prisma.deviceChangeRequest.update({
            where: { id },
            data: { status: 'REJECTED', processedAt: new Date(), processedBy: session.sub },
          })

          await writeAuditLog({
            actorUserId: session.sub,
            actorType: 'ADMIN',
            actorRole: session.role ?? undefined,
            actionType: 'REJECT_DEVICE_CHANGE',
            targetType: 'DeviceChangeRequest',
            targetId: id,
            summary: `[대량] 기기 변경 반려 — ${dr.worker.name}: ${rejectReason}`,
            reason: rejectReason,
            metadataJson: { bulk: true, workerId: dr.workerId },
          })

          succeeded.push(id)
        } catch (err) {
          console.error(`[device-requests/bulk/reject] id=${id}`, err)
          failedItems.push({ id, reason: 'INTERNAL_ERROR' })
        }
      }
    }

    return ok({ succeeded: succeeded.length, failed: failedItems.length, failedItems })
  } catch (err) {
    console.error('[admin/device-requests/bulk]', err)
    return internalError()
  }
}
