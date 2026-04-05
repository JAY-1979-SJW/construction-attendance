/**
 * PATCH /api/admin/workers/[id]/docs
 * 근로자 서류/교육 상태 직접 입력 저장
 *
 * 허용 역할: ADMIN, SUPER_ADMIN (MUTATE_ROLES)
 * VIEWER: 403
 */
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession, requireRole, MUTATE_ROLES, buildWorkerScopeWhere } from '@/lib/auth/guards'
import { ok, badRequest, unauthorized, forbidden, notFound, internalError } from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

const docsSchema = z.object({
  contractWrittenYn:       z.boolean().optional(),
  contractWrittenDate:     z.string().nullable().optional(),
  contractIssuedYn:        z.boolean().optional(),
  contractAttachedYn:      z.boolean().optional(),
  safetyEduCompletedYn:    z.boolean().optional(),
  safetyEduType:           z.string().nullable().optional(),
  safetyEduDate:           z.string().nullable().optional(),
  safetyEduCertAttachedYn: z.boolean().optional(),
  emergencyContact:        z.string().nullable().optional(),
  idVerificationStatus:    z.enum(['PENDING_REVIEW', 'VERIFIED', 'REJECTED', 'RESCAN_REQUIRED', 'ARCHIVED']).nullable().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const deny = requireRole(session, MUTATE_ROLES)
    if (deny) return deny

    const { id } = await params

    const workerScope = await buildWorkerScopeWhere(session)
    if (workerScope === false) return notFound('근로자를 찾을 수 없습니다.')

    const worker = await prisma.worker.findFirst({ where: { id, ...workerScope } })
    if (!worker) return notFound('근로자를 찾을 수 없습니다.')

    const body = await request.json().catch(() => null)
    const parsed = docsSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    if (Object.keys(parsed.data).length === 0) {
      return badRequest('수정할 항목이 없습니다.')
    }

    const updated = await prisma.worker.update({
      where: { id },
      data: parsed.data as Record<string, unknown>,
      select: {
        id: true,
        contractWrittenYn: true,
        contractWrittenDate: true,
        contractIssuedYn: true,
        contractAttachedYn: true,
        safetyEduCompletedYn: true,
        safetyEduType: true,
        safetyEduDate: true,
        safetyEduCertAttachedYn: true,
        emergencyContact: true,
        idVerificationStatus: true,
        updatedAt: true,
      },
    })

    await writeAuditLog({
      adminId: session.sub,
      actionType: 'UPDATE_WORKER',
      targetType: 'Worker',
      targetId: id,
      description: `근로자 서류/교육 수정: ${worker.name} | 변경항목: ${Object.keys(parsed.data).join(', ')}`,
    })

    return ok(updated, '서류/교육 정보가 저장되었습니다.')
  } catch (err) {
    console.error('[admin/workers/[id]/docs PATCH]', err)
    return internalError()
  }
}
