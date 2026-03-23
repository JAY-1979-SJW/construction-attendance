/**
 * POST   /api/admin/site-access-groups/[id]/users  — 사용자 할당
 * DELETE /api/admin/site-access-groups/[id]/users?userId=xxx  — 할당 해제
 */
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAdminSession, requireRole, SUPER_ADMIN_ONLY } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, created, badRequest, unauthorized, notFound, internalError } from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

const assignUserSchema = z.object({
  userId: z.string().min(1),
})

type RouteCtx = { params: Promise<{ id: string }> }

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: RouteCtx) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, SUPER_ADMIN_ONLY)
    if (deny) return deny

    const { id: accessGroupId } = await params

    const group = await prisma.siteAccessGroup.findUnique({ where: { id: accessGroupId } })
    if (!group) return notFound('접근 그룹을 찾을 수 없습니다.')

    const body = await req.json()
    const parsed = assignUserSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const { userId } = parsed.data

    // 대상 사용자가 EXTERNAL_SITE_ADMIN 역할인지 확인
    const targetUser = await prisma.adminUser.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true },
    })
    if (!targetUser) return notFound('사용자를 찾을 수 없습니다.')
    if ((targetUser.role as string) !== 'EXTERNAL_SITE_ADMIN') {
      return badRequest(`대상 사용자의 역할이 EXTERNAL_SITE_ADMIN이어야 합니다. (현재: ${targetUser.role})`)
    }

    // 기존 비활성 레코드가 있으면 재활성화
    const existing = await prisma.userSiteAccessGroup.findUnique({
      where: { userId_accessGroupId: { userId, accessGroupId } },
    })

    if (existing) {
      if (existing.isActive) return badRequest('이미 이 그룹에 할당된 사용자입니다.')
      await prisma.userSiteAccessGroup.update({
        where: { userId_accessGroupId: { userId, accessGroupId } },
        data: {
          isActive:   true,
          assignedAt: new Date(),
          assignedBy: session.sub,
          revokedAt:  null,
          revokedBy:  null,
        },
      })
    } else {
      await prisma.userSiteAccessGroup.create({
        data: { userId, accessGroupId, assignedBy: session.sub },
      })
    }

    await writeAuditLog({
      actorUserId: session.sub,
      actorType:   'ADMIN',
      actionType:  'ASSIGN_USER_TO_ACCESS_GROUP',
      targetType:  'SiteAccessGroup',
      targetId:    accessGroupId,
      summary:     `접근 그룹 사용자 할당: ${group.name} ← ${targetUser.name} (${targetUser.email})`,
      metadataJson: { accessGroupId, userId },
    })

    return created({}, '사용자가 그룹에 할당되었습니다.')
  } catch (err) {
    console.error('[site-access-groups/[id]/users POST]', err)
    return internalError()
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest, { params }: RouteCtx) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, SUPER_ADMIN_ONLY)
    if (deny) return deny

    const { id: accessGroupId } = await params
    const userId = new URL(req.url).searchParams.get('userId')
    if (!userId) return badRequest('userId가 필요합니다.')

    const assignment = await prisma.userSiteAccessGroup.findUnique({
      where: { userId_accessGroupId: { userId, accessGroupId } },
    })
    if (!assignment || !assignment.isActive) return notFound('활성 할당을 찾을 수 없습니다.')

    await prisma.userSiteAccessGroup.update({
      where: { userId_accessGroupId: { userId, accessGroupId } },
      data: {
        isActive:  false,
        revokedAt: new Date(),
        revokedBy: session.sub,
      },
    })

    await writeAuditLog({
      actorUserId: session.sub,
      actorType:   'ADMIN',
      actionType:  'REVOKE_USER_FROM_ACCESS_GROUP',
      targetType:  'SiteAccessGroup',
      targetId:    accessGroupId,
      summary:     `접근 그룹 사용자 해제: accessGroupId=${accessGroupId}, userId=${userId}`,
      metadataJson: { accessGroupId, userId },
    })

    return ok({}, '그룹 할당이 해제되었습니다.')
  } catch (err) {
    console.error('[site-access-groups/[id]/users DELETE]', err)
    return internalError()
  }
}
