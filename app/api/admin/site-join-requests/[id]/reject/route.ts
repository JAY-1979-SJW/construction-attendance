import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { badRequest, unauthorized, forbidden } from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

const schema = z.object({
  rejectReason: z.string().min(1, '반려 사유를 입력하세요.').max(200),
})

/**
 * POST /api/admin/site-join-requests/[id]/reject
 * 현장 참여 신청 반려.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    if (!['SUPER_ADMIN', 'ADMIN', 'COMPANY_ADMIN'].includes(session.role ?? '')) return forbidden()

    const { id } = await params
    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const { rejectReason } = parsed.data

    const joinReq = await prisma.siteJoinRequest.findUnique({
      where: { id },
      include: {
        worker: { select: { name: true } },
        site: { select: { name: true } },
      },
    })
    if (!joinReq) {
      return NextResponse.json({ success: false, message: '신청 내역을 찾을 수 없습니다.' }, { status: 404 })
    }
    if (joinReq.status !== 'PENDING') {
      return NextResponse.json({ success: false, message: `현재 상태(${joinReq.status})에서는 반려할 수 없습니다.` }, { status: 400 })
    }

    await prisma.siteJoinRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewedAt: new Date(),
        reviewedBy: session.sub,
        rejectReason,
      },
    })

    await writeAuditLog({
      actorUserId: session.sub,
      actorType: 'ADMIN',
      actorRole: session.role ?? undefined,
      actionType: 'SITE_JOIN_REJECTED',
      targetType: 'SiteJoinRequest',
      targetId: id,
      summary: `현장 참여 반려 — ${joinReq.worker.name} → ${joinReq.site.name}: ${rejectReason}`,
      reason: rejectReason,
    })

    return NextResponse.json({ success: true, message: '반려 처리되었습니다.' })
  } catch (err) {
    console.error('[admin/site-join-requests/reject]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
