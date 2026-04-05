import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { ok, badRequest, unauthorized, notFound, conflict, forbidden } from '@/lib/utils/response'

const PatchSchema = z.object({
  title:               z.string().min(1).optional(),
  notes:               z.string().optional(),
  deliveryRequestedAt: z.string().datetime().optional().nullable(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { id } = await params
  const request = await prisma.materialRequest.findUnique({
    where: { id },
    include: {
      site: { select: { id: true, name: true } },
      items: {
        include: { materialMaster: { select: { id: true, itemCode: true, active: true } } },
        orderBy: { createdAt: 'asc' },
      },
      history: { orderBy: { createdAt: 'desc' } },
    },
  })
  if (!request) return notFound('청구서를 찾을 수 없습니다.')

  // ── scope 검증: TEAM_LEADER/FOREMAN는 본인 신청만 ──────────────────────────
  const getRole = session.role ?? ''
  if (['TEAM_LEADER', 'FOREMAN'].includes(getRole) && request.requestedBy !== session.sub) {
    return forbidden('접근 권한이 없습니다.')
  }
  // ──────────────────────────────────────────────────────────────────────────

  return ok(request)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { id } = await params
  const request = await prisma.materialRequest.findUnique({ where: { id }, select: { status: true, requestedBy: true } })
  if (!request) return notFound('청구서를 찾을 수 없습니다.')

  // ── scope 검증: TEAM_LEADER/FOREMAN는 본인 신청만 ──────────────────────────
  const patchRole = session.role ?? ''
  if (['TEAM_LEADER', 'FOREMAN'].includes(patchRole) && request.requestedBy !== session.sub) {
    return forbidden('접근 권한이 없습니다.')
  }
  // ──────────────────────────────────────────────────────────────────────────

  if (!['DRAFT', 'REJECTED'].includes(request.status)) {
    return conflict('작성중 또는 반려 상태에서만 수정할 수 있습니다.')
  }

  const body = await req.json().catch(() => null)
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.errors[0].message)

  const { title, notes, deliveryRequestedAt } = parsed.data
  const updated = await prisma.materialRequest.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(notes !== undefined && { notes }),
      ...(deliveryRequestedAt !== undefined && {
        deliveryRequestedAt: deliveryRequestedAt ? new Date(deliveryRequestedAt) : null,
      }),
    },
    select: { id: true, title: true, status: true, updatedAt: true },
  })

  return ok(updated)
}
