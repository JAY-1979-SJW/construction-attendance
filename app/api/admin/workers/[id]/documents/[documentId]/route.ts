import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAdminSession, requireRole, MUTATE_ROLES } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, badRequest, unauthorized, notFound, internalError } from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

const patchSchema = z.object({
  status:      z.enum(['UPLOADED', 'REVIEW_PENDING', 'APPROVED', 'NEEDS_SUPPLEMENT', 'EXPIRED']).optional(),
  expiresAt:   z.string().nullable().optional(),
  notes:       z.string().nullable().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, MUTATE_ROLES)
    if (deny) return deny

    const { id: workerId, documentId } = await params

    const doc = await prisma.workerDocument.findFirst({
      where: { id: documentId, workerId },
      include: { file: { select: { originalFilename: true } } },
    })
    if (!doc) return notFound('문서를 찾을 수 없습니다.')

    const body = await request.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const { status, expiresAt, notes } = parsed.data

    const updateData: Record<string, unknown> = {}
    if (status !== undefined) {
      updateData.status = status
      // 상태 변경 시 검토자/검토일 기록
      if (status === 'APPROVED' || status === 'NEEDS_SUPPLEMENT') {
        updateData.reviewedBy = session.sub
        updateData.reviewedAt = new Date()
      }
    }
    if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null
    if (notes !== undefined) updateData.notes = notes

    const updated = await prisma.workerDocument.update({
      where: { id: documentId },
      data: updateData,
    })

    await writeAuditLog({
      actorUserId: session.sub,
      actorType: 'ADMIN',
      actionType: 'DOCUMENT_STATUS_CHANGE',
      targetType: 'Worker',
      targetId: workerId,
      summary: `문서 상태 변경: ${doc.file.originalFilename} → ${status ?? '(상태 유지)'}`,
      metadataJson: { documentId, prevStatus: doc.status, newStatus: status },
    })

    return ok(updated)
  } catch (err) {
    console.error('[workers/documents PATCH]', err)
    return internalError()
  }
}
