/**
 * GET  /api/admin/sites/[id]/notices  — 현장 공지 목록 조회
 * POST /api/admin/sites/[id]/notices  — 현장 공지 생성
 */
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAdminSession, requireRole, MUTATE_ROLES, canAccessSite, siteAccessDenied } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, badRequest, unauthorized, notFound, internalError } from '@/lib/utils/response'
import { SiteNoticeType, SiteVisibilityScope } from '@prisma/client'

const postSchema = z.object({
  title:            z.string().min(1).max(200),
  content:          z.string().min(1),
  noticeType:       z.nativeEnum(SiteNoticeType).default('GENERAL_NOTICE'),
  visibilityScope:  z.nativeEnum(SiteVisibilityScope).default('ALL_WORKERS'),
  targetTeamLabel:  z.string().max(100).nullable().optional(),
  startDate:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be YYYY-MM-DD'),
  endDate:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be YYYY-MM-DD').nullable().optional(),
  isTodayHighlight: z.boolean().default(false),
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
    const activeOnly = searchParams.get('activeOnly') !== 'false'
    const noticeType = searchParams.get('noticeType') as SiteNoticeType | null
    const date       = searchParams.get('date') // YYYY-MM-DD — 해당 날짜 유효 공지만

    const notices = await prisma.siteNotice.findMany({
      where: {
        siteId:    id,
        ...(activeOnly ? { isActive: true } : {}),
        ...(noticeType ? { noticeType } : {}),
        ...(date ? {
          startDate: { lte: new Date(date) },
          OR: [{ endDate: null }, { endDate: { gte: new Date(date) } }],
        } : {}),
      },
      orderBy: [
        { isTodayHighlight: 'desc' },
        { startDate: 'desc' },
        { createdAt: 'desc' },
      ],
    })

    return ok({ notices })
  } catch (err) {
    console.error('[sites/[id]/notices GET]', err)
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

    const site = await prisma.site.findUnique({ where: { id }, select: { id: true, name: true } })
    if (!site) return notFound('현장을 찾을 수 없습니다.')

    const body = await req.json()
    const parsed = postSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const d = parsed.data

    const notice = await prisma.siteNotice.create({
      data: {
        siteId:           id,
        title:            d.title,
        content:          d.content,
        noticeType:       d.noticeType,
        visibilityScope:  d.visibilityScope,
        targetTeamLabel:  d.targetTeamLabel ?? null,
        startDate:        new Date(d.startDate),
        endDate:          d.endDate ? new Date(d.endDate) : null,
        isTodayHighlight: d.isTodayHighlight,
        createdById:      session.sub,
      },
    })

    return ok({ notice }, '공지가 등록되었습니다.')
  } catch (err) {
    console.error('[sites/[id]/notices POST]', err)
    return internalError()
  }
}
