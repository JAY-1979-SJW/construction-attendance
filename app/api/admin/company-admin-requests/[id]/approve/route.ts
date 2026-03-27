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
  // 승인 시 임시 비밀번호 생성하거나 직접 지정
  temporaryPassword: z.string().min(8, '임시 비밀번호는 8자 이상이어야 합니다.').optional(),
  notes: z.string().max(200).optional(),
})

/**
 * POST /api/admin/company-admin-requests/[id]/approve
 * 업체 관리자 신청 승인.
 * 1. Company 생성 (없으면)
 * 2. AdminUser(COMPANY_ADMIN) 생성
 * 3. CompanyAdminRequest 상태 → APPROVED
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

    const req = await prisma.companyAdminRequest.findUnique({ where: { id } })
    if (!req) {
      return NextResponse.json({ success: false, message: '신청 내역을 찾을 수 없습니다.' }, { status: 404 })
    }
    if (req.status !== 'PENDING') {
      return NextResponse.json({ success: false, message: `현재 상태(${req.status})에서는 처리할 수 없습니다.` }, { status: 400 })
    }

    // 임시 비밀번호 (미지정 시 자동 생성)
    const rawPassword = temporaryPassword ?? Math.random().toString(36).slice(-10) + 'A1!'
    const passwordHash = await bcrypt.hash(rawPassword, 10)

    const { adminUser, company } = await prisma.$transaction(async (tx) => {
      // 1. Company 생성 (사업자번호 기준 중복 방지)
      let co = await tx.company.findUnique({ where: { businessNumber: req.businessNumber } })
      if (!co) {
        co = await tx.company.create({
          data: {
            companyName: req.companyName,
            businessNumber: req.businessNumber,
            representativeName: req.representativeName ?? null,
            contactPhone: req.contactPhone ?? null,
            companyType: 'OTHER',
            status: 'ACTIVE',
          },
        })
      }

      // 2. AdminUser(COMPANY_ADMIN) 생성
      const au = await tx.adminUser.create({
        data: {
          name: req.applicantName,
          email: req.email ?? `${req.phone}@company.local`,
          passwordHash,
          role: 'COMPANY_ADMIN',
          companyId: co.id,
          isActive: true,
        },
      })

      // 3. CompanyAdminRequest 승인 처리
      await tx.companyAdminRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewedAt: new Date(),
          reviewedBy: session.sub,
          createdAdminUserId: au.id,
          notes: notes ?? null,
        },
      })

      return { adminUser: au, company: co }
    })

    await writeAuditLog({
      actorUserId: session.sub,
      actorType: 'ADMIN',
      actorRole: session.role,
      actionType: 'COMPANY_ADMIN_APPROVED',
      targetType: 'CompanyAdminRequest',
      targetId: id,
      companyId: company.id,
      summary: `업체 관리자 승인 — ${req.companyName} / ${req.applicantName}`,
      metadataJson: { companyId: company.id, adminUserId: adminUser.id },
    })

    // 이메일로 임시 비밀번호 전달 (이메일 있는 경우)
    if (req.email) {
      const tpl = companyAdminApprovedEmail({
        applicantName: req.applicantName,
        companyName: req.companyName,
        temporaryPassword: rawPassword,
      })
      await sendEmail({ to: req.email, ...tpl })
    }

    return NextResponse.json({
      success: true,
      message: '업체 관리자 신청이 승인되었습니다.',
      data: {
        companyId: company.id,
        adminUserId: adminUser.id,
        passwordDelivered: !!req.email,
      },
    })
  } catch (err) {
    console.error('[admin/company-admin-requests/approve]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
