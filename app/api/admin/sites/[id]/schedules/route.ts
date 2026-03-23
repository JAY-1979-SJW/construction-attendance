/**
 * GET  /api/admin/sites/[id]/schedules  — 당일 일정 목록 조회
 * POST /api/admin/sites/[id]/schedules  — 일정 생성
 */
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAdminSession, requireRole, MUTATE_ROLES, canAccessSite, siteAccessDenied } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, badRequest, unauthorized, notFound, internalError } from '@/lib/utils/response'
import { SiteDailyScheduleType, SiteDailyScheduleStatus, SiteVisibilityScope } from '@prisma/client'

const postSchema = z.object({
  scheduleDate:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduleType:        z.nativeEnum(SiteDailyScheduleType).default('OTHER'),
  title:               z.string().min(1).max(200),
  description:         z.string().nullable().optional(),
  plannedStartAt:      z.string().datetime().nullable().optional(),
  plannedEndAt:        z.string().datetime().nullable().optional(),
  location:            z.string().max(200).nullable().optional(),
  responsiblePersonId: z.string().nullable().optional(),
  targetTeamLabel:     z.string().max(100).nullable().optional(),
  visibilityScope:     z.nativeEnum(SiteVisibilityScope).default('ALL_WORKERS'),
  status:              z.nativeEnum(SiteDailyScheduleStatus).default('PLANNED'),
})

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { id } = await params
    if (!await canAccessSite(session, id)) return siteAccessDenied()

    const site = await prisma.site.findUnique({ where: { id }, select: { id: true } })
    if (!site) return notFound('현장을 찾을 수 없습니다.')

    const { searchParams } = req.nextUrl
    const date         = searchParams.get('date')         // YYYY-MM-DD (필수 아님)
    const scheduleType = searchParams.get('scheduleType') as SiteDailyScheduleType | null
    const status       = searchParams.get('status')       as SiteDailyScheduleStatus | null

    const schedules = await prisma.siteDailySchedule.findMany({
      where: {
        siteId: id,
        ...(date         ? { scheduleDate: new Date(date) } : {}),
        ...(scheduleType ? { scheduleType }                 : {}),
        ...(status       ? { status }                       : {}),
      },
      orderBy: [
        { scheduleDate:   'desc' },
        { plannedStartAt: 'asc'  },
        { createdAt:      'asc'  },
      ],
    })

    return ok({ schedules })
  } catch (err) {
    console.error('[sites/[id]/schedules GET]', err)
    return internalError()
  }
}

// ─── POST ────────────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, [...MUTATE_ROLES, 'SITE_ADMIN'])
    if (deny) return deny

    const { id } = await params
    if (!await canAccessSite(session, id)) return siteAccessDenied()
    const site = await prisma.site.findUnique({ where: { id }, select: { id: true } })
    if (!site) return notFound('현장을 찾을 수 없습니다.')

    const body = await req.json()
    const parsed = postSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const d = parsed.data

    const schedule = await prisma.siteDailySchedule.create({
      data: {
        siteId:              id,
        scheduleDate:        new Date(d.scheduleDate),
        scheduleType:        d.scheduleType,
        title:               d.title,
        description:         d.description         ?? null,
        plannedStartAt:      d.plannedStartAt       ? new Date(d.plannedStartAt) : null,
        plannedEndAt:        d.plannedEndAt         ? new Date(d.plannedEndAt)   : null,
        location:            d.location             ?? null,
        responsiblePersonId: d.responsiblePersonId  ?? null,
        targetTeamLabel:     d.targetTeamLabel       ?? null,
        visibilityScope:     d.visibilityScope,
        status:              d.status,
        createdById:         session.sub,
      },
    })

    return ok({ schedule }, '일정이 등록되었습니다.')
  } catch (err) {
    console.error('[sites/[id]/schedules POST]', err)
    return internalError()
  }
}
