/**
 * PATCH  /api/admin/sites/[id]/schedules/[scheduleId]  — 일정 수정 (상태 포함)
 * DELETE /api/admin/sites/[id]/schedules/[scheduleId]  — 일정 삭제
 */
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAdminSession, requireRole, MUTATE_ROLES } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, badRequest, unauthorized, notFound, internalError } from '@/lib/utils/response'
import { SiteDailyScheduleType, SiteDailyScheduleStatus, SiteVisibilityScope } from '@prisma/client'

const patchSchema = z.object({
  scheduleType:        z.nativeEnum(SiteDailyScheduleType).optional(),
  title:               z.string().min(1).max(200).optional(),
  description:         z.string().nullable().optional(),
  plannedStartAt:      z.string().datetime().nullable().optional(),
  plannedEndAt:        z.string().datetime().nullable().optional(),
  location:            z.string().max(200).nullable().optional(),
  responsiblePersonId: z.string().nullable().optional(),
  targetTeamLabel:     z.string().max(100).nullable().optional(),
  visibilityScope:     z.nativeEnum(SiteVisibilityScope).optional(),
  status:              z.nativeEnum(SiteDailyScheduleStatus).optional(),
})

// ─── PATCH ───────────────────────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; scheduleId: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, MUTATE_ROLES)
    if (deny) return deny

    const { id, scheduleId } = await params

    const existing = await prisma.siteDailySchedule.findFirst({
      where: { id: scheduleId, siteId: id },
    })
    if (!existing) return notFound('일정을 찾을 수 없습니다.')

    const body = await req.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const d = parsed.data

    const schedule = await prisma.siteDailySchedule.update({
      where: { id: scheduleId },
      data: {
        ...(d.scheduleType        !== undefined ? { scheduleType:        d.scheduleType }        : {}),
        ...(d.title               !== undefined ? { title:               d.title }               : {}),
        ...(d.description         !== undefined ? { description:         d.description }         : {}),
        ...(d.plannedStartAt      !== undefined ? { plannedStartAt:      d.plannedStartAt ? new Date(d.plannedStartAt) : null } : {}),
        ...(d.plannedEndAt        !== undefined ? { plannedEndAt:        d.plannedEndAt   ? new Date(d.plannedEndAt)   : null } : {}),
        ...(d.location            !== undefined ? { location:            d.location }            : {}),
        ...(d.responsiblePersonId !== undefined ? { responsiblePersonId: d.responsiblePersonId } : {}),
        ...(d.targetTeamLabel     !== undefined ? { targetTeamLabel:     d.targetTeamLabel }     : {}),
        ...(d.visibilityScope     !== undefined ? { visibilityScope:     d.visibilityScope }     : {}),
        ...(d.status              !== undefined ? { status:              d.status }              : {}),
        updatedById: session.sub,
      },
    })

    return ok({ schedule }, '일정이 수정되었습니다.')
  } catch (err) {
    console.error('[sites/[id]/schedules/[scheduleId] PATCH]', err)
    return internalError()
  }
}

// ─── DELETE ──────────────────────────────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; scheduleId: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, MUTATE_ROLES)
    if (deny) return deny

    const { id, scheduleId } = await params

    const existing = await prisma.siteDailySchedule.findFirst({
      where: { id: scheduleId, siteId: id },
    })
    if (!existing) return notFound('일정을 찾을 수 없습니다.')

    await prisma.siteDailySchedule.delete({ where: { id: scheduleId } })

    return ok({}, '일정이 삭제되었습니다.')
  } catch (err) {
    console.error('[sites/[id]/schedules/[scheduleId] DELETE]', err)
    return internalError()
  }
}
