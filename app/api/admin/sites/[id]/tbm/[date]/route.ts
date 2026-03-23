/**
 * GET /api/admin/sites/[id]/tbm/[date]  — 날짜별 TBM 단건 조회
 * PUT /api/admin/sites/[id]/tbm/[date]  — 날짜별 TBM upsert
 */
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAdminSession, requireRole, MUTATE_ROLES, canAccessSite, siteAccessDenied } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, badRequest, unauthorized, notFound, internalError } from '@/lib/utils/response'

const putSchema = z.object({
  title:         z.string().min(1).max(200),
  content:       z.string().nullable().optional(),
  conductedAt:   z.string().datetime().nullable().optional(),
  conductorId:   z.string().nullable().optional(),
  attendeeCount: z.number().int().min(0).default(0),
  absentCount:   z.number().int().min(0).default(0),
  notes:         z.string().nullable().optional(),
})

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; date: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { id, date } = await params

    if (!await canAccessSite(session, id)) return siteAccessDenied()

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return badRequest('date는 YYYY-MM-DD 형식이어야 합니다.')
    }

    const site = await prisma.site.findUnique({ where: { id }, select: { id: true } })
    if (!site) return notFound('현장을 찾을 수 없습니다.')

    const workDate = new Date(date)

    const record = await prisma.siteTbmRecord.findFirst({
      where: { siteId: id, workDate },
      orderBy: { conductedAt: 'asc' },
    })

    if (!record) {
      return ok({ workDate: date, exists: false, item: null })
    }

    return ok({
      workDate: date,
      exists: true,
      item: {
        id:            record.id,
        title:         record.title,
        content:       record.content,
        conductedAt:   record.conductedAt,
        conductorId:   record.conductorId,
        attendeeCount: record.attendeeCount,
        absentCount:   record.absentCount,
        notes:         record.notes,
      },
    })
  } catch (err) {
    console.error('[sites/[id]/tbm/[date] GET]', err)
    return internalError()
  }
}

// ─── PUT (upsert) ─────────────────────────────────────────────────────────────

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; date: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, [...MUTATE_ROLES, 'SITE_ADMIN'])
    if (deny) return deny

    const { id, date } = await params
    if (!await canAccessSite(session, id)) return siteAccessDenied()

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return badRequest('date는 YYYY-MM-DD 형식이어야 합니다.')
    }

    const site = await prisma.site.findUnique({ where: { id }, select: { id: true } })
    if (!site) return notFound('현장을 찾을 수 없습니다.')

    const body = await req.json()
    const parsed = putSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const d = parsed.data
    const workDate = new Date(date)

    // 기존 레코드가 있으면 update, 없으면 create
    const existing = await prisma.siteTbmRecord.findFirst({
      where:   { siteId: id, workDate },
      orderBy: { conductedAt: 'asc' },
      select:  { id: true },
    })

    const payload = {
      title:         d.title,
      content:       d.content       ?? null,
      conductedAt:   d.conductedAt   ? new Date(d.conductedAt) : null,
      conductorId:   d.conductorId   ?? null,
      attendeeCount: d.attendeeCount,
      absentCount:   d.absentCount,
      notes:         d.notes         ?? null,
    }

    const record = existing
      ? await prisma.siteTbmRecord.update({
          where: { id: existing.id },
          data:  { ...payload, updatedById: session.sub },
        })
      : await prisma.siteTbmRecord.create({
          data: {
            siteId:      id,
            workDate,
            createdById: session.sub,
            ...payload,
          },
        })

    // 작업일보 tbmSummaryText 자동 동기화 (존재할 경우)
    const autoSummary = `${d.conductedAt ? new Date(d.conductedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) + ' TBM 실시, ' : ''}참석 ${d.attendeeCount}명 / 미참석 ${d.absentCount}명`
    await prisma.siteWorkLog.updateMany({
      where: { siteId: id, workDate },
      data:  { tbmSummaryText: autoSummary },
    }).catch(() => { /* 작업일보 없으면 skip */ })

    return ok({ workDate: date, exists: true, item: record }, 'TBM 기록이 저장되었습니다.')
  } catch (err) {
    console.error('[sites/[id]/tbm/[date] PUT]', err)
    return internalError()
  }
}
