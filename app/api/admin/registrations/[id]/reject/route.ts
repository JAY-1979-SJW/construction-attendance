import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { badRequest, unauthorized, forbidden } from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'
import { sendEmail } from '@/lib/email/send-email'
import { workerRejectedEmail } from '@/lib/email/templates'

const schema = z.object({
  rejectReason: z.string().min(1, '반려 사유를 입력하세요.').max(200),
})

/**
 * POST /api/admin/registrations/[id]/reject
 * 근로자 회원가입 반려. 반려 사유 필수.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    if (!['SUPER_ADMIN', 'ADMIN'].includes(session.role ?? '')) return forbidden()

    const { id } = await params
    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const { rejectReason } = parsed.data

    const worker = await prisma.worker.findUnique({ where: { id } })
    if (!worker) {
      return NextResponse.json({ success: false, message: '근로자를 찾을 수 없습니다.' }, { status: 404 })
    }
    if (worker.accountStatus !== 'PENDING') {
      return NextResponse.json({
        success: false,
        message: `현재 상태(${worker.accountStatus})에서는 반려할 수 없습니다.`,
      }, { status: 400 })
    }

    await prisma.worker.update({
      where: { id },
      data: {
        accountStatus: 'REJECTED',
        reviewedAt: new Date(),
        reviewedBy: session.sub,
        rejectReason,
        isActive: false,
      },
    })

    await writeAuditLog({
      actorUserId: session.sub,
      actorType: 'ADMIN',
      actorRole: session.role ?? undefined,
      actionType: 'USER_REJECTED',
      targetType: 'Worker',
      targetId: id,
      summary: `근로자 회원가입 반려 — ${worker.name} (${worker.phone}): ${rejectReason}`,
      reason: rejectReason,
    })

    if (worker.email) {
      const tpl = workerRejectedEmail({ name: worker.name, rejectReason })
      await sendEmail({ to: worker.email, ...tpl })
    }

    return NextResponse.json({ success: true, message: '반려 처리되었습니다.' })
  } catch (err) {
    console.error('[admin/registrations/reject]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
