/**
 * PATCH /api/admin/sites/[id]/worklogs/[workDate]  — 작업일보 상태 전환
 *
 * body: { action: 'submit' | 'approve' | 'reject' | 'reopen' }
 *
 * 상태 흐름:
 *   DRAFT ──submit──▶ SUBMITTED ──approve──▶ APPROVED ──lock──▶ LOCKED
 *                  ◀──reopen──            ◀──reject──
 */
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAdminSession, requireRole, MUTATE_ROLES, SUPER_ADMIN_ONLY, canAccessSite, siteAccessDenied } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, badRequest, unauthorized, notFound, forbidden, internalError } from '@/lib/utils/response'

const actionSchema = z.object({
  action: z.enum(['submit', 'approve', 'reject', 'reopen', 'lock']),
  note:   z.string().nullable().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; workDate: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, [...MUTATE_ROLES, 'SITE_ADMIN'])
    if (deny) return deny

    const { id: siteId, workDate: workDateStr } = await params
    if (!await canAccessSite(session, siteId)) return siteAccessDenied()

    // workDate 형식 검증
    if (!/^\d{4}-\d{2}-\d{2}$/.test(workDateStr)) {
      return badRequest('workDate는 YYYY-MM-DD 형식이어야 합니다.')
    }

    const workDate = new Date(workDateStr)

    const workLog = await prisma.siteWorkLog.findUnique({
      where: { siteId_workDate: { siteId, workDate } },
    })
    if (!workLog) return notFound('해당 날짜의 작업일보가 없습니다.')

    const body = await req.json()
    const parsed = actionSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const { action, note } = parsed.data

    // 상태 전환 허용 매트릭스
    const allowed: Record<string, string[]> = {
      submit:  ['DRAFT', 'RETURNED'],
      approve: ['SUBMITTED'],
      reject:  ['SUBMITTED'],
      reopen:  ['APPROVED'],
      lock:    ['APPROVED'],
    }

    if (!allowed[action]?.includes(workLog.status)) {
      return badRequest(
        `현재 상태(${workLog.status})에서 '${action}' 작업을 수행할 수 없습니다.`
      )
    }

    // approve/lock은 SUPER_ADMIN 또는 ADMIN만 가능
    if (['approve', 'lock'].includes(action)) {
      const denyApprove = requireRole(session, ['SUPER_ADMIN', 'ADMIN'])
      if (denyApprove) return denyApprove
    }

    // lock은 approved 상태에서만 SUPER_ADMIN 가능
    if (action === 'lock') {
      const denyLock = requireRole(session, SUPER_ADMIN_ONLY)
      if (denyLock) return denyLock
    }

    const nextStatus = {
      submit:  'SUBMITTED',
      approve: 'APPROVED',
      reject:  'RETURNED',
      reopen:  'DRAFT',
      lock:    'LOCKED',
    }[action] as 'SUBMITTED' | 'APPROVED' | 'RETURNED' | 'DRAFT' | 'LOCKED'

    const updated = await prisma.siteWorkLog.update({
      where: { id: workLog.id },
      data: {
        status:      nextStatus,
        ...(action === 'approve' || action === 'lock' ? { approvedById:  session.sub } : {}),
        ...(action === 'reject'  ? { reviewedById: session.sub } : {}),
        ...(note ? { memoInternal: (workLog.memoInternal ? workLog.memoInternal + '\n' : '') + `[${action.toUpperCase()}] ${note}` } : {}),
      },
      include: { summary: true },
    })

    const actionLabels: Record<string, string> = {
      submit:  '제출되었습니다.',
      approve: '승인되었습니다.',
      reject:  '반려되었습니다.',
      reopen:  '재작성 상태로 변경되었습니다.',
      lock:    '확정되었습니다.',
    }

    return ok({ workLog: updated }, actionLabels[action])
  } catch (err) {
    console.error('[sites/[id]/worklogs/[workDate] PATCH]', err)
    return internalError()
  }
}
