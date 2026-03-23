/**
 * POST   /api/admin/site-access-groups/[id]/sites  — 현장 추가
 * DELETE /api/admin/site-access-groups/[id]/sites?siteId=xxx  — 현장 제거
 */
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAdminSession, requireRole, SUPER_ADMIN_ONLY } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, created, badRequest, unauthorized, notFound, internalError } from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

const addSiteSchema = z.object({
  siteId: z.string().min(1),
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
    const parsed = addSiteSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const { siteId } = parsed.data

    const site = await prisma.site.findUnique({ where: { id: siteId }, select: { id: true, name: true } })
    if (!site) return notFound('현장을 찾을 수 없습니다.')

    // 이미 등록된 경우 early return
    const exists = await prisma.siteAccessGroupSite.findUnique({
      where: { accessGroupId_siteId: { accessGroupId, siteId } },
    })
    if (exists) return badRequest('이미 이 그룹에 등록된 현장입니다.')

    const entry = await prisma.siteAccessGroupSite.create({
      data: { accessGroupId, siteId, addedBy: session.sub },
    })

    await writeAuditLog({
      actorUserId: session.sub,
      actorType:   'ADMIN',
      actionType:  'ADD_SITE_TO_ACCESS_GROUP',
      targetType:  'SiteAccessGroup',
      targetId:    accessGroupId,
      summary:     `접근 그룹 현장 추가: ${group.name} ← ${site.name}`,
      metadataJson: { accessGroupId, siteId },
    })

    return created({ id: entry.id }, '현장이 그룹에 추가되었습니다.')
  } catch (err) {
    console.error('[site-access-groups/[id]/sites POST]', err)
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
    const siteId = new URL(req.url).searchParams.get('siteId')
    if (!siteId) return badRequest('siteId가 필요합니다.')

    const entry = await prisma.siteAccessGroupSite.findUnique({
      where: { accessGroupId_siteId: { accessGroupId, siteId } },
    })
    if (!entry) return notFound('해당 현장이 그룹에 없습니다.')

    await prisma.siteAccessGroupSite.delete({
      where: { accessGroupId_siteId: { accessGroupId, siteId } },
    })

    await writeAuditLog({
      actorUserId: session.sub,
      actorType:   'ADMIN',
      actionType:  'REMOVE_SITE_FROM_ACCESS_GROUP',
      targetType:  'SiteAccessGroup',
      targetId:    accessGroupId,
      summary:     `접근 그룹 현장 제거: accessGroupId=${accessGroupId}, siteId=${siteId}`,
      metadataJson: { accessGroupId, siteId },
    })

    return ok({}, '현장이 그룹에서 제거되었습니다.')
  } catch (err) {
    console.error('[site-access-groups/[id]/sites DELETE]', err)
    return internalError()
  }
}
