import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { badRequest, unauthorized, forbidden } from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'
import { sendEmail } from '@/lib/email/send-email'
import { companyAdminRejectedEmail } from '@/lib/email/templates'

const schema = z.object({
  rejectReason: z.string().min(1, '반려 사유를 입력하세요.').max(200),
})

/**
 * POST /api/admin/company-admin-requests/[id]/reject
 * 업체 관리자 신청 반려. SUPER_ADMIN 전용.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    if (session.role !== 'SUPER_ADMIN') return forbidden('슈퍼관리자 전용입니다.')

    const { id } = await params
    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const { rejectReason } = parsed.data

    const req = await prisma.companyAdminRequest.findUnique({ where: { id } })
    if (!req) {
      return NextResponse.json({ success: false, message: '신청 내역을 찾을 수 없습니다.' }, { status: 404 })
    }
    if (req.status !== 'PENDING') {
      return NextResponse.json({ success: false, message: `현재 상태(${req.status})에서는 처리할 수 없습니다.` }, { status: 400 })
    }

    await prisma.companyAdminRequest.update({
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
      actorRole: session.role,
      actionType: 'COMPANY_ADMIN_REJECTED',
      targetType: 'CompanyAdminRequest',
      targetId: id,
      summary: `업체 관리자 신청 반려 — ${req.companyName} / ${req.applicantName}: ${rejectReason}`,
      reason: rejectReason,
    })

    if (req.email) {
      const tpl = companyAdminRejectedEmail({
        applicantName: req.applicantName,
        companyName: req.companyName,
        rejectReason,
      })
      await sendEmail({ to: req.email, ...tpl })
    }

    return NextResponse.json({ success: true, message: '반려 처리되었습니다.' })
  } catch (err) {
    console.error('[admin/company-admin-requests/reject]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
