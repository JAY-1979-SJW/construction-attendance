/**
 * DELETE /api/admin/site-admin-assignments/[id]  — 배정 해제 (소프트)
 */
import { NextRequest } from 'next/server'
import { getAdminSession, requireRole, MUTATE_ROLES, unauthorized } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, notFound, internalError } from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, MUTATE_ROLES)
    if (deny) return deny

    const { id } = await params

    const assignment = await prisma.siteAdminAssignment.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true } },
        site: { select: { id: true, name: true } },
      },
    })
    if (!assignment) return notFound('배정 내역을 찾을 수 없습니다.')

    await prisma.siteAdminAssignment.update({
      where: { id },
      data: {
        isActive:  false,
        revokedAt: new Date(),
        revokedBy: session.sub,
      },
    })

    await writeAuditLog({
      actorUserId: session.sub,
      actorType:   'ADMIN',
      actionType:  'SITE_ADMIN_REVOKE',
      targetType:  'AdminUser',
      targetId:    assignment.userId,
      summary:     `현장 관리자 배정 해제: ${assignment.user.name} ← ${assignment.site.name}`,
      metadataJson: { assignmentId: id, siteId: assignment.siteId, userId: assignment.userId },
    })

    return ok(null, '배정이 해제되었습니다.')
  } catch (err) {
    console.error('[site-admin-assignments/[id] DELETE]', err)
    return internalError()
  }
}
