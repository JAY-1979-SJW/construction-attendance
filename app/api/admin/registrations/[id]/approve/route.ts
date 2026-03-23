import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { unauthorized, forbidden } from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'
import { sendEmail } from '@/lib/email/send-email'
import { workerApprovedEmail } from '@/lib/email/templates'

/**
 * POST /api/admin/registrations/[id]/approve
 * 근로자 회원가입 승인.
 * SUPER_ADMIN, ADMIN 만 가능.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    if (!['SUPER_ADMIN', 'ADMIN'].includes(session.role ?? '')) return forbidden()

    const { id } = await params

    const worker = await prisma.worker.findUnique({ where: { id } })
    if (!worker) {
      return NextResponse.json({ success: false, message: '근로자를 찾을 수 없습니다.' }, { status: 404 })
    }
    if (worker.accountStatus !== 'PENDING') {
      return NextResponse.json({
        success: false,
        message: `현재 상태(${worker.accountStatus})에서는 승인할 수 없습니다.`,
      }, { status: 400 })
    }

    await prisma.worker.update({
      where: { id },
      data: {
        accountStatus: 'APPROVED',
        reviewedAt: new Date(),
        reviewedBy: session.sub,
        rejectReason: null,
        isActive: true,
      },
    })

    await writeAuditLog({
      actorUserId: session.sub,
      actorType: 'ADMIN',
      actorRole: session.role ?? undefined,
      actionType: 'USER_APPROVED',
      targetType: 'Worker',
      targetId: id,
      summary: `근로자 회원가입 승인 — ${worker.name} (${worker.phone})`,
    })

    // 이메일 발송 (이메일이 있는 경우에만, 실패해도 API 응답에 영향 없음)
    if (worker.email) {
      const tpl = workerApprovedEmail({ name: worker.name })
      await sendEmail({ to: worker.email, ...tpl })
    }

    return NextResponse.json({ success: true, message: '승인되었습니다.' })
  } catch (err) {
    console.error('[admin/registrations/approve]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
