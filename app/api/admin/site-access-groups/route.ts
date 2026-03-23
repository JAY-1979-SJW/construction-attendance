/**
 * GET  /api/admin/site-access-groups  — 접근 그룹 목록
 * POST /api/admin/site-access-groups  — 접근 그룹 생성
 */
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAdminSession, requireRole, SUPER_ADMIN_ONLY } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, created, badRequest, unauthorized, internalError } from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

const createSchema = z.object({
  name:          z.string().min(1).max(100),
  description:   z.string().max(500).optional(),
  ownerCompanyId: z.string().nullable().optional(),
})

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, ['SUPER_ADMIN', 'ADMIN'])
    if (deny) return deny

    const { searchParams } = new URL(req.url)
    const activeOnly = searchParams.get('activeOnly') !== 'false'

    const groups = await prisma.siteAccessGroup.findMany({
      where: activeOnly ? { isActive: true } : {},
      include: {
        _count: {
          select: { sites: true, users: true },
        },
        sites: {
          include: {
            site: { select: { id: true, name: true, address: true } },
          },
        },
        users: {
          where: { isActive: true },
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return ok({
      items: groups.map((g) => {
        return {
          id:             g.id,
          name:           g.name,
          description:    g.description,
          ownerCompanyId: g.ownerCompanyId,
          isActive:       g.isActive,
          createdAt:      g.createdAt.toISOString(),
          siteCount:      g._count.sites,
          activeUserCount: g._count.users,
          sites: g.sites.map((s) => ({
            id:      s.id,
            siteId:  s.siteId,
            addedAt: s.addedAt.toISOString(),
            site:    s.site,
          })),
          activeUsers: g.users.map((u) => ({
            id:         u.id,
            userId:     u.userId,
            assignedAt: u.assignedAt.toISOString(),
            user:       u.user,
          })),
        }
      }),
    })
  } catch (err) {
    console.error('[site-access-groups GET]', err)
    return internalError()
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, SUPER_ADMIN_ONLY)
    if (deny) return deny

    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const { name, description, ownerCompanyId } = parsed.data

    const group = await prisma.siteAccessGroup.create({
      data: {
        name,
        description: description ?? null,
        ownerCompanyId: ownerCompanyId ?? null,
      },
    })

    await writeAuditLog({
      actorUserId: session.sub,
      actorType:   'ADMIN',
      actionType:  'CREATE_SITE_ACCESS_GROUP',
      targetType:  'SiteAccessGroup',
      targetId:    group.id,
      summary:     `접근 그룹 생성: ${name}`,
      metadataJson: { name, ownerCompanyId: ownerCompanyId ?? null },
    })

    return created({ id: group.id, name: group.name }, '접근 그룹이 생성되었습니다.')
  } catch (err) {
    console.error('[site-access-groups POST]', err)
    return internalError()
  }
}
