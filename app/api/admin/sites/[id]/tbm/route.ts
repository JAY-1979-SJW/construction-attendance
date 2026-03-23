/**
 * GET  /api/admin/sites/[id]/tbm  — TBM 기록 목록 조회
 * POST /api/admin/sites/[id]/tbm  — TBM 기록 생성
 */
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAdminSession, requireRole, MUTATE_ROLES } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, badRequest, unauthorized, notFound, internalError } from '@/lib/utils/response'

const postSchema = z.object({
  workDate:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title:         z.string().min(1).max(200),
  content:       z.string().nullable().optional(),
  conductedAt:   z.string().datetime().nullable().optional(),
  conductorId:   z.string().nullable().optional(),
  attendeeCount: z.number().int().min(0).default(0),
  absentCount:   z.number().int().min(0).default(0),
  notes:         z.string().nullable().optional(),
})

const patchSchema = postSchema.partial().omit({ workDate: true })

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { id } = await params
    const site = await prisma.site.findUnique({ where: { id }, select: { id: true } })
    if (!site) return notFound('현장을 찾을 수 없습니다.')

    const { searchParams } = req.nextUrl
    const date = searchParams.get('date') // YYYY-MM-DD

    const records = await prisma.siteTbmRecord.findMany({
      where: {
        siteId: id,
        ...(date ? { workDate: new Date(date) } : {}),
      },
      orderBy: [{ workDate: 'desc' }, { conductedAt: 'asc' }],
    })

    return ok({ records })
  } catch (err) {
    console.error('[sites/[id]/tbm GET]', err)
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
    const deny = requireRole(session, MUTATE_ROLES)
    if (deny) return deny

    const { id } = await params
    const site = await prisma.site.findUnique({ where: { id }, select: { id: true } })
    if (!site) return notFound('현장을 찾을 수 없습니다.')

    const body = await req.json()
    const parsed = postSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const d = parsed.data

    const record = await prisma.siteTbmRecord.create({
      data: {
        siteId:        id,
        workDate:      new Date(d.workDate),
        title:         d.title,
        content:       d.content       ?? null,
        conductedAt:   d.conductedAt   ? new Date(d.conductedAt) : null,
        conductorId:   d.conductorId   ?? null,
        attendeeCount: d.attendeeCount,
        absentCount:   d.absentCount,
        notes:         d.notes         ?? null,
        createdById:   session.sub,
      },
    })

    return ok({ record }, 'TBM 기록이 등록되었습니다.')
  } catch (err) {
    console.error('[sites/[id]/tbm POST]', err)
    return internalError()
  }
}
