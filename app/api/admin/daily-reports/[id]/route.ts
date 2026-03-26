/**
 * GET   /api/admin/daily-reports/[id]  — 작업일보 상세
 * PATCH /api/admin/daily-reports/[id]  — 확인완료 처리 / 관리자 메모
 */
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAdminSession, requireRole, MUTATE_ROLES } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, badRequest, unauthorized, notFound, internalError } from '@/lib/utils/response'

const patchSchema = z.object({
  status:    z.enum(['WRITTEN', 'CONFIRMED']).optional(),
  adminMemo: z.string().nullable().optional(),
})

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { id } = await params

    const report = await prisma.workerDailyReport.findUnique({
      where: { id },
      include: {
        worker: {
          select: {
            id: true, name: true, phone: true, jobTitle: true,
            employmentType: true, organizationType: true,
          },
        },
        site: { select: { id: true, name: true } },
      },
    })

    if (!report) return notFound('작업일보를 찾을 수 없습니다.')

    return ok(report)
  } catch (err) {
    console.error('[admin/daily-reports/[id] GET]', err)
    return internalError()
  }
}

// ─── PATCH ──────────────────────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, [...MUTATE_ROLES, 'SITE_ADMIN'])
    if (deny) return deny

    const { id } = await params
    const body = await req.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const d = parsed.data

    const existing = await prisma.workerDailyReport.findUnique({ where: { id } })
    if (!existing) return notFound('작업일보를 찾을 수 없습니다.')

    const updateData: any = {}
    if (d.adminMemo !== undefined) updateData.adminMemo = d.adminMemo
    if (d.status === 'CONFIRMED') {
      updateData.status = 'CONFIRMED'
      updateData.confirmedById = session.sub
      updateData.confirmedAt = new Date()
    } else if (d.status === 'WRITTEN') {
      updateData.status = 'WRITTEN'
      updateData.confirmedById = null
      updateData.confirmedAt = null
    }

    const updated = await prisma.workerDailyReport.update({
      where: { id },
      data: updateData,
      include: {
        worker: { select: { id: true, name: true, phone: true, jobTitle: true } },
        site: { select: { id: true, name: true } },
      },
    })

    return ok(updated)
  } catch (err) {
    console.error('[admin/daily-reports/[id] PATCH]', err)
    return internalError()
  }
}
