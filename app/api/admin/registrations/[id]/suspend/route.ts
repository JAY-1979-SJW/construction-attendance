import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { badRequest, unauthorized, forbidden } from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

const schema = z.object({
  reason: z.string().min(1, '정지 사유를 입력하세요.').max(200),
})

/**
 * POST /api/admin/registrations/[id]/suspend
 * 근로자 계정 정지. SUPER_ADMIN, ADMIN 만 가능.
 * APPROVED → SUSPENDED 전환.
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

    const { reason } = parsed.data

    const worker = await prisma.worker.findUnique({ where: { id } })
    if (!worker) {
      return NextResponse.json({ success: false, message: '근로자를 찾을 수 없습니다.' }, { status: 404 })
    }
    if (worker.accountStatus === 'SUSPENDED') {
      return NextResponse.json({ success: false, message: '이미 정지된 계정입니다.' }, { status: 400 })
    }
    if (worker.accountStatus === 'PENDING') {
      return NextResponse.json({
        success: false,
        message: '대기 상태에서는 정지할 수 없습니다. 반려를 사용하세요.',
      }, { status: 400 })
    }

    await prisma.worker.update({
      where: { id },
      data: {
        accountStatus: 'SUSPENDED',
        reviewedAt: new Date(),
        reviewedBy: session.sub,
        rejectReason: reason,
        isActive: false,
      },
    })

    await writeAuditLog({
      actorUserId: session.sub,
      actorType: 'ADMIN',
      actorRole: session.role ?? undefined,
      actionType: 'USER_SUSPENDED',
      targetType: 'Worker',
      targetId: id,
      summary: `근로자 계정 정지 — ${worker.name} (${worker.phone}): ${reason}`,
      reason,
    })

    return NextResponse.json({ success: true, message: '계정이 정지되었습니다.' })
  } catch (err) {
    console.error('[admin/registrations/suspend]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
