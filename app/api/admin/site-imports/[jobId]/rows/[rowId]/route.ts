import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAdminSession, requireRole, MUTATE_ROLES } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, badRequest, unauthorized, notFound, internalError } from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

const patchSchema = z.object({
  siteName:           z.string().min(1).optional(),
  normalizedAddress:  z.string().min(1).optional(),
  latitude:           z.number().min(-90).max(90).optional(),
  longitude:          z.number().min(-180).max(180).optional(),
  allowedRadiusMeters:z.number().int().min(10).max(5000).optional(),
  validationStatus:   z.enum(['READY', 'NEEDS_REVIEW', 'FAILED', 'APPROVED']).optional(),
  validationMessage:  z.string().nullable().optional(),
  userDecision:       z.enum(['USE_EXISTING', 'REGISTER_NEW', 'CANCEL']).optional(),
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

    const row = await prisma.bulkSiteImportRow.findFirst({
      where: { id: rowId, jobId },
    })
    if (!row) return notFound('행을 찾을 수 없습니다.')
    if (row.importedSiteId) return badRequest('이미 등록된 행은 수정할 수 없습니다.')

    const body = await request.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const { validationStatus, userDecision, ...rest } = parsed.data

    const updateData: Record<string, unknown> = { ...rest }

    if (userDecision) {
      updateData.userDecision = userDecision
    }

    if (validationStatus === 'APPROVED') {
      updateData.validationStatus = 'APPROVED'
      updateData.approvedBy = session.sub
      updateData.approvedAt = new Date()
      updateData.validationMessage = null
    } else if (validationStatus) {
      updateData.validationStatus = validationStatus
      if (validationStatus !== 'NEEDS_REVIEW') {
        updateData.approvedBy = null
        updateData.approvedAt = null
      }
    }

    const updated = await prisma.bulkSiteImportRow.update({
      where: { id: rowId },
      data: updateData,
    })

    // Job 집계 재계산
    const counts = await prisma.bulkSiteImportRow.groupBy({
      by: ['validationStatus'],
      where: { jobId },
      _count: { _all: true },
    })
    const cm: Record<string, number> = {}
    for (const c of counts) cm[c.validationStatus] = c._count._all

    await prisma.bulkSiteImportJob.update({
      where: { id: jobId },
      data: {
        readyRows:    cm['READY'] ?? 0,
        failedRows:   (cm['FAILED'] ?? 0) + (cm['NEEDS_REVIEW'] ?? 0),
        approvedRows: cm['APPROVED'] ?? 0,
        importedRows: cm['IMPORTED'] ?? 0,
      },
    })

    await writeAuditLog({
      actorUserId: session.sub,
      actorType: 'ADMIN',
      actorRole: session.role,
      actionType: 'SITE_IMPORT_ROW_UPDATE',
      targetType: 'BulkSiteImportRow',
      targetId: rowId,
      summary: `현장 업로드 행 수정: row ${row.rowNumber} (${row.siteName})`,
      metadataJson: { jobId, rowId, changes: parsed.data },
    })

    return ok(updated)
  } catch (err) {
    console.error('[site-imports rows PATCH]', err)
    return internalError()
  }
}
