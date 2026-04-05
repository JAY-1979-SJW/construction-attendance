/**
 * PATCH /api/admin/materials/requests/[id]/status
 * 자재 신청 상태 변경 (통합 엔드포인트)
 *
 * 허용 전이:
 *   SUBMITTED  → REVIEWED   (ADMIN/SUPER_ADMIN)
 *   SUBMITTED  → APPROVED   (ADMIN/SUPER_ADMIN)
 *   REVIEWED   → APPROVED   (ADMIN/SUPER_ADMIN)
 *   APPROVED   → ORDERED    (ADMIN/SUPER_ADMIN)
 *   ORDERED    → RECEIVED   (ADMIN/SUPER_ADMIN)
 *   SUBMITTED/REVIEWED → REJECTED  (ADMIN/SUPER_ADMIN)
 *
 * VIEWER: 403
 * TEAM_LEADER/FOREMAN: 403 (조회/등록만 가능)
 */
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { ok, badRequest, unauthorized, forbidden, notFound, conflict } from '@/lib/utils/response'

const ADMIN_ONLY_ROLES = ['SUPER_ADMIN', 'ADMIN']

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  SUBMITTED: ['REVIEWED', 'APPROVED', 'REJECTED'],
  REVIEWED:  ['APPROVED', 'REJECTED'],
  APPROVED:  ['ORDERED'],
  ORDERED:   ['RECEIVED'],
}

const StatusSchema = z.object({
  toStatus: z.enum(['REVIEWED', 'APPROVED', 'ORDERED', 'RECEIVED', 'REJECTED']),
  reason:   z.string().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  if (!ADMIN_ONLY_ROLES.includes(session.role ?? '')) {
    return forbidden('상태 변경은 관리자(ADMIN/SUPER_ADMIN)만 가능합니다.')
  }

  const { id } = await params
  const request = await prisma.materialRequest.findUnique({
    where: { id },
    select: { id: true, status: true },
  })
  if (!request) return notFound('청구서를 찾을 수 없습니다.')

  const body = await req.json().catch(() => null)
  const parsed = StatusSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.errors[0].message)

  const { toStatus, reason } = parsed.data
  const allowed = ALLOWED_TRANSITIONS[request.status] ?? []
  if (!allowed.includes(toStatus)) {
    return conflict(`현재 상태(${request.status})에서 ${toStatus}로 변경할 수 없습니다.`)
  }

  // 상태별 타임스탬프 필드
  const now = new Date()
  const tsFields: Record<string, unknown> = { status: toStatus }
  if (toStatus === 'REVIEWED')  { tsFields.reviewedAt = now; tsFields.reviewedBy = session.sub }
  if (toStatus === 'APPROVED')  { tsFields.approvedAt = now; tsFields.approvedBy = session.sub }
  if (toStatus === 'REJECTED')  { tsFields.rejectedAt = now; tsFields.rejectedBy = session.sub; if (reason) tsFields.rejectReason = reason }

  await prisma.$transaction(async (tx) => {
    await tx.materialRequest.update({ where: { id }, data: tsFields })
    await tx.materialRequestStatusHistory.create({
      data: {
        id:         randomUUID(),
        requestId:  id,
        fromStatus: request.status as never,
        toStatus:   toStatus as never,
        actorId:    session.sub,
        actorType:  'ADMIN',
        reason:     reason ?? null,
      },
    })
  })

  return ok({ id, toStatus })
}
