import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { requireCompanyAdmin } from '@/lib/auth/guards'
import { badRequest, unauthorized, forbidden, notFound, internalError } from '@/lib/utils/response'
import { requireFeature } from '@/lib/feature-flags'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

const patchSchema = z.object({
  action: z.enum(['approve', 'reject']),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    let session
    try {
      session = await requireCompanyAdmin()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : ''
      if (msg === 'UNAUTHORIZED') return unauthorized()
      if (msg === 'FORBIDDEN') return forbidden()
      throw e
    }

    // feature flag 체크 (기기 조회 전에 먼저)
    const flagGuard = await requireFeature(session.companyId, 'deviceApprovalEnabled')
    if (flagGuard) return flagGuard

    const body = await request.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.issues[0].message)

    const { action } = parsed.data

    // 요청 조회
    const req = await prisma.deviceChangeRequest.findUnique({
      where: { id: params.id },
      include: { worker: { select: { name: true, phone: true } } },
    })
    if (!req) return notFound('기기 변경 요청을 찾을 수 없습니다.')
    if (req.status !== 'PENDING') return badRequest('이미 처리된 요청입니다.')

    // 이 근로자가 해당 회사 소속인지 확인
    const assignment = await prisma.workerCompanyAssignment.findFirst({
      where: { workerId: req.workerId, companyId: session.companyId, validTo: null },
    })
    if (!assignment) return forbidden('해당 근로자는 귀사 소속이 아닙니다.')

    if (action === 'approve') {
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

    const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED'
    const actionType = action === 'approve' ? 'APPROVE_DEVICE' : 'REJECT_DEVICE'

    await writeAuditLog({
      actorUserId:  session.sub,
      actorType:    'ADMIN',
      actorRole:    'COMPANY_ADMIN',
      companyId:    session.companyId,
      actionType,
      targetType:   'DeviceChangeRequest',
      targetId:     params.id,
      summary:      `기기 변경 요청 ${action === 'approve' ? '승인' : '거절'}: 근로자 ${req.worker?.name ?? req.workerId}`,
      beforeJson:   { status: 'PENDING', deviceToken: req.newDeviceToken },
      afterJson:    { status: newStatus },
    })

    return NextResponse.json({ success: true, data: { id: params.id, status: newStatus } })
  } catch (err) {
    console.error('[company/devices/[id] PATCH]', err)
    return internalError()
  }
}
