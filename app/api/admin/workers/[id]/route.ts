import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAdminSession, requireRole, MUTATE_ROLES } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import {
  ok,
  badRequest,
  unauthorized,
  notFound,
  conflict,
  internalError,
} from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().regex(/^010\d{8}$/, '올바른 휴대폰 번호 형식이 아닙니다.').optional(),
  jobTitle: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
})

// ─── PUT /api/admin/workers/[id] — 근로자 정보 수정 ─────────────────────────

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, MUTATE_ROLES)
    if (deny) return deny

    const { id } = await params

    const body = await request.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    if (Object.keys(parsed.data).length === 0) {
      return badRequest('수정할 항목이 없습니다.')
    }

    const worker = await prisma.worker.findUnique({ where: { id } })
    if (!worker) return notFound('근로자를 찾을 수 없습니다.')

    // 전화번호 변경 시 중복 검사
    if (parsed.data.phone && parsed.data.phone !== worker.phone) {
      const duplicate = await prisma.worker.findUnique({
        where: { phone: parsed.data.phone },
      })
      if (duplicate) return conflict('이미 사용 중인 휴대폰 번호입니다.')
    }

    const updated = await prisma.worker.update({
      where: { id },
      data: parsed.data,
    })

    await writeAuditLog({
      adminId: session.sub,
      actionType: 'UPDATE_WORKER',
      targetType: 'Worker',
      targetId: id,
      description: `근로자 수정: ${updated.name} (${updated.phone}) | 변경항목: ${Object.keys(parsed.data).join(', ')}`,
    })

    return ok(
      {
        id: updated.id,
        name: updated.name,
        phone: updated.phone,
        jobTitle: updated.jobTitle,
        isActive: updated.isActive,
        updatedAt: updated.updatedAt,
      },
      '근로자 정보가 수정되었습니다.'
    )
  } catch (err) {
    console.error('[admin/workers/[id] PUT]', err)
    return internalError()
  }
}

// ─── DELETE /api/admin/workers/[id] — 근로자 비활성화(soft delete) ───────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, MUTATE_ROLES)
    if (deny) return deny

    const { id } = await params

    const worker = await prisma.worker.findUnique({
      where: { id },
      include: {
        _count: { select: { attendanceLogs: true } },
      },
    })
    if (!worker) return notFound('근로자를 찾을 수 없습니다.')

    if (!worker.isActive) {
      return badRequest('이미 비활성화된 근로자입니다.')
    }

    // 출퇴근 이력이 있으면 hard delete 불가 → soft delete (isActive=false)
    // 이력이 없더라도 일관성을 위해 soft delete 유지
    await prisma.$transaction([
      // 활성 기기 모두 비활성화
      prisma.workerDevice.updateMany({
        where: { workerId: id, isActive: true },
        data: { isActive: false },
      }),
      // 근로자 비활성화
      prisma.worker.update({
        where: { id },
        data: { isActive: false },
      }),
    ])

    await writeAuditLog({
      adminId: session.sub,
      actionType: 'DEACTIVATE_WORKER',
      targetType: 'Worker',
      targetId: id,
      description: `근로자 비활성화: ${worker.name} (${worker.phone}) | 출퇴근 이력 ${worker._count.attendanceLogs}건 보존`,
    })

    return ok(
      { id, hasHistory: worker._count.attendanceLogs > 0 },
      '근로자가 비활성화되었습니다. 출퇴근 이력은 보존됩니다.'
    )
  } catch (err) {
    console.error('[admin/workers/[id] DELETE]', err)
    return internalError()
  }
}
