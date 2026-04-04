import { NextRequest } from 'next/server'
import { getAdminSession, requireRole } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, unauthorized, forbidden, internalError } from '@/lib/utils/response'
import { SUPER_ADMIN_ONLY_ROLES } from '@/lib/policies/security-policy'

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, SUPER_ADMIN_ONLY_ROLES)
    if (deny) return deny

    const { searchParams } = new URL(request.url)
    const dateFrom   = searchParams.get('dateFrom')
    const dateTo     = searchParams.get('dateTo')
    const actionType  = searchParams.get('actionType') ?? ''
    const actorUserId = searchParams.get('actorUserId') ?? ''
    const actorRole   = searchParams.get('actorRole') ?? ''
    const targetType  = searchParams.get('targetType') ?? ''
    const page     = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get('pageSize') ?? '50', 10)))

    const where: Record<string, unknown> = {}

    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00+09:00`) } : {}),
        ...(dateTo   ? { lte: new Date(`${dateTo}T23:59:59+09:00`) }   : {}),
      }
    }

    if (actionType)  where.actionType  = actionType
    if (actorUserId) where.actorUserId = actorUserId
    if (actorRole)   where.actorRole   = actorRole
    if (targetType)  where.targetType  = targetType

    const [total, items] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          actorUserId: true,
          actorType: true,
          actorRole: true,
          companyId: true,
          actionType: true,
          targetType: true,
          targetId: true,
          summary: true,
          beforeJson: true,
          afterJson: true,
          reason: true,
          metadataJson: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,
        },
      }),
    ])

    return ok({ items, total, page, pageSize })
  } catch (err) {
    console.error('[admin/audit-logs GET]', err)
    return internalError()
  }
}
