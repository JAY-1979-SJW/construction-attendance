/**
 * PATCH /api/admin/worker-imports/[jobId]/rows/[rowId]
 * 근로자 업로드 행 사용자 결정 (REVIEW/BLOCK 건)
 *
 * userDecision: USE_EXISTING | REGISTER_NEW | CANCEL
 */
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAdminSession, requireRole, MUTATE_ROLES } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, badRequest, unauthorized, notFound, internalError } from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

const patchSchema = z.object({
  userDecision: z.enum(['USE_EXISTING', 'REGISTER_NEW', 'CANCEL']).optional(),
  validationStatus: z.enum(['READY', 'NEEDS_REVIEW', 'FAILED', 'APPROVED']).optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string; rowId: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, MUTATE_ROLES)
    if (deny) return deny

    const { jobId, rowId } = await params

    const row = await prisma.bulkWorkerImportRow.findFirst({
      where: { id: rowId, jobId },
    })
    if (!row) return notFound('행을 찾을 수 없습니다.')
    if (row.importedWorkerId) return badRequest('이미 등록된 행은 수정할 수 없습니다.')

    const body = await request.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const updateData: Record<string, unknown> = {}

    if (parsed.data.userDecision) {
      updateData.userDecision = parsed.data.userDecision

      if (parsed.data.userDecision === 'CANCEL') {
        updateData.validationStatus = 'FAILED'
        updateData.validationMessage = '사용자 취소'
      } else if (parsed.data.userDecision === 'USE_EXISTING') {
        // 기존 근로자 사용 → 등록 불필요, APPROVED로 표시
        updateData.validationStatus = 'APPROVED'
        updateData.validationMessage = '기존 근로자 사용'
        updateData.approvedBy = session.sub
        updateData.approvedAt = new Date()
        // importedWorkerId는 matchedWorkerId를 사용
        if (row.matchedWorkerId) {
          updateData.importedWorkerId = row.matchedWorkerId
        }
      } else if (parsed.data.userDecision === 'REGISTER_NEW') {
        updateData.validationStatus = 'APPROVED'
        updateData.validationMessage = '사용자 확인 후 신규 등록 승인'
        updateData.approvedBy = session.sub
        updateData.approvedAt = new Date()
      }
    }

    if (parsed.data.validationStatus && !parsed.data.userDecision) {
      updateData.validationStatus = parsed.data.validationStatus
      if (parsed.data.validationStatus === 'APPROVED') {
        updateData.approvedBy = session.sub
        updateData.approvedAt = new Date()
      }
    }

    const updated = await prisma.bulkWorkerImportRow.update({
      where: { id: rowId },
      data: updateData,
    })

    // Job 집계 재계산
    const statusCounts = await prisma.bulkWorkerImportRow.groupBy({
      by: ['validationStatus'],
      where: { jobId },
      _count: { _all: true },
    })
    const sm: Record<string, number> = {}
    for (const c of statusCounts) sm[c.validationStatus] = c._count._all

    await prisma.bulkWorkerImportJob.update({
      where: { id: jobId },
      data: {
        failedRows: sm['FAILED'] ?? 0,
        importedRows: sm['IMPORTED'] ?? 0,
      },
    })

    await writeAuditLog({
      actorUserId: session.sub,
      actorType: 'ADMIN',
      actorRole: session.role,
      actionType: 'WORKER_IMPORT_ROW_UPDATE',
      targetType: 'BulkWorkerImportRow',
      targetId: rowId,
      summary: `근로자 업로드 행 결정: row ${row.rowNumber} (${row.name}) → ${parsed.data.userDecision ?? parsed.data.validationStatus}`,
      metadataJson: { jobId, rowId, ...parsed.data },
    })

    return ok(updated)
  } catch (err) {
    console.error('[worker-imports rows PATCH]', err)
    return internalError()
  }
}
