/**
 * PATCH  /api/admin/sites/[id]/notices/[noticeId]  — 공지 수정 (부분 업데이트)
 * DELETE /api/admin/sites/[id]/notices/[noticeId]  — 공지 비활성화 (soft delete)
 */
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAdminSession, requireRole, MUTATE_ROLES } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, badRequest, unauthorized, notFound, internalError } from '@/lib/utils/response'
import { SiteNoticeType, SiteVisibilityScope } from '@prisma/client'

const patchSchema = z.object({
  title:            z.string().min(1).max(200).optional(),
  content:          z.string().min(1).optional(),
  noticeType:       z.nativeEnum(SiteNoticeType).optional(),
  visibilityScope:  z.nativeEnum(SiteVisibilityScope).optional(),
  targetTeamLabel:  z.string().max(100).nullable().optional(),
  startDate:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  isTodayHighlight: z.boolean().optional(),
  isActive:         z.boolean().optional(),
})

// ─── PATCH ───────────────────────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; noticeId: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, MUTATE_ROLES)
    if (deny) return deny

    const { id, noticeId } = await params

    const existing = await prisma.siteNotice.findFirst({
      where: { id: noticeId, siteId: id },
    })
    if (!existing) return notFound('공지를 찾을 수 없습니다.')

    const body = await req.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const d = parsed.data

    const notice = await prisma.siteNotice.update({
      where: { id: noticeId },
      data: {
        ...(d.title            !== undefined ? { title:            d.title }            : {}),
        ...(d.content          !== undefined ? { content:          d.content }          : {}),
        ...(d.noticeType       !== undefined ? { noticeType:       d.noticeType }       : {}),
        ...(d.visibilityScope  !== undefined ? { visibilityScope:  d.visibilityScope }  : {}),
        ...(d.targetTeamLabel  !== undefined ? { targetTeamLabel:  d.targetTeamLabel }  : {}),
        ...(d.startDate        !== undefined ? { startDate:        new Date(d.startDate) } : {}),
        ...(d.endDate          !== undefined ? { endDate:          d.endDate ? new Date(d.endDate) : null } : {}),
        ...(d.isTodayHighlight !== undefined ? { isTodayHighlight: d.isTodayHighlight } : {}),
        ...(d.isActive         !== undefined ? { isActive:         d.isActive }         : {}),
        updatedById: session.sub,
      },
    })

    return ok({ notice }, '공지가 수정되었습니다.')
  } catch (err) {
    console.error('[sites/[id]/notices/[noticeId] PATCH]', err)
    return internalError()
  }
}

// ─── DELETE (soft) ───────────────────────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; noticeId: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, MUTATE_ROLES)
    if (deny) return deny

    const { id, noticeId } = await params

    const existing = await prisma.siteNotice.findFirst({
      where: { id: noticeId, siteId: id },
    })
    if (!existing) return notFound('공지를 찾을 수 없습니다.')

    await prisma.siteNotice.update({
      where: { id: noticeId },
      data:  { isActive: false, updatedById: session.sub },
    })

    return ok({}, '공지가 비활성화되었습니다.')
  } catch (err) {
    console.error('[sites/[id]/notices/[noticeId] DELETE]', err)
    return internalError()
  }
}
