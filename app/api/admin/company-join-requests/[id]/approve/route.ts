import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { badRequest, unauthorized, forbidden } from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'
import { sendEmail } from '@/lib/email/send-email'
import { companyAdminApprovedEmail } from '@/lib/email/templates'
import bcrypt from 'bcryptjs'

const schema = z.object({
  temporaryPassword: z.string().min(8).optional(),
  notes: z.string().max(200).optional(),
})

/**
 * POST /api/admin/company-join-requests/[id]/approve
 * 기존 업체 관리자 합류 신청 승인.
 * 기존 Company는 유지, 신규 AdminUser(COMPANY_ADMIN) 생성.
 * SUPER_ADMIN 전용.
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
    const body = await request.json().catch(() => ({}))
    const parsed = schema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)
    const { temporaryPassword, notes } = parsed.data

    const req = await prisma.companyJoinRequest.findUnique({
      where: { id },
      include: { company: { select: { id: true, companyName: true } } },
    })
    if (!req) {
      return NextResponse.json({ success: false, message: '신청 내역을 찾을 수 없습니다.' }, { status: 404 })
    }
    if (req.status !== 'PENDING') {
      return NextResponse.json({ success: false, message: `현재 상태(${req.status})에서는 처리할 수 없습니다.` }, { status: 400 })
    }

    const rawPassword = temporaryPassword ?? Math.random().toString(36).slice(-10) + 'A1!'
    const passwordHash = await bcrypt.hash(rawPassword, 10)

    const adminUser = await prisma.$transaction(async (tx) => {
      const au = await tx.adminUser.create({
        data: {
          name: req.applicantName,
          email: req.email ?? `${req.phone}@company.local`,
          passwordHash,
          role: 'COMPANY_ADMIN',
          companyId: req.companyId,
          isActive: true,
        },
      })

      await tx.companyJoinRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewedAt: new Date(),
          reviewedBy: session.sub,
          createdAdminUserId: au.id,
          rejectReason: null,
          ...(notes ? { message: notes } : {}),
        },
      })

      return au
    })

    await writeAuditLog({
      actorUserId: session.sub,
      actorType: 'ADMIN',
      actorRole: session.role,
      actionType: 'COMPANY_ADMIN_APPROVED',
      targetType: 'CompanyJoinRequest',
      targetId: id,
      companyId: req.companyId,
      summary: `업체 관리자 합류 승인 — ${req.company.companyName} / ${req.applicantName}`,
      metadataJson: { companyId: req.companyId, adminUserId: adminUser.id },
    })

    if (req.email) {
      const tpl = companyAdminApprovedEmail({
        applicantName: req.applicantName,
        companyName: req.company.companyName,
        temporaryPassword: rawPassword,
      })
      await sendEmail({ to: req.email, ...tpl })
    }

    return NextResponse.json({
      success: true,
      message: '합류 신청이 승인되었습니다.',
      data: {
        companyId: req.companyId,
        adminUserId: adminUser.id,
        temporaryPassword: rawPassword,
        emailSent: !!req.email,
      },
    })
  } catch (err) {
    console.error('[admin/company-join-requests/approve]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
